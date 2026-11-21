"""Chef d'orchestre de la collecte.

Usage :
    python collecte/run.py --societe aedifica            (mise à jour quotidienne, incrémentale)
    python collecte/run.py --societe aedifica --complet  (première fois ou réparation : recharge tout l'historique)

Chaque étape est isolée : si une source tombe, les autres continuent et
l'application affiche la dernière valeur valide connue (jamais de donnée inventée,
jamais de donnée valide écrasée par du vide). Le détail est écrit dans
data/<societe>/etat_sources.json.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import actualites  # noqa: E402
import calculs  # noqa: E402
import ia  # noqa: E402
import locataires  # noqa: E402
import marche  # noqa: E402
import rapports  # noqa: E402
from outils import charger_config, dossier_donnees, ecrire_json, horodatage, lire_json  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def etape(nom: str, fonction, etats: list[dict], identifiant: str, categorie: str, defaut=None):
    """Exécute une étape ; en cas d'erreur inattendue, la note et continue."""
    print(f"\n— {nom}")
    try:
        return fonction()
    except Exception as erreur:  # noqa: BLE001 - rien ne doit arrêter la collecte
        traceback.print_exc()
        etats.append({
            "id": identifiant, "libelle": nom, "categorie": categorie, "etat": "KO",
            "message": f"erreur inattendue : {erreur}"[:300], "verifie_le": horodatage(),
        })
        return defaut


def main() -> int:
    arguments = argparse.ArgumentParser(description="Collecte des données du tableau de bord")
    arguments.add_argument("--societe", default="aedifica", help="identifiant de la société (fichier societes/<id>.json)")
    arguments.add_argument("--complet", action="store_true", help="recharge tout l'historique (première fois ou réparation)")
    arguments.add_argument("--sans-actualites", action="store_true", help="saute les actualités et les locataires (essais rapides)")
    options = arguments.parse_args()

    depart = time.time()
    config = charger_config(options.societe)
    dossier = dossier_donnees(options.societe)
    print(f"Collecte « {config['nom']} » — {horodatage()}{' (rechargement complet)' if options.complet else ''}")
    etats: list[dict] = []

    # 1. Séries de marché (cours, taux, indices)
    etats += etape("Marchés : cours, taux, indices", lambda: marche.collecter(config, dossier, options.complet),
                   etats, "marche", "marche", defaut=[]) or []

    contexte = {
        "actualites": lire_json(dossier / "actualites.json", {}),
        "locataires": lire_json(dossier / "locataires.json", {}),
    }
    if not options.sans_actualites:
        # 2. Actualités (communiqués officiels + presse)
        resultat = etape("Actualités", lambda: actualites.collecter(config, dossier), etats, "actualites", "actualites")
        if resultat:
            contexte["actualites"], etats_actus = resultat
            etats += etats_actus

        # 3. Locataires (cours des exploitants cotés + veille des risques)
        resultat = etape("Locataires", lambda: locataires.collecter(config, dossier, options.complet),
                         etats, "locataires", "locataires")
        if resultat:
            contexte["locataires"], etats_locataires = resultat
            etats += etats_locataires

        # 4. Nouveaux rapports financiers (chiffres candidats à valider)
        avec_ia = ia.disponible(config)
        resultat = etape(
            "Surveillance des rapports financiers",
            lambda: rapports.surveiller(
                config, dossier, extraction_ia=(lambda pages: ia.extraire_rapport(config, pages)) if avec_ia else None
            ),
            etats, "rapports", "rapports",
        )
        if resultat is not None:
            etats.append({
                "id": "rapports", "libelle": "Page des rapports financiers de la société", "categorie": "rapports",
                "etat": "OK", "elements": resultat["nouveaux"], "verifie_le": horodatage(),
                "message": f"{resultat['nouveaux']} nouveau(x) rapport(s) à valider" if resultat["nouveaux"] else "",
            })

        # 5. Option IA : synthèse des actualités (seulement si une clé est configurée)
        if avec_ia and contexte["actualites"]:
            def synthese_ia():
                contenu = contexte["actualites"]
                nouvelle = ia.synthese_actualites(config, contenu)
                if nouvelle and nouvelle != contenu.get("synthese_ia"):
                    contenu["synthese_ia"] = nouvelle
                    ecrire_json(dossier / "actualites.json", contenu)
                    print("  synthèse IA mise à jour")
                return True

            if etape("Synthèse IA des actualités", synthese_ia, etats, "ia", "ia"):
                etats.append({"id": "ia", "libelle": "Synthèse IA (API Claude)", "categorie": "ia", "etat": "OK",
                              "message": "", "verifie_le": horodatage()})

    # 6. Date de dernière réussite de chaque source (conservée d'une exécution à l'autre)
    anciens = {e["id"]: e for e in (lire_json(dossier / "etat_sources.json", {}) or {}).get("sources", [])}
    for etat in etats:
        if etat["etat"] == "OK":
            etat["derniere_reussite"] = etat.get("verifie_le") or horodatage()
        else:
            etat["derniere_reussite"] = anciens.get(etat["id"], {}).get("derniere_reussite")
    if options.sans_actualites:  # on garde l'état connu des sources non interrogées cette fois-ci
        etats += [e for identifiant, e in anciens.items() if identifiant not in {x["id"] for x in etats}]

    # 7. Calculs et synthèse (toujours tentés, même si des sources ont échoué)
    synthese = etape("Calculs et synthèse", lambda: calculs.construire(config, dossier, etats, contexte),
                     etats, "calculs", "calculs")
    # synthese.json et etat_sources.json sont réécrits à chaque exécution : leur
    # horodatage « genere_le » prouve que la collecte a tourné (le bouton « Mettre à
    # jour » de l'application attend qu'il change).
    if synthese:
        ecrire_json(dossier / "synthese.json", synthese, toujours=True)

    ok = sum(1 for e in etats if e["etat"] == "OK")
    ecrire_json(dossier / "etat_sources.json", {
        "genere_le": horodatage(),
        "duree_secondes": round(time.time() - depart, 1),
        "resume": {"ok": ok, "ko": len(etats) - ok, "total": len(etats)},
        "sources": etats,
    }, toujours=True)

    print(f"\nTerminé en {time.time() - depart:.0f} s — {ok}/{len(etats)} sources OK")
    for etat in etats:
        if etat["etat"] != "OK":
            print(f"  KO  {etat['id']} : {etat.get('message', '')[:160]}")
    if not synthese:
        print("ERREUR : synthese.json n'a pas pu être produit.")
        return 1
    print(f"État global : {synthese['etat_global']['niveau']} — {synthese['etat_global']['message']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
