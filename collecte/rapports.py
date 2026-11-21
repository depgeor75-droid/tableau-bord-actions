"""Surveillance des rapports financiers et extraction des chiffres « candidats ».

Quand un nouveau rapport trimestriel apparaît sur la page des communiqués de la
société, ce script télécharge le PDF, y repère les chiffres clés par mots-clés
(pdfplumber) et les écrit dans `fondamentaux_a_valider.json`, avec le numéro de
page et la ligne d'origine. Rien n'est intégré automatiquement dans
`fondamentaux.json` : un humain (ou Claude Code) valide d'abord. L'application
affiche un bandeau « Nouveau rapport publié le … — chiffres à valider ».
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import sources
from outils import ecrire_json, horodatage, lire_json
from sources.commun import telecharger

N = r"(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?)"  # nombre au format belge : 12.587 ou 79,19
G = r"(\d{1,3}(?:\.\d{3}){2,})"  # grand nombre entier (millions) : 92.632.604

# champ -> liste de motifs (le premier qui correspond gagne). Le 1er groupe = la
# valeur de la période du rapport (toujours la première colonne du tableau).
MOTIFS: dict[str, list[str]] = {
    "nta_par_action": [rf"^EPRA NTA\*? \(en €/action\)(?: \(part du groupe\))? {N}"],
    "epra_nav_par_action": [rf"^EPRA (?:NAV|VAN)\*? \(en €/action\)(?: \(part du groupe\))? {N}"],
    "van_ifrs_par_action": [
        rf"^IFRS NAV \(en €/action\) {N}",
        rf"^Actif net(?: après (?:répartition|déduction) du dividende(?: intérimaire)?(?: \d{{4}}(?:/\d{{4}})?)?)? {N} {N}$",
    ],
    "actif_net_hors_couverture_par_action": [
        rf"^Actif net,? hors variations de juste valeur des instruments de couverture\*? {N}",
        rf"^Actif net(?: après déduction du dividende \d{{4}}/\d{{4}},)? hors IAS 39 {N}",
        rf"^Actif net après déduction du dividende[^,]*, hors variations de juste valeur des instruments de {N} {N}$",
    ],
    "nombre_actions": [
        rf"^Nombre (?:total )?d.actions cotées en bourse ?°? ?(?:\d )?{G}",
        rf"^Nombre d.actions en circulation \(hors actions propres\) {G}",
    ],
    "taux_endettement": [
        rf"^Taux d.endettement \(en %\) {N} ?%",
        rf"Taux d.endettement (?:consolidé )?de {N} ?%",
    ],
    "epra_ltv": [rf"^EPRA LTV\*? {N} ?%"],
    "cout_moyen_dette": [rf"^Coût moyen de la dette\* \(en %\) {N} ?%"],
    "cout_moyen_dette_commissions": [
        rf"^Coût moyen de la dette\* \(y compris la commission.*? {N} ?% {N} ?%$",
        rf"Coût moyen de la dette\*?,? (?:y compris|frais d.engagement compris).*? de {N} ?%",
    ],
    "ratio_couverture": [rf"^Taux de couverture \(en %\) {N} ?%"],
    "juste_valeur_total": [rf"^Juste valeur du patrimoine immobilier\* \(en millions €\)(?: \d)? {N}"],
    "juste_valeur_sante": [rf"^Immobilier de santé \d[\d.]* {N} "],
    "juste_valeur_bureaux": [rf"^Bureaux \d[\d.]* {N} "],
    "juste_valeur_distribution": [rf"^Réseaux de distribution \d[\d.]* {N} "],
    "actifs_detenus_vente": [rf"^(?:A\. |\+ )Actifs détenus en vue de la vente (?:\d )?(\d{{1,3}}(?:\.\d{{3}})+)"],
    "taux_occupation": [rf"^Taux d.occupation \(en %\) {N} ?%"],
    "wault": [rf"^WAULT \(en années\) {N}"],
    "epra_eps_periode": [rf"^EPRA Earnings\* \(en €/action\) {N}"],
    "epra_eps_prevision": [
        rf"^EPRA Earnings\* par action {N} ?€",
        rf"EPRA Earnings\*? pour \d{{4}} (?:est )?estimé.*?soit {N} ?€(?:/| par )action",
    ],
    "dividende_prevu": [rf"^Dividende brut {N} ?€", rf"[Dd]ividende (?:brut )?(?:proposé|de) .*?{N} ?€"],
}
UNITES = {
    "nta_par_action": "€", "epra_nav_par_action": "€", "van_ifrs_par_action": "€",
    "actif_net_hors_couverture_par_action": "€", "nombre_actions": "", "taux_endettement": "%",
    "epra_ltv": "%", "cout_moyen_dette": "%", "cout_moyen_dette_commissions": "%", "ratio_couverture": "%",
    "juste_valeur_total": "M€", "juste_valeur_sante": "k€", "juste_valeur_bureaux": "k€",
    "juste_valeur_distribution": "k€", "actifs_detenus_vente": "k€", "taux_occupation": "%",
    "wault": "ans", "epra_eps_periode": "€", "epra_eps_prevision": "€", "dividende_prevu": "€",
}


def nombre(texte: str) -> float:
    """'12.587' -> 12587.0 ; '79,19' -> 79.19 ; '92.632.604' -> 92632604.0"""
    return float(texte.replace(".", "").replace(",", "."))


def texte_des_pages(contenu_pdf: bytes, pages_max: int = 120) -> list[str]:
    import pdfplumber

    with pdfplumber.open(io.BytesIO(contenu_pdf)) as pdf:
        return [(page.extract_text() or "") for page in pdf.pages[:pages_max]]


def extraire(pages: list[str]) -> dict:
    """Cherche chaque chiffre clé dans le texte. Renvoie {champ: {valeur, page, extrait}}."""
    trouves: dict[str, dict] = {}
    for numero, texte in enumerate(pages, start=1):
        lignes = [ligne.strip() for ligne in texte.splitlines()]
        for position, ligne in enumerate(lignes):
            # Libellé coupé sur deux lignes : les nombres sont sur la ligne suivante
            if (
                "actif_net_hors_couverture_par_action" not in trouves
                and ligne.startswith("Actif net")
                and "hors variations" in ligne
                and not re.search(r"\d,\d\d$", ligne)
                and position + 1 < len(lignes)
            ):
                suite = re.match(rf"^{N} {N}$", lignes[position + 1])
                if suite:
                    trouves["actif_net_hors_couverture_par_action"] = {
                        "valeur": nombre(suite.group(1)), "page": numero,
                        "extrait": f"{ligne} {lignes[position + 1]}"[:160],
                    }
            for champ, motifs in MOTIFS.items():
                if champ in trouves:
                    continue
                for motif in motifs:
                    correspondance = re.search(motif, ligne)
                    if correspondance:
                        trouves[champ] = {
                            "valeur": nombre(correspondance.group(1)), "page": numero, "extrait": ligne[:160],
                        }
                        break
    for champ, resultat in trouves.items():
        resultat["unite"] = UNITES.get(champ, "")
    return trouves


def periode_du_titre(titre: str, date_publication: str) -> str:
    """Devine la période couverte (« T3 2026 », « S1 2026 », « Annuel 2025 ») d'après le titre."""
    annee = re.search(r"(20\d\d)(?:/(20\d\d))?", titre)
    millesime = annee.group(0) if annee else date_publication[:4]
    if re.search(r"Q([1-5])|(\d)er? trimestre|(\d)e trimestre", titre, re.I):
        rang = re.search(r"Q([1-5])", titre, re.I)
        return f"T{rang.group(1)} {millesime}" if rang else f"Trimestre {millesime}"
    if re.search(r"semestriel", titre, re.I):
        return f"S1 {millesime}"
    if re.search(r"annuel", titre, re.I):
        return f"Annuel {millesime}"
    return millesime


def lister(config: dict) -> list[dict]:
    """Rapports de résultats publiés sur la page de la société (du plus récent au plus ancien)."""
    reglages = config["rapports"]
    garder = re.compile(reglages["motif_titre"], re.I)
    exclure = re.compile(reglages["exclure_titre"], re.I) if reglages.get("exclure_titre") else None
    return [
        publication
        for publication in sources.publications.lire(reglages["page"])
        if garder.search(publication["titre"]) and not (exclure and exclure.search(publication["titre"]))
    ]


def surveiller(config: dict, dossier: Path, journal=print, extraction_ia=None) -> dict:
    """Détecte les rapports plus récents que le dernier intégré dans fondamentaux.json."""
    fondamentaux = lire_json(dossier / "fondamentaux.json", {}) or {}
    integres = {t.get("rapport", {}).get("url") for t in fondamentaux.get("trimestres", [])}
    derniere = max((t.get("date_publication", "") for t in fondamentaux.get("trimestres", [])), default="")
    chemin = dossier / "fondamentaux_a_valider.json"
    ancien = lire_json(chemin, {}) or {}
    deja_extraits = {r["url"]: r for r in ancien.get("rapports", [])}

    nouveaux = [r for r in lister(config) if r["date"] > derniere and r["url"] not in integres]
    resultat = []
    for rapport in nouveaux:
        if rapport["url"] in deja_extraits:  # déjà analysé lors d'une exécution précédente
            resultat.append(deja_extraits[rapport["url"]])
            continue
        fiche = {
            "titre": rapport["titre"], "date_publication": rapport["date"], "url": rapport["url"],
            "periode": periode_du_titre(rapport["titre"], rapport["date"]), "candidats": {}, "erreur": None,
        }
        try:
            contenu = sources.avec_reprises(lambda u=rapport["url"]: telecharger(u).content)
            pages = texte_des_pages(contenu)
            fiche["candidats"] = extraire(pages)
            if extraction_ia:  # option IA : seconde lecture, à comparer avec la première
                try:
                    fiche["candidats_ia"] = extraction_ia(pages)
                except Exception as erreur:  # noqa: BLE001
                    fiche["erreur_ia"] = str(erreur)[:200]
        except Exception as erreur:  # noqa: BLE001
            fiche["erreur"] = f"extraction impossible : {erreur}"[:200]
        journal(f"  nouveau rapport : {rapport['date']} {rapport['titre']} ({len(fiche['candidats'])} chiffres candidats)")
        resultat.append(fiche)

    ecrire_json(
        chemin,
        {
            "genere_le": horodatage(),
            "explication": "Chiffres repérés automatiquement dans les nouveaux rapports. À valider avant "
            "intégration dans fondamentaux.json (voir README, « Intégrer un nouveau rapport »).",
            "dernier_rapport_integre": derniere or None,
            "rapports": resultat,
        },
    )
    return {"nouveaux": len(resultat), "dernier_integre": derniere}
