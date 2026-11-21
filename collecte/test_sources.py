"""Phase 0 — banc d'essai des sources de données.

Usage :  python collecte/test_sources.py [--societe aedifica]

Interroge chaque source (principales et secours) décrite dans la configuration,
plus quelques sources écartées pour mémoire, et écrit le résultat dans
RAPPORT_SOURCES.md : OK/KO, nombre de points, première date, dernière date,
dernière valeur. À lancer en local ET dans GitHub Actions (workflow « Test des
sources de données ») : certaines sources, Yahoo notamment, se comportent
différemment depuis les serveurs de GitHub.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources  # noqa: E402
from outils import RACINE, charger_config, maintenant  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DEPUIS = "2014-01-01"


def essais_de_la_config(config: dict) -> list[tuple]:
    """(indicateur, rôle, libellé de la source, fonction) pour chaque source de la config."""
    essais = []
    for serie in config["series"]:
        for rang, source in enumerate(serie["sources"]):
            role = "principale" if rang == 0 else f"secours {rang}"
            essais.append((serie["libelle"], role, source.get("nom", source["type"]),
                           lambda s=source: sources.lire_serie(s, DEPUIS)))
    for locataire in (config.get("locataires") or {}).get("liste", []):
        if locataire.get("symbole"):
            essais.append((f"Locataire : {locataire['nom']}", "principale", f"Yahoo Finance ({locataire['symbole']})",
                           lambda s=locataire["symbole"]: sources.yahoo.lire(s, DEPUIS)))
        if locataire.get("isin"):
            essais.append((f"Locataire : {locataire['nom']}", "secours 1", "Euronext (site officiel)",
                           lambda l=locataire: sources.euronext.lire(l["isin"], l.get("marche", "XBRU"))))
    reglages = config["actualites"]
    for flux in reglages.get("flux_officiels", []):
        essais.append(("Communiqués officiels", "principale", flux["url"], lambda u=flux["url"]: sources.publications.lire(u)))
    for langue in reglages["langues"]:
        essais.append((f"Presse ({langue})", "principale", "Google Actualités (RSS)",
                       lambda l=langue: sources.rss.google_news(reglages["requetes"][0], l)))
    return essais


def essais_pour_memoire(config: dict) -> list[tuple]:
    """Sources testées puis écartées (ou gardées seulement pour le contrôle croisé)."""
    import io

    import pandas as pd

    from sources.commun import SourceErreur, nettoyer, telecharger

    def stooq(symbole):
        texte = telecharger("https://stooq.com/q/d/l/", params={"s": symbole, "i": "d"}).text.strip()
        if not texte.lower().startswith("date"):
            raise SourceErreur("Stooq ne renvoie plus de CSV sans clé (page HTML à la place)")
        table = pd.read_csv(io.StringIO(texte))
        return nettoyer(pd.Series(table["Close"].values, index=pd.to_datetime(table["Date"])))

    return [
        ("Cours AED", "écartée", "Stooq (aed.be)", lambda: stooq("aed.be")),
        ("VSTOXX", "écartée", "Yahoo Finance (^V2TX)", lambda: sources.yahoo.lire("^V2TX", DEPUIS)),
        ("Inflation zone euro", "écartée", "Eurostat prc_hicp_manr (ancienne série)",
         lambda: sources.eurostat.lire("prc_hicp_manr", {"geo": "EA", "coicop": "CP00"}, DEPUIS)),
        ("EUR/GBP", "contrôle", "Yahoo Finance (EURGBP=X)", lambda: sources.yahoo.lire("EURGBP=X", DEPUIS)),
    ]


def _nombre(valeur) -> str:
    return f"{valeur:,.4f}".replace(",", " ").replace(".", ",").rstrip("0").rstrip(",")


def tester(essai) -> dict:
    indicateur, role, libelle, fonction = essai
    depart = time.time()
    ligne = {"indicateur": indicateur, "role": role, "source": libelle}
    try:
        resultat = sources.avec_reprises(fonction, essais=2, attente=3)
        if isinstance(resultat, list):  # liste de publications ou d'entrées RSS
            if not resultat:
                raise sources.SourceErreur("liste vide")
            dates = []
            for element in resultat:
                if isinstance(element, dict) and element.get("date"):
                    dates.append(element["date"])
                elif getattr(element, "published_parsed", None):
                    dates.append(datetime(*element.published_parsed[:6]).strftime("%Y-%m-%d"))
            dates.sort()
            premier = resultat[0]
            titre = premier.get("titre") if isinstance(premier, dict) else premier.get("title", "")
            fr = lambda iso: f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}"  # noqa: E731
            ligne.update(etat="OK", points=len(resultat), premiere=fr(dates[0]) if dates else "—",
                         derniere=fr(dates[-1]) if dates else "—", valeur=(titre or "")[:60])
        else:
            ligne.update(etat="OK", points=len(resultat), premiere=f"{resultat.index[0]:%d/%m/%Y}",
                         derniere=f"{resultat.index[-1]:%d/%m/%Y}", valeur=_nombre(resultat.iloc[-1]))
    except Exception as erreur:  # noqa: BLE001
        ligne.update(etat="KO", points=0, premiere="—", derniere="—", valeur=f"{type(erreur).__name__} : {erreur}"[:150])
    ligne["duree"] = round(time.time() - depart, 1)
    print(f"[{ligne['etat']}] {indicateur[:34]:<34} {role:<10} {libelle[:58]:<58} {ligne['points']:>6}  {ligne['derniere']}  {ligne['valeur']}")
    return ligne


def main() -> int:
    arguments = argparse.ArgumentParser(description="Banc d'essai des sources de données")
    arguments.add_argument("--societe", default="aedifica")
    options = arguments.parse_args()
    config = charger_config(options.societe)

    sur_github = bool(os.environ.get("GITHUB_ACTIONS"))
    lieu = "GitHub Actions" if sur_github else "en local (PC)"
    lignes = [tester(e) for e in essais_de_la_config(config) + essais_pour_memoire(config)]
    utiles = [l for l in lignes if l["role"] not in ("écartée",)]
    ok = sum(1 for l in utiles if l["etat"] == "OK")

    bloc = [
        f"### Essai du {maintenant():%d/%m/%Y à %H:%M} — {lieu}",
        "",
        f"**{ok} sources utilisées sur {len(utiles)} répondent** (les sources « écartées » sont testées pour mémoire).",
        "",
        "| Indicateur | Rôle | Source | État | Points | Première date | Dernière date | Dernière valeur / erreur | Durée (s) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for l in lignes:
        etat = "✅ OK" if l["etat"] == "OK" else "❌ KO"
        bloc.append(f"| {l['indicateur']} | {l['role']} | {l['source']} | {etat} | {l['points']} | {l['premiere']} | "
                    f"{l['derniere']} | {str(l['valeur']).replace('|', '/')} | {l['duree']} |")
    bloc.append("")

    # Le rapport garde sa partie rédigée (au-dessus) et un bloc par lieu d'essai (en dessous).
    fichier = RACINE / "RAPPORT_SOURCES.md"
    marqueur = f"<!-- essai:{'actions' if sur_github else 'local'} -->"
    fin = marqueur.replace("essai:", "fin:")
    texte = fichier.read_text(encoding="utf-8") if fichier.exists() else "# Rapport des sources de données\n"
    nouveau = "\n".join([marqueur, *bloc, fin])
    if marqueur in texte and fin in texte:
        avant, reste = texte.split(marqueur, 1)
        texte = avant + nouveau + reste.split(fin, 1)[1]
    else:
        texte = texte.rstrip() + "\n\n" + nouveau + "\n"
    fichier.write_text(texte, encoding="utf-8", newline="\n")
    print(f"\n{ok}/{len(utiles)} sources utilisées OK — rapport écrit dans {fichier.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
