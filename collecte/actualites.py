"""Actualités : communiqués officiels de la société + presse (Google Actualités).

On ne stocke JAMAIS le texte des articles de presse (droits d'auteur) : seulement
le titre, la source, la date et le lien. Le fichier est cumulatif : les articles
déjà connus sont conservés d'une exécution à l'autre.
"""
from __future__ import annotations

import hashlib
import html
import io
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

import sources
from outils import FUSEAU, ecrire_json, horodatage, lire_json, maintenant
from sources.commun import telecharger

MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
ENTETE_PDF = re.compile(
    r"COMMUNIQU[ÉE] DE PRESSE|Information (réglementée|privilégiée)|^Le \d|^AEDIFICA$|Société anonyme|"
    r"Société immobilière|^Siège|Numéro d.entreprise|la « Société »|^\d+ ?/ ?\d+$|[Ss]ous embargo|après clôture|avant ouverture",
)


def normaliser(texte: str) -> str:
    """Minuscules, sans accents ni ponctuation : sert à comparer des titres."""
    texte = unicodedata.normalize("NFKD", texte or "").encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", " ", texte).strip()


def identifiant(titre: str, date: str) -> str:
    return hashlib.sha1(f"{normaliser(titre)[:80]}|{date[:7]}".encode()).hexdigest()[:12]


def categoriser(texte: str, mots_cles: dict) -> str:
    """Première catégorie (dans l'ordre de la config) dont un mot-clé figure dans le texte."""
    cible = f" {texte.lower()} "
    for categorie, mots in mots_cles.items():
        if any(mot.lower() in cible for mot in mots):
            return categorie
    return "autres"


def _date_entree(entree) -> str | None:
    instant = getattr(entree, "published_parsed", None) or getattr(entree, "updated_parsed", None)
    if not instant:
        return None
    return datetime(*instant[:6], tzinfo=timezone.utc).astimezone(FUSEAU).strftime("%Y-%m-%d")


def _presse(config: dict, etats: list[dict]) -> list[dict]:
    reglages = config["actualites"]
    obligatoires = [normaliser(m) for m in reglages.get("mots_obligatoires", [])]
    ignorees = {normaliser(s) for s in reglages.get("sources_ignorees", [])}
    titres_ignores = [normaliser(t) for t in reglages.get("titres_ignores", [])]
    articles = []
    for langue in reglages["langues"]:
        etat = {"id": f"presse_{langue}", "libelle": f"Presse ({langue.upper()}) — Google Actualités",
                "categorie": "actualites", "etat": "OK", "message": "", "elements": 0}
        erreurs = []
        for requete in reglages["requetes"]:
            try:
                entrees = sources.avec_reprises(lambda r=requete, l=langue: sources.rss.google_news(r, l), essais=2)
            except Exception as erreur:  # noqa: BLE001
                erreurs.append(f"« {requete} » : {erreur}"[:150])
                continue
            for entree in entrees:
                source = (getattr(entree, "source", None) or {}).get("title", "") if hasattr(entree, "source") else ""
                titre = html.unescape(getattr(entree, "title", "") or "").strip()
                if source and titre.endswith(f" - {source}"):
                    titre = titre[: -len(source) - 3].strip()
                date = _date_entree(entree)
                cle = normaliser(titre)
                if not titre or not date:
                    continue
                if obligatoires and not any(mot in cle for mot in obligatoires):
                    continue
                if normaliser(source) in ignorees or any(t in cle for t in titres_ignores):
                    continue
                articles.append({
                    "id": identifiant(titre, date), "date": date, "titre": titre, "source": source or "Presse",
                    "lien": getattr(entree, "link", ""), "langue": langue, "extrait": "", "officiel": False,
                })
                etat["elements"] += 1
            time.sleep(0.4)
        if erreurs and etat["elements"] == 0:
            etat.update(etat="KO", message=" ; ".join(erreurs)[:300])
        elif erreurs:
            etat["message"] = "réponse partielle : " + " ; ".join(erreurs)[:250]
        etats.append(etat)
    return articles


def _officiels(config: dict, etats: list[dict]) -> list[dict]:
    reglages = config["actualites"]
    depuis = reglages.get("officiels_depuis", "2025-01-01")
    articles = []
    for flux in reglages.get("flux_officiels", []):
        etat = {"id": f"officiel_{flux.get('langue', 'fr')}", "libelle": flux.get("source", "Communiqués officiels"),
                "categorie": "actualites", "etat": "OK", "message": "", "elements": 0}
        try:
            publications = sources.avec_reprises(lambda u=flux["url"]: sources.publications.lire(u), essais=3)
            for publication in publications:
                if publication["date"] < depuis:
                    continue
                articles.append({
                    "id": identifiant(publication["titre"], publication["date"]), "date": publication["date"],
                    "titre": publication["titre"], "source": flux.get("source", "Communiqué officiel"),
                    "lien": publication["url"], "langue": flux.get("langue", "fr"), "extrait": "", "officiel": True,
                })
                etat["elements"] += 1
        except Exception as erreur:  # noqa: BLE001
            etat.update(etat="KO", message=str(erreur)[:300])
        etats.append(etat)
    return articles


def extrait_pdf(url: str, titre: str = "", longueur: int = 320) -> str:
    """Premières phrases d'un communiqué officiel (PDF), hors en-tête administratif et hors titre."""
    import pdfplumber

    with pdfplumber.open(io.BytesIO(telecharger(url).content)) as pdf:
        texte = pdf.pages[0].extract_text() or ""
    lignes = [l.strip() for l in texte.splitlines() if l.strip() and not ENTETE_PDF.search(l.strip())]
    titre_normalise = normaliser(titre)
    while len(lignes) > 2 and titre_normalise and normaliser(lignes[0]) and (
        normaliser(lignes[0]) in titre_normalise or titre_normalise in normaliser(lignes[0])
    ):
        lignes.pop(0)  # le titre du communiqué, parfois réparti sur plusieurs lignes
    corps = re.sub(r"\s+", " ", " ".join(lignes)).strip()
    corps = re.sub(r"^[-–•] ?", "", corps)
    if len(corps) <= longueur:
        return corps
    coupe = corps[:longueur]
    return coupe[: coupe.rfind(" ")].rstrip(" ,;:-") + "…"


def _dedoublonner(articles: list[dict]) -> list[dict]:
    """Google Actualités renvoie souvent le même article plusieurs fois (et dans
    plusieurs recherches). On garde le premier ; un communiqué officiel prime."""
    articles = sorted(articles, key=lambda a: (not a["officiel"], a["date"]))
    vus: dict[str, str] = {}
    gardes = []
    for article in articles:
        cle = normaliser(article["titre"])[:70]
        if cle in vus and abs((pd.Timestamp(article["date"]) - pd.Timestamp(vus[cle])).days) <= 5:
            continue
        vus[cle] = article["date"]
        gardes.append(article)
    return gardes


def _statistiques(articles: list[dict], config: dict, mois_affiches: int) -> dict:
    fin = maintenant().date()
    debut = (pd.Timestamp(fin) - pd.DateOffset(months=mois_affiches)).date()
    recents = [a for a in articles if str(debut) <= a["date"] <= str(fin)]
    categories = list(config.get("libelles_categories", {}).keys())
    compteurs = {c: sum(1 for a in recents if a["categorie"] == c) for c in categories}
    par_mois = []
    curseur = pd.Timestamp(debut).replace(day=1)
    while curseur <= pd.Timestamp(fin):
        cle = curseur.strftime("%Y-%m")
        du_mois = [a for a in recents if a["date"].startswith(cle)]
        par_mois.append({
            "mois": cle, "libelle": f"{MOIS[curseur.month - 1]} {curseur.year % 100:02d}", "total": len(du_mois),
            "officiels": sum(1 for a in du_mois if a["officiel"]),
            "par_categorie": {c: sum(1 for a in du_mois if a["categorie"] == c) for c in categories if any(a["categorie"] == c for a in du_mois)},
        })
        curseur += pd.DateOffset(months=1)
    return {
        "debut": str(debut), "fin": str(fin), "total": len(recents),
        "officiels": sum(1 for a in recents if a["officiel"]),
        "compteurs": compteurs, "par_mois": par_mois,
        "derniers_officiels": [a["id"] for a in recents if a["officiel"]][:5],
    }


def collecter(config: dict, dossier: Path, journal=print) -> tuple[dict, list[dict]]:
    """Met à jour actualites.json. Renvoie (contenu, états des sources)."""
    etats: list[dict] = []
    reglages = config["actualites"]
    chemin = dossier / "actualites.json"
    ancien = lire_json(chemin, {}) or {}
    connus = {a["id"]: a for a in ancien.get("articles", [])}

    nouveaux = _dedoublonner(_officiels(config, etats) + _presse(config, etats))
    for article in nouveaux:
        article["categorie"] = categoriser(article["titre"], config.get("mots_cles_categories", {}))
        if article["id"] in connus:  # on garde ce qu'on savait déjà (extrait, date de première vue)
            article["extrait"] = connus[article["id"]].get("extrait", "")
            article["vu_le"] = connus[article["id"]].get("vu_le")
        else:
            article["vu_le"] = maintenant().strftime("%Y-%m-%d")
        connus[article["id"]] = article

    limite = (maintenant() - timedelta(days=31 * reglages.get("mois_archive", 24))).strftime("%Y-%m-%d")
    articles = sorted(
        _dedoublonner([a for a in connus.values() if a["date"] >= limite]),
        key=lambda a: (a["date"], a["officiel"]), reverse=True,
    )

    # Court extrait pour les derniers communiqués officiels (lu dans le PDF, une seule fois)
    for article in [a for a in articles if a["officiel"]][:6]:
        if not article.get("extrait") and article["lien"].lower().endswith(".pdf"):
            try:
                article["extrait"] = extrait_pdf(article["lien"], article["titre"])
            except Exception:  # noqa: BLE001 - l'extrait est un plus, jamais bloquant
                article["extrait"] = ""

    contenu = {
        "genere_le": horodatage(),
        "mois_affiches": reglages.get("mois_affiches", 6),
        "categories": config.get("libelles_categories", {}),
        "synthese": _statistiques(articles, config, reglages.get("mois_affiches", 6)),
        "synthese_ia": ancien.get("synthese_ia"),
        "articles": articles,
    }
    ecrire_json(chemin, contenu)
    for etat in etats:
        etat["verifie_le"] = horodatage()
        journal(f"  [{etat['etat']}] {etat['id']:<16} {etat['elements']:>4} éléments  {etat['message'][:90]}")
    return contenu, etats
