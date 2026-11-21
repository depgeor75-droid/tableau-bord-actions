"""Locataires (exploitants) : cours de bourse des groupes cotés et veille des
actualités à risque (faillite, insolvabilité, restructuration, loyers impayés…).

Alerte rouge si une actualité contenant un mot-clé de risque a moins de 30 jours.
"""
from __future__ import annotations

import html
import time
from pathlib import Path

import pandas as pd

import sources
from actualites import _date_entree, identifiant, normaliser
from calculs import comparer
from marche import collecter_serie
from outils import chemin_serie, ecrire_json, horodatage, lire_json, lire_serie_csv, maintenant

ACTUS_PAR_LOCATAIRE = 8
ANCIENNETE_MAX_JOURS = 365


def _cours(locataire: dict, dossier: Path, depuis: str, complet: bool) -> tuple[dict | None, dict | None]:
    if not (locataire.get("cote") and locataire.get("symbole")):
        return None, None
    definition = {
        "id": f"loc_{locataire['id']}", "libelle": f"Cours de {locataire['nom']}", "frequence": "jour",
        "sources": [{"type": "yahoo", "symbole": locataire["symbole"], "nom": f"Yahoo Finance ({locataire['symbole']})"}],
    }
    if locataire.get("isin"):  # secours : site d'Euronext (cours non ajusté, ajouté seulement pour les jours manquants)
        definition["sources"].append({
            "type": "euronext", "isin": locataire["isin"], "marche": locataire.get("marche", "XBRU"), "nom": "Euronext (site officiel)",
        })
    etat = collecter_serie(definition, dossier, depuis, complet)
    etat["categorie"] = "locataires"
    etat["verifie_le"] = horodatage()
    serie = lire_serie_csv(chemin_serie(dossier, definition["id"]))
    actuel, periodes = comparer(serie, "cours", "hausse")
    periodes.pop("10a", None)
    fiche = {
        "symbole": locataire["symbole"], "devise": locataire.get("devise", "€"), "bourse": locataire.get("bourse"),
        "actuel": actuel, "periodes": periodes, "fichier": definition["id"],
        "source": etat.get("source_utilisee") or definition["sources"][0]["nom"],
        "etat": "nd" if serie.empty else ("ancien" if etat["etat"] == "KO" or etat.get("ancienne") else "ok"),
        "note": "Cours ajusté des opérations sur le capital (divisions, regroupements d'actions, augmentations de capital).",
    }
    return fiche, etat


def _filtre_pertinence(locataire: dict, reglages: dict):
    """Fabrique le test « cet article parle-t-il bien de ce locataire ? ».

    Un nom ambigu (« Colisée » est aussi un cinéma, une salle de sport…) ne compte
    que si le titre contient aussi un mot de contexte (EHPAD, maison de repos…).
    Les brèves de cours de bourse et autres bruits sont écartés."""
    alias = [normaliser(a) for a in locataire.get("alias", [locataire["nom"]])]
    ambigus = [normaliser(a) for a in locataire.get("alias_ambigus", [])]
    contexte = [normaliser(m) for m in reglages.get("mots_contexte", [])]
    sources_ignorees = [normaliser(s) for s in reglages.get("sources_ignorees", [])]
    titres_ignores = [normaliser(t) for t in reglages.get("titres_ignores", [])]

    def pertinent(article: dict) -> bool:
        cle = f" {normaliser(article['titre'])} "
        source = normaliser(article.get("source", ""))
        if any(s in source for s in sources_ignorees) or any(t in cle for t in titres_ignores):
            return False
        if any(f" {a} " in cle for a in alias):
            return True
        return any(f" {a} " in cle for a in ambigus) and any(f" {m}" in cle for m in contexte)

    return pertinent


def _actualites(locataire: dict, mots_risque: list[str], connues: dict, reglages: dict) -> tuple[list[dict], str | None]:
    pertinent = _filtre_pertinence(locataire, reglages)
    risques = [normaliser(m) for m in mots_risque]
    noms = locataire.get("alias", [locataire["nom"]]) + locataire.get("alias_ambigus", [])
    requete = locataire.get("requete") or " OR ".join(f'"{a}"' for a in noms)
    limite = (maintenant() - pd.Timedelta(days=ANCIENNETE_MAX_JOURS)).strftime("%Y-%m-%d")
    trouvees, erreur = {i: a for i, a in connues.items() if pertinent(a)}, None
    for langue in locataire.get("langues", []):
        try:
            entrees = sources.avec_reprises(
                lambda l=langue: sources.rss.google_news(f"{requete} when:90d", l), essais=2
            )
        except Exception as exception:  # noqa: BLE001
            erreur = str(exception)[:150]
            continue
        for entree in entrees:
            source = (getattr(entree, "source", None) or {}).get("title", "") if hasattr(entree, "source") else ""
            titre = html.unescape(getattr(entree, "title", "") or "").strip()
            if source and titre.endswith(f" - {source}"):
                titre = titre[: -len(source) - 3].strip()
            date = _date_entree(entree)
            if not titre or not date:
                continue
            cle = f" {normaliser(titre)} "
            mots = sorted({m for m in risques if f" {m}" in cle})
            article = {
                "id": identifiant(titre, date), "date": date, "titre": titre, "source": source or "Presse",
                "lien": getattr(entree, "link", ""), "langue": langue, "risque": bool(mots), "mots_risque": mots,
            }
            if pertinent(article):
                trouvees.setdefault(article["id"], article)
        time.sleep(0.4)
    articles = [a for a in trouvees.values() if a["date"] >= limite]
    # On garde toutes les actualités « à risque » récentes + les plus récentes des autres
    articles.sort(key=lambda a: a["date"], reverse=True)
    a_risque = [a for a in articles if a["risque"]][:ACTUS_PAR_LOCATAIRE]
    autres = [a for a in articles if not a["risque"]][: max(3, ACTUS_PAR_LOCATAIRE - len(a_risque))]
    return sorted(a_risque + autres, key=lambda a: a["date"], reverse=True), erreur


def collecter(config: dict, dossier: Path, complet: bool = False, journal=print) -> tuple[dict, list[dict]]:
    reglages = config.get("locataires") or {}
    seuil_jours = config.get("seuils_alertes", {}).get("actu_risque_jours", 30)
    depuis = config.get("historique_depuis", "2014-01-01")
    chemin = dossier / "locataires.json"
    ancien = {l["id"]: l for l in (lire_json(chemin, {}) or {}).get("locataires", [])}
    aujourdhui = pd.Timestamp(maintenant().date())
    etats, fiches = [], []
    erreurs_actus, total_actus = [], 0

    for locataire in reglages.get("liste", []):
        fiche = {cle: locataire.get(cle) for cle in ("id", "nom", "pays", "sites", "part_loyers", "segment", "cote", "note")}
        try:
            cours, etat = _cours(locataire, dossier, depuis, complet)
        except Exception as erreur:  # noqa: BLE001
            cours, etat = None, {"id": f"loc_{locataire['id']}", "libelle": f"Cours de {locataire['nom']}", "etat": "KO",
                                 "message": str(erreur)[:200], "categorie": "locataires", "verifie_le": horodatage()}
        fiche["cours"] = cours
        if etat:
            etats.append(etat)
            journal(f"  [{etat['etat']}] {etat['id']:<20} {etat.get('derniere_date') or '—'}  {etat.get('message', '')[:80]}")

        connues = {a["id"]: a for a in (ancien.get(locataire["id"]) or {}).get("actualites", [])}
        veille = bool(locataire.get("langues"))
        actus, erreur = (
            _actualites(locataire, config.get("mots_cles_risque", []), connues, reglages) if veille else ([], None)
        )
        if erreur:
            erreurs_actus.append(f"{locataire['nom']} : {erreur}")
        total_actus += len(actus)
        fiche["veille_actualites"] = veille
        fiche["actualites"] = actus
        recentes = [a for a in actus if a["risque"] and (aujourdhui - pd.Timestamp(a["date"])).days <= seuil_jours]
        fiche["alerte"] = recentes[0] if recentes else None
        fiches.append(fiche)

    etat_actus = {
        "id": "locataires_actus", "libelle": "Actualités des locataires — Google Actualités", "categorie": "locataires",
        "etat": "KO" if erreurs_actus and total_actus == 0 else "OK", "elements": total_actus,
        "message": " ; ".join(erreurs_actus)[:300], "verifie_le": horodatage(),
    }
    etats.append(etat_actus)
    journal(f"  [{etat_actus['etat']}] locataires_actus     {total_actus} actualités  {etat_actus['message'][:80]}")

    fondamentaux = lire_json(dossier / "fondamentaux.json", {}) or {}
    contenu = {
        "genere_le": horodatage(),
        "date_parts": reglages.get("date"),
        "source_parts": reglages.get("source"),
        "nombre_groupes": reglages.get("nombre_groupes"),
        "seuil_alerte_jours": seuil_jours,
        "locataires": fiches,
        "exploitants_par_pays": fondamentaux.get("exploitants_par_pays"),
    }
    ecrire_json(chemin, contenu)
    return contenu, etats
