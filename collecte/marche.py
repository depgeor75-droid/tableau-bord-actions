"""Collecte des séries de marché (cours, taux, indices) décrites dans la config.

Règles (cahier des charges § 3.2) :
  - chaque série est isolée : l'échec de l'une ne bloque jamais les autres ;
  - plusieurs sources par série : on essaie la principale, puis les secours ;
  - collecte incrémentale : on ne redemande que la fin de l'historique, avec un
    recouvrement de quelques semaines pour rattraper d'éventuelles corrections ;
  - on n'écrase JAMAIS une donnée valide par du vide : si tout échoue, le
    fichier existant reste tel quel.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

import sources
from outils import chemin_serie, ecrire_serie_csv, horodatage, iso, lire_serie_csv

RECOUVREMENT = {"jour": 25, "mois": 130}  # jours redemandés à chaque exécution
FRAICHEUR = {"jour": 6, "mois": 75}  # âge maximal (jours) avant de signaler « ancienne »


def desajuster(serie: pd.Series, ajustements: dict | None) -> pd.Series:
    """Retrouve le cours réellement coté à partir d'un cours rétro-ajusté des
    augmentations de capital avec droits (voir `ajustements_cours` dans la config)."""
    if not ajustements:
        return serie
    serie = serie.copy()
    precedent = pd.Timestamp.min
    for palier in sorted(ajustements.get("facteurs_cumules", []), key=lambda p: p["avant_le"]):
        limite = pd.Timestamp(palier["avant_le"])
        masque = (serie.index >= precedent) & (serie.index < limite)
        serie[masque] = serie[masque] / palier["facteur"]
        precedent = limite
    return serie.round(2)  # les cours d'Euronext sont cotés au centime


def _fusionner(existant: pd.Series, nouvelle: pd.Series, principale: bool, fige: bool = False) -> pd.Series:
    """Ajoute les nouvelles observations à l'historique.

    Source principale : elle fait foi sur toute la fenêtre redemandée (ce qui
    efface aussi d'éventuels points venus d'une source de secours).
    Source de secours : on ajoute seulement ce qui est postérieur à l'historique.
    """
    if existant.empty:
        return nouvelle
    if fige:
        # Cours réellement cotés : une fois enregistrés, ils ne changent plus. On ne
        # rafraîchit que les 5 derniers jours et on ajoute les nouvelles séances.
        gel = existant.index[-1] - pd.Timedelta(days=5)
        return pd.concat([existant[existant.index < gel], nouvelle[nouvelle.index >= gel]])
    if principale:
        return pd.concat([existant[existant.index < nouvelle.index[0]], nouvelle])
    return pd.concat([existant, nouvelle[nouvelle.index > existant.index[-1]]])


def _a_change_dans_le_passe(existant: pd.Series, nouvelle: pd.Series) -> bool:
    """Vrai si la source a recalculé son passé (cas du cours ajusté des dividendes,
    que Yahoo recale entièrement à chaque détachement de coupon)."""
    communes = existant.index.intersection(nouvelle.index)
    if len(communes) < 3:
        return False
    ecart = (existant[communes] / nouvelle[communes] - 1).abs()
    return bool(ecart.iloc[: max(3, len(ecart) // 2)].max() > 0.002)


def collecter_serie(
    definition: dict, dossier: Path, depuis: str, complet: bool = False, ajustements: dict | None = None
) -> dict:
    """Met à jour le CSV d'une série et renvoie son état pour etat_sources.json."""
    identifiant = definition["id"]
    frequence = definition.get("frequence", "jour")
    chemin = chemin_serie(dossier, identifiant)
    existant = lire_serie_csv(chemin)
    reprise_complete = complet or existant.empty
    debut = depuis if reprise_complete else iso(existant.index[-1] - pd.Timedelta(days=RECOUVREMENT[frequence]))

    etat = {
        "id": identifiant,
        "libelle": definition.get("libelle", identifiant),
        "etat": "KO",
        "source_utilisee": None,
        "secours_utilise": False,
        "message": "",
        "tentatives": [],
    }
    bornes = definition.get("bornes")  # [min, max] plausibles, facultatif

    for rang, source in enumerate(definition["sources"]):
        nom = source.get("nom", source["type"])
        try:
            nouvelle = sources.avec_reprises(lambda s=source, d=debut: sources.lire_serie(s, d))
            nouvelle = nouvelle[nouvelle.index >= depuis]
            if nouvelle.empty:
                raise sources.SourceErreur("aucune observation sur la période demandée")
            if source.get("desajuster_droits"):
                nouvelle = desajuster(nouvelle, ajustements)
            if bornes and not (bornes[0] <= nouvelle.iloc[-1] <= bornes[1]):
                raise sources.SourceErreur(f"dernière valeur invraisemblable ({nouvelle.iloc[-1]})")
            if definition.get("reajustable") and not reprise_complete and _a_change_dans_le_passe(existant, nouvelle):
                # Le passé a été recalculé par la source : on recharge tout l'historique.
                nouvelle = sources.avec_reprises(lambda s=source: sources.lire_serie(s, depuis))
                nouvelle = nouvelle[nouvelle.index >= depuis]
                existant = pd.Series(dtype=float)
            fige = bool(definition.get("historique_fige")) and not reprise_complete
            fusion = _fusionner(existant, nouvelle, principale=(rang == 0), fige=fige)
            if len(fusion) < len(existant) * 0.98:
                raise sources.SourceErreur("la mise à jour aurait fait perdre de l'historique : ignorée")
            ecrire_serie_csv(chemin, fusion)
            etat.update(
                etat="OK",
                source_utilisee=nom,
                secours_utilise=rang > 0,
                message="" if rang == 0 else "source principale en panne : source de secours utilisée",
            )
            etat["tentatives"].append({"source": nom, "etat": "OK"})
            existant = fusion
            break
        except Exception as erreur:  # noqa: BLE001 - une source en panne ne doit rien bloquer
            etat["tentatives"].append({"source": nom, "etat": "KO", "message": str(erreur)[:200]})

    if etat["etat"] == "KO":
        etat["message"] = " ; ".join(f"{t['source']} : {t.get('message', '')}" for t in etat["tentatives"])[:400]

    # État de l'historique conservé (même si la collecte du jour a échoué)
    if existant.empty:
        etat.update(points=0, premiere_date=None, derniere_date=None, derniere_valeur=None, ancienne=True)
    else:
        age = (pd.Timestamp.today().normalize() - existant.index[-1]).days
        etat.update(
            points=int(len(existant)),
            premiere_date=iso(existant.index[0]),
            derniere_date=iso(existant.index[-1]),
            derniere_valeur=round(float(existant.iloc[-1]), 6),
            ancienne=bool(age > definition.get("delai_jours", FRAICHEUR[frequence])),
        )
    return etat


def collecter(config: dict, dossier: Path, complet: bool = False, journal=print) -> list[dict]:
    """Collecte toutes les séries de la config. Renvoie la liste des états."""
    depuis = config.get("historique_depuis", "2014-01-01")
    etats = []
    for definition in config["series"]:
        try:
            etat = collecter_serie(definition, dossier, depuis, complet, config.get("ajustements_cours"))
        except Exception as erreur:  # noqa: BLE001 - filet de sécurité ultime
            etat = {
                "id": definition["id"], "libelle": definition.get("libelle", definition["id"]),
                "etat": "KO", "message": f"erreur inattendue : {erreur}"[:300], "tentatives": [],
                "source_utilisee": None, "secours_utilise": False, "ancienne": True,
                "points": 0, "premiere_date": None, "derniere_date": None, "derniere_valeur": None,
            }
        etat["categorie"] = "marche"
        etat["verifie_le"] = horodatage()
        journal(
            f"  [{etat['etat']}] {etat['id']:<16} {etat.get('derniere_date') or '—':<10} "
            f"{etat.get('derniere_valeur')!s:<12} {etat.get('source_utilisee') or etat['message'][:80]}"
        )
        etats.append(etat)
    return etats
