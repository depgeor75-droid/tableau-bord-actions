"""Tous les calculs de l'application (cahier des charges § 3.2 : le JavaScript ne
fait que de l'affichage). Produit `synthese.json` et les historiques calculés.

Formules (§ 4.5) :
  décote/prime (%)          = (cours ÷ NTA par action − 1) × 100
  capitalisation            = cours × nombre d'actions
  rendement du dividende    = dividende brut de l'exercice ÷ cours × 100
  écart dividende – Bund    = rendement brut − Bund 10 ans
  multiple                  = cours ÷ EPRA EPS de l'exercice
Pas de « triche » avec le futur : à une date passée, on utilise la dernière NTA
PUBLIÉE avant cette date (date de publication du rapport, pas date de clôture).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from outils import arrondi, chemin_serie, ecrire_serie_csv, horodatage, iso, lire_json, lire_serie_csv, maintenant

PERIODES = {
    "1m": pd.DateOffset(months=1),
    "1a": pd.DateOffset(years=1),
    "5a": pd.DateOffset(years=5),
    "10a": pd.DateOffset(years=10),
}
ANNEES = {"1m": 1 / 12, "1a": 1, "5a": 5, "10a": 10}
TOLERANCE = {"jour": 10, "mois": 45}  # écart maximal (jours) entre la date cible et l'observation retenue
EN_POINTS = {"taux", "ecart", "ratio"}  # variation en points de pourcentage (jamais en %)
AVEC_PB = {"taux", "ecart"}  # … et aussi en points de base


# ----------------------------------------------------------- fondamentaux → séries
def _valeur(trimestre: dict, champ: str):
    donnee = (trimestre.get("valeurs") or {}).get(champ)
    return donnee.get("valeur") if isinstance(donnee, dict) else None


def serie_publiee(fondamentaux: dict, champ: str) -> pd.Series:
    """Valeur connue du marché à chaque date : elle ne prend effet que le lendemain
    de la publication du rapport (beaucoup sont publiés après la clôture)."""
    points = {}
    for trimestre in sorted(fondamentaux.get("trimestres", []), key=lambda t: t["date_publication"]):
        valeur = _valeur(trimestre, champ)
        if valeur is not None:
            points[pd.Timestamp(trimestre["date_publication"]) + pd.Timedelta(days=1)] = float(valeur)
    return pd.Series(points, dtype=float).sort_index()


def serie_actions(fondamentaux: dict) -> pd.Series:
    """Nombre d'actions à chaque date : arrêtés trimestriels + opérations datées."""
    points = {}
    for trimestre in fondamentaux.get("trimestres", []):
        valeur = _valeur(trimestre, "nombre_actions")
        if valeur is not None:
            points[pd.Timestamp(trimestre["date_cloture"])] = float(valeur)
    for evenement in fondamentaux.get("evenements_actions", []):
        points[pd.Timestamp(evenement["date"])] = float(evenement["nombre"])
    return pd.Series(points, dtype=float).sort_index()


def series_exercices(fondamentaux: dict, index: pd.DatetimeIndex) -> tuple[pd.Series, pd.Series]:
    """Dividende brut et EPRA EPS (ramenés à 12 mois) de l'exercice en cours à chaque date."""
    dividende = pd.Series(float("nan"), index=index)
    resultat = pd.Series(float("nan"), index=index)
    for exercice in fondamentaux.get("exercices", []):
        masque = (index >= pd.Timestamp(exercice["debut"])) & (index <= pd.Timestamp(exercice["fin"]))
        facteur = 12 / exercice.get("mois", 12)
        if exercice.get("dividende_brut") is not None:
            dividende[masque] = exercice["dividende_brut"] * facteur
        if exercice.get("epra_eps") is not None:
            resultat[masque] = exercice["epra_eps"] * facteur
    return dividende, resultat


def _aligner(pas: pd.Series, index: pd.DatetimeIndex) -> pd.Series:
    """Projette une série « en escalier » (trimestrielle, mensuelle…) sur des dates quotidiennes."""
    if pas.empty:
        return pd.Series(float("nan"), index=index)
    return pas.reindex(pas.index.union(index)).ffill().reindex(index)


# -------------------------------------------------------------- comparaisons
def _impact(variation, sens: str) -> str:
    """Couleur selon l'effet sur la société, pas selon le signe (§ 4.1)."""
    if variation is None or abs(variation) < 1e-9 or sens not in ("hausse", "baisse"):
        return "neutre"
    return "favorable" if (variation > 0) == (sens == "hausse") else "defavorable"


def comparer(serie: pd.Series, genre: str, sens: str, frequence: str = "jour") -> tuple[dict | None, dict]:
    """Valeur actuelle + valeur et variation il y a 1 mois, 1 an, 5 ans, 10 ans."""
    serie = serie.dropna()
    if serie.empty:
        vide = {cle: {"valeur": None, "raison": "donnée non disponible"} for cle in PERIODES}
        return None, vide
    date_actuelle, actuel = serie.index[-1], float(serie.iloc[-1])
    resultat = {}
    for cle, recul in PERIODES.items():
        cible = date_actuelle - recul
        passe = serie[:cible]
        if cible < serie.index[0] - pd.Timedelta(days=TOLERANCE[frequence]) or passe.empty:
            resultat[cle] = {
                "valeur": None,
                "raison": f"historique disponible depuis le {serie.index[0]:%d/%m/%Y}",
            }
            continue
        if (cible - passe.index[-1]).days > TOLERANCE[frequence]:
            resultat[cle] = {"valeur": None, "raison": f"pas de donnée proche du {cible:%d/%m/%Y}"}
            continue
        ancien = float(passe.iloc[-1])
        fiche = {"valeur": arrondi(ancien, 6), "date_valeur": iso(passe.index[-1])}
        if genre in EN_POINTS:
            variation = actuel - ancien
            fiche.update(variation=arrondi(variation, 4), unite_variation="pt")
            if genre in AVEC_PB:
                fiche["variation_pb"] = arrondi(variation * 100, 1)
        else:
            if ancien == 0:
                resultat[cle] = {"valeur": arrondi(ancien, 6), "date_valeur": iso(passe.index[-1]), "variation": None}
                continue
            variation = (actuel / ancien - 1) * 100
            fiche.update(variation=arrondi(variation, 2), unite_variation="%")
            if genre == "rendement_total" and ANNEES[cle] > 1:
                fiche["annualise"] = arrondi(((actuel / ancien) ** (1 / ANNEES[cle]) - 1) * 100, 2)
        fiche["impact"] = _impact(fiche.get("variation"), sens)
        resultat[cle] = fiche
    return {"valeur": arrondi(actuel, 6), "date_valeur": iso(date_actuelle)}, resultat


# ------------------------------------------------------------------ synthèse
def construire(config: dict, dossier: Path, etats: list[dict], contexte: dict | None = None) -> dict:
    """Assemble synthese.json. `contexte` apporte actualités, locataires, rapports à valider."""
    contexte = contexte or {}
    fondamentaux = lire_json(dossier / "fondamentaux.json", {}) or {}
    etat_par_id = {e["id"]: e for e in etats}
    definitions = {d["id"]: d for d in config["series"]}
    brut = {d["id"]: lire_serie_csv(chemin_serie(dossier, d["id"])) for d in config["series"]}

    cours = brut.get("cours", pd.Series(dtype=float))
    index = cours.index
    calcule: dict[str, pd.Series] = {}
    formules: dict[str, str] = {}

    # --- séries calculées (quotidiennes, sur les dates de cotation de l'action)
    nta = _aligner(serie_publiee(fondamentaux, "nta_par_action"), index)
    actions = _aligner(serie_actions(fondamentaux), index)
    dividende, resultat = series_exercices(fondamentaux, index)
    bund = _aligner(brut.get("bund10", pd.Series(dtype=float)), index)

    calcule["decote_nta"] = ((cours / nta - 1) * 100).dropna()
    formules["decote_nta"] = "(cours ÷ dernière NTA publiée avant la date − 1) × 100"
    calcule["capitalisation"] = (cours * actions / 1e6).dropna()
    formules["capitalisation"] = "cours × nombre d'actions (dernier nombre connu à la date)"
    calcule["rendement_dividende"] = (dividende / cours * 100).dropna()
    formules["rendement_dividende"] = "dividende brut de l'exercice en cours à la date ÷ cours × 100"
    calcule["multiple"] = (cours / resultat).dropna()
    formules["multiple"] = "cours ÷ EPRA EPS de l'exercice en cours à la date (prévision pour l'exercice actuel)"
    calcule["ecart_dividende_bund"] = (calcule["rendement_dividende"] - bund).dropna()
    formules["ecart_dividende_bund"] = "rendement brut du dividende − Bund 10 ans"
    olo, bund_mensuel = brut.get("olo10", pd.Series(dtype=float)), brut.get("bund10_mensuel", pd.Series(dtype=float))
    calcule["ecart_olo_bund"] = (olo - bund_mensuel).dropna()
    formules["ecart_olo_bund"] = "OLO 10 ans − taux allemand à 10 ans (moyennes mensuelles BCE)"
    calcule["rendement_total"] = brut.get("cours_ajuste", pd.Series(dtype=float))
    formules["rendement_total"] = "variation du cours ajusté des dividendes (dividendes réinvestis)"

    for identifiant, serie in calcule.items():
        if identifiant != "rendement_total" and not serie.empty:
            ecrire_serie_csv(chemin_serie(dossier, identifiant), serie, decimales=4)

    dependances = {
        "decote_nta": ["cours"], "capitalisation": ["cours"], "rendement_dividende": ["cours"],
        "multiple": ["cours"], "ecart_dividende_bund": ["cours", "bund10"],
        "ecart_olo_bund": ["olo10", "bund10_mensuel"], "rendement_total": ["cours_ajuste"],
    }
    frequences_calcul = {"ecart_olo_bund": "mois"}

    # --- fiche de chaque indicateur
    indicateurs = {}
    for definition in config["series"]:
        if definition.get("interne"):
            continue
        identifiant = definition["id"]
        frequence = definition.get("frequence", "jour")
        actuel, periodes = comparer(brut[identifiant], definition["type"], definition.get("sens_favorable", "neutre"), frequence)
        etat = etat_par_id.get(identifiant, {})
        indicateurs[identifiant] = _fiche(
            definition, actuel, periodes, brut[identifiant],
            source=etat.get("source_utilisee") or (definition["sources"][0].get("nom") if definition.get("sources") else None),
            etat=_etat_indicateur(brut[identifiant], [etat]),
            frequence=frequence, secours=bool(etat.get("secours_utilise")),
        )
    for definition in config["calculs"]:
        identifiant = definition["id"]
        frequence = frequences_calcul.get(identifiant, "jour")
        serie = calcule.get(identifiant, pd.Series(dtype=float))
        actuel, periodes = comparer(serie, definition["type"], definition.get("sens_favorable", "neutre"), frequence)
        if identifiant == "rendement_total" and actuel:
            actuel = {"valeur": None, "date_valeur": actuel["date_valeur"], "sans_objet": True}
        fiche = _fiche(
            definition, actuel, periodes, serie,
            source="Calcul : " + formules[identifiant],
            etat=_etat_indicateur(serie, [etat_par_id.get(d, {}) for d in dependances[identifiant]]),
            frequence=frequence, secours=False,
        )
        fiche["fichier"] = "cours_ajuste" if identifiant == "rendement_total" else identifiant
        indicateurs[identifiant] = fiche

    # --- séance du jour
    seance = None
    if len(cours) >= 2:
        dernier, veille = float(cours.iloc[-1]), float(cours.iloc[-2])
        seance = {
            "date": iso(cours.index[-1]), "cours": arrondi(dernier, 4), "veille": arrondi(veille, 4),
            "date_veille": iso(cours.index[-2]), "variation_pct": arrondi((dernier / veille - 1) * 100, 2),
            "variation_eur": arrondi(dernier - veille, 2), "source": indicateurs.get("cours", {}).get("source"),
        }

    valeur_comptable = _valeur_comptable(config, fondamentaux, cours, calcule)
    synthese = {
        "genere_le": horodatage(),
        "societe": {
            "id": config["id"], "nom": config["nom"], "description": config.get("description"),
            "symbole": config.get("symbole"), "isin": config.get("isin"), "devise": config.get("devise"),
            "page_investisseurs": config.get("page_investisseurs"),
        },
        "seance": seance,
        "tuiles": config.get("tuiles", []),
        "groupes": config.get("groupes", []),
        "indicateurs": indicateurs,
        "valeur_comptable": valeur_comptable,
        "identite": _identite(fondamentaux),
        "patrimoine": _patrimoine(config, dossier, fondamentaux, contexte.get("actualites")),
        "textes": config.get("textes", {}),
        "glossaire": config.get("glossaire", []),
        "rapports_a_valider": _rapports_a_valider(dossier),
    }
    synthese["points_attention"] = _points_attention(config, synthese, etats, contexte)
    synthese["etat_global"] = _etat_global(etats, indicateurs)
    return synthese


def _mini(serie: pd.Series, frequence: str) -> list[float]:
    """Une cinquantaine de points sur un an, pour la mini-courbe des tuiles."""
    if len(serie) < 3:
        return []
    recent = serie[serie.index >= serie.index[-1] - pd.DateOffset(years=1)]
    pas = max(1, len(recent) // 52) if frequence == "jour" else 1
    return [round(float(v), 4) for v in recent.iloc[::-1].iloc[::pas].iloc[::-1]]


def _fiche(definition, actuel, periodes, serie, source, etat, frequence, secours) -> dict:
    fiche = {
        "libelle": definition["libelle"],
        "court": definition.get("court", definition["libelle"]),
        "type": definition["type"],
        "unite": definition.get("unite", ""),
        "decimales": definition.get("decimales", 2),
        "sens_favorable": definition.get("sens_favorable", "neutre"),
        "signe": bool(definition.get("signe")),
        "mini": _mini(serie, frequence),
        "glossaire": definition.get("glossaire"),
        "pourquoi": definition.get("pourquoi"),
        "frequence": frequence,
        "actuel": actuel,
        "periodes": periodes,
        "source": source,
        "secours_utilise": secours,
        "etat": etat,
        "historique_depuis": iso(serie.index[0]) if len(serie) else None,
        "fichier": definition["id"],
    }
    if actuel is None:
        fiche["actuel"] = {"valeur": None, "raison": "aucune donnée collectée pour cet indicateur"}
    return fiche


def _etat_indicateur(serie: pd.Series, etats: list[dict]) -> str:
    """ok : à jour ; ancien : dernière valeur trop vieille ou collecte en échec ; nd : aucune donnée."""
    if serie is None or len(serie) == 0:
        return "nd"
    if any(e.get("etat") == "KO" or e.get("ancienne") for e in etats if e):
        return "ancien"
    return "ok"


# ------------------------------------------------------------ valeur comptable
def _dernier_avec(fondamentaux: dict, champ: str) -> dict | None:
    for trimestre in sorted(fondamentaux.get("trimestres", []), key=lambda t: t["date_cloture"], reverse=True):
        donnee = (trimestre.get("valeurs") or {}).get(champ)
        if isinstance(donnee, dict) and donnee.get("valeur") is not None:
            return {
                "valeur": donnee["valeur"], "mesure": donnee.get("mesure"), "note": donnee.get("note"),
                "date_cloture": trimestre["date_cloture"], "date_publication": trimestre["date_publication"],
                "periode": trimestre["periode"],
                "source": {
                    "titre": trimestre["rapport"]["titre"], "url": donnee.get("url") or trimestre["rapport"]["url"],
                    "page": donnee.get("page"),
                },
            }
    return None


def _exercice_en_cours(fondamentaux: dict, date: pd.Timestamp) -> dict | None:
    for exercice in fondamentaux.get("exercices", []):
        if pd.Timestamp(exercice["debut"]) <= date <= pd.Timestamp(exercice["fin"]):
            return exercice
    exercices = fondamentaux.get("exercices", [])
    return exercices[-1] if exercices else None


def _valeur_comptable(config: dict, fondamentaux: dict, cours: pd.Series, calcule: dict) -> dict | None:
    nta = _dernier_avec(fondamentaux, "nta_par_action")
    if cours.empty or not nta:
        return None
    prix, date = float(cours.iloc[-1]), cours.index[-1]
    van = _dernier_avec(fondamentaux, "van_ifrs_par_action")
    actions_serie = serie_actions(fondamentaux)
    actions = float(actions_serie[:date].iloc[-1]) if len(actions_serie[:date]) else None
    exercice = _exercice_en_cours(fondamentaux, date) or {}
    facteur = 12 / exercice.get("mois", 12)
    dividende = exercice.get("dividende_brut") * facteur if exercice.get("dividende_brut") is not None else None
    eps = exercice.get("epra_eps") * facteur if exercice.get("epra_eps") is not None else None
    precompte = config.get("precompte_mobilier", 0.30)

    decote = calcule.get("decote_nta", pd.Series(dtype=float))
    dix_ans = decote[decote.index >= date - pd.DateOffset(years=10)]
    historique = None
    if len(dix_ans) > 250:
        historique = {
            "moyenne_10_ans": arrondi(dix_ans.mean(), 2),
            "depuis": iso(dix_ans.index[0]),
            "minimum": arrondi(dix_ans.min(), 2), "date_minimum": iso(dix_ans.idxmin()),
            "maximum": arrondi(dix_ans.max(), 2), "date_maximum": iso(dix_ans.idxmax()),
            "jours_moins_chers_pct": arrondi((dix_ans < decote.iloc[-1]).mean() * 100, 0),
        }
    return {
        "date_cours": iso(date),
        "cours": arrondi(prix, 4),
        "nta": nta,
        "van_ifrs": van,
        "nombre_actions": actions,
        "decote_pct": arrondi((prix / nta["valeur"] - 1) * 100, 2),
        "decote_eur": arrondi(prix - nta["valeur"], 2),
        "capitalisation_m_eur": arrondi(prix * actions / 1e6, 1) if actions else None,
        "valeur_comptable_totale_m_eur": arrondi(nta["valeur"] * actions / 1e6, 1) if actions else None,
        "potentiel_retour_nta_pct": arrondi((nta["valeur"] / prix - 1) * 100, 2),
        "decote_historique": historique,
        "exercice": exercice.get("id"),
        "statut_exercice": exercice.get("statut"),
        "dividende_brut": arrondi(dividende, 4) if dividende is not None else None,
        "dividende_net": arrondi(dividende * (1 - precompte), 4) if dividende is not None else None,
        "precompte_mobilier": precompte,
        "precompte_note": config.get("precompte_note"),
        "rendement_brut_pct": arrondi(dividende / prix * 100, 2) if dividende else None,
        "rendement_net_pct": arrondi(dividende * (1 - precompte) / prix * 100, 2) if dividende else None,
        "epra_eps": arrondi(eps, 4) if eps is not None else None,
        "multiple": arrondi(prix / eps, 2) if eps else None,
        "source_exercice": exercice.get("source"),
        "note_exercice": exercice.get("note"),
    }


# ------------------------------------------------------------ carte d'identité
def _identite(fondamentaux: dict) -> dict:
    champs = [
        "taux_endettement", "epra_ltv", "cout_moyen_dette", "cout_moyen_dette_commissions", "ratio_couverture",
        "taux_occupation", "wault", "juste_valeur_total", "epra_eps_periode",
    ]
    return {
        "chiffres": {champ: _dernier_avec(fondamentaux, champ) for champ in champs},
        "libelles": fondamentaux.get("libelles", {}),
        "notations": fondamentaux.get("notations", []),
        "perspectives": fondamentaux.get("perspectives"),
        "calendrier": fondamentaux.get("calendrier"),
        "patrimoine": fondamentaux.get("patrimoine"),
        "fondamentaux_mis_a_jour_le": fondamentaux.get("mis_a_jour_le"),
    }


# ------------------------------------------------------ patrimoine et cessions
def _patrimoine(config: dict, dossier: Path, fondamentaux: dict, actualites: dict | None) -> dict:
    """Composition du patrimoine par trimestre et avancement du programme de cessions.
    Les segments viennent de la config, les blocs du programme de cessions.json."""
    cessions = lire_json(dossier / "cessions.json", {}) or {}
    reglages = config.get("patrimoine") or {}
    segments = reglages.get("segments", [])
    trimestres = []
    for trimestre in sorted(fondamentaux.get("trimestres", []), key=lambda t: t["date_cloture"]):
        if trimestre["date_cloture"] < reglages.get("depuis", "0000") or not segments:
            continue
        total = _valeur(trimestre, "juste_valeur_total")
        valeurs = {segment["id"]: _valeur(trimestre, segment["champ"]) or 0 for segment in segments}
        if total is None or not any(valeurs.values()):
            continue
        trimestres.append({
            "periode": trimestre["periode"], "date_cloture": trimestre["date_cloture"],
            "segments": valeurs, "autres": arrondi(total - sum(valeurs.values()), 1), "total": total,
            "actifs_detenus_vente": _valeur(trimestre, "actifs_detenus_vente"),
            "cessions_cumul_annee": _valeur(trimestre, "cessions_cumul_annee"),
            "source": {"titre": trimestre["rapport"]["titre"], "url": trimestre["rapport"]["url"]},
        })

    programme = None
    reglage_programme = cessions.get("programme") or {}
    if reglage_programme.get("blocs"):
        date_depart = reglage_programme["depart"]["date"]
        dernier = trimestres[-1] if trimestres else None
        blocs = []
        for bloc in reglage_programme["blocs"]:
            vendu = sum(
                vente["prix_m_eur"] for vente in cessions.get("ventes", [])
                if vente.get("bloc") == bloc["id"] and vente.get("prix_m_eur") is not None and vente.get("date_tri", "") > date_depart
            )
            blocs.append({
                "id": bloc["id"], "libelle": bloc["libelle"], "depart": bloc["depart_m_eur"], "vendu": arrondi(vendu, 1),
                "derniere_juste_valeur": (dernier["segments"].get(bloc["segment"]) if dernier and bloc.get("segment") else None),
                "date_derniere_juste_valeur": dernier["date_cloture"] if dernier and bloc.get("segment") else None,
                "note": bloc.get("note"),
            })
        total_depart = sum(b["depart"] for b in blocs)
        total_vendu = sum(b["vendu"] for b in blocs)
        programme = {
            "depart": reglage_programme["depart"], "blocs": blocs,
            "total_depart": arrondi(total_depart, 1), "total_vendu": arrondi(total_vendu, 1),
            "reste": arrondi(total_depart - total_vendu, 1),
            "reste_pct": arrondi((1 - total_vendu / total_depart) * 100, 1) if total_depart else None,
            "avancement_pct": arrondi(total_vendu / total_depart * 100, 1) if total_depart else None,
            "notes": reglage_programme.get("notes", []),
        }

    # Communiqués officiels « Cessions » plus récents que la dernière mise à jour du tableau
    a_integrer = []
    limite = cessions.get("mis_a_jour_le", "")
    for article in (actualites or {}).get("articles", []):
        if article.get("officiel") and article.get("categorie") == "cessions" and article.get("date", "") > limite:
            a_integrer.append({k: article.get(k) for k in ("date", "titre", "lien")})
    return {
        "segments": [{"id": seg["id"], "libelle": seg["libelle"], "court": seg.get("court", seg["libelle"])} for seg in segments],
        "libelle_autres": reglages.get("libelle_autres", "Autres"), "court_autres": reglages.get("court_autres", "Autres"),
        "trimestres": trimestres, "programme": programme, "communiques_a_integrer": a_integrer,
        "cessions_mis_a_jour_le": cessions.get("mis_a_jour_le"),
    }


def _rapports_a_valider(dossier: Path) -> list[dict]:
    fichier = lire_json(dossier / "fondamentaux_a_valider.json", {}) or {}
    return [
        {"titre": r.get("titre"), "date_publication": r.get("date_publication"), "url": r.get("url"),
         "periode": r.get("periode"), "nombre_candidats": len(r.get("candidats") or {})}
        for r in fichier.get("rapports", [])
    ]


# -------------------------------------------------------- points d'attention
def _fr(nombre: float, decimales: int = 1, signe: bool = False) -> str:
    """Nombre au format belge : virgule décimale, vrai signe moins."""
    texte = f"{nombre:+.{decimales}f}" if signe else f"{nombre:.{decimales}f}"
    return texte.replace(".", ",").replace("-", "−")


def _points_attention(config: dict, synthese: dict, etats: list[dict], contexte: dict) -> list[dict]:
    seuils = config.get("seuils_alertes", {})
    indicateurs = synthese["indicateurs"]
    points = []
    aujourdhui = pd.Timestamp(maintenant().date())

    def ajouter(identifiant, niveau, titre, detail, **plus):
        points.append({"id": identifiant, "niveau": niveau, "titre": titre, "detail": detail, **plus})

    bund = (indicateurs.get("bund10") or {}).get("periodes", {}).get("1m", {})
    seuil = seuils.get("bund_hausse_1m_points")
    if seuil is not None and bund.get("variation") is not None and bund["variation"] > seuil:
        ajouter("bund", "alerte", "Le Bund 10 ans monte vite",
                f"{_fr(bund['variation'], 2, True)} point sur 1 mois (seuil : {_fr(seuil, 2)}). "
                "Une hausse des taux longs pèse sur les SIR.",
                indicateur="bund10")

    vc = synthese.get("valeur_comptable") or {}
    historique = vc.get("decote_historique")
    seuil = seuils.get("decote_ecart_moyenne_points")
    if historique and seuil is not None and vc.get("decote_pct") is not None:
        ecart = vc["decote_pct"] - historique["moyenne_10_ans"]
        if ecart < -seuil:
            ajouter("decote", "attention", "Décote nettement plus forte que d'habitude",
                    f"Écart cours/NTA de {_fr(vc['decote_pct'], 1, True)} %, contre {_fr(historique['moyenne_10_ans'], 1, True)} % "
                    f"en moyenne sur 10 ans ({_fr(abs(ecart), 0)} points d'écart, seuil : {_fr(seuil, 0)}).",
                    indicateur="decote_nta")

    for identifiant in ("vix", "vstoxx"):
        seuil = seuils.get(identifiant)
        actuel = ((indicateurs.get(identifiant) or {}).get("actuel") or {}).get("valeur")
        if seuil is not None and actuel is not None and actuel > seuil:
            ajouter(identifiant, "alerte", f"{indicateurs[identifiant]['court']} au-dessus de {seuil:.0f}",
                    f"{_fr(actuel)} : les marchés sont nerveux.", indicateur=identifiant)

    jours = seuils.get("communique_recent_jours", 7)
    recents = [
        a for a in (contexte.get("actualites") or {}).get("articles", [])
        if a.get("officiel") and a.get("date") and (aujourdhui - pd.Timestamp(a["date"])).days <= jours
    ]
    for article in recents[:3]:
        ajouter("communique", "info", "Nouveau communiqué officiel",
                f"{pd.Timestamp(article['date']):%d/%m/%Y} — {article['titre']}", lien=article.get("lien"))

    for rapport in synthese.get("rapports_a_valider", []):
        ajouter("rapport", "attention", "Nouveau rapport publié — chiffres à valider",
                f"{rapport['titre']} ({pd.Timestamp(rapport['date_publication']):%d/%m/%Y}). Les fondamentaux affichés datent du rapport précédent.",
                lien=rapport.get("url"))

    jours = seuils.get("resultats_proches_jours", 14)
    for evenement in ((synthese["identite"].get("calendrier") or {}).get("evenements") or []):
        if evenement.get("type") == "resultats" and len(evenement["date"]) == 10:
            reste = (pd.Timestamp(evenement["date"]) - aujourdhui).days
            if 0 <= reste <= jours:
                ajouter("resultats", "info", "Publication de résultats imminente",
                        f"{evenement['libelle']} le {pd.Timestamp(evenement['date']):%d/%m/%Y} (dans {reste} jour{'s' if reste > 1 else ''}).")

    jours = seuils.get("source_panne_jours", 3)
    for etat in etats:
        reussite = etat.get("derniere_reussite")
        if etat.get("etat") == "KO" and reussite:
            age = (aujourdhui - pd.Timestamp(reussite[:10])).days
            if age > jours:
                ajouter("source", "attention", f"Source en panne : {etat.get('libelle', etat['id'])}",
                        f"Dernière collecte réussie le {pd.Timestamp(reussite[:10]):%d/%m/%Y} (il y a {age} jours).")

    for locataire in (contexte.get("locataires") or {}).get("locataires", []):
        if locataire.get("alerte"):
            actu = locataire["alerte"]
            ajouter("locataire", "alerte", f"Signal de risque chez un locataire : {locataire['nom']}",
                    f"{pd.Timestamp(actu['date']):%d/%m/%Y} — {actu['titre']}", lien=actu.get("lien"))
    ordre = {"alerte": 0, "attention": 1, "info": 2}
    return sorted(points, key=lambda p: ordre.get(p["niveau"], 3))


def _etat_global(etats: list[dict], indicateurs: dict) -> dict:
    """Pastille : vert (tout est à jour), orange (certaines données anciennes), rouge (échec de collecte)."""
    en_panne = [e for e in etats if e.get("etat") == "KO"]
    anciens = [i["court"] for i in indicateurs.values() if i.get("etat") in ("ancien", "nd")]
    essentiels_ko = [e for e in en_panne if e["id"] in ("cours",)]
    marche = [e for e in etats if e.get("categorie") == "marche"]
    if essentiels_ko or (marche and len([e for e in en_panne if e.get("categorie") == "marche"]) > len(marche) / 2):
        niveau, message = "rouge", "Échec de collecte : le cours ou la majorité des sources n'ont pas répondu."
    elif en_panne or anciens:
        niveau = "orange"
        message = "Certaines données sont anciennes ou une source n'a pas répondu."
    else:
        niveau, message = "vert", "Toutes les sources ont répondu : les données sont à jour."
    return {
        "niveau": niveau, "message": message,
        "sources_en_panne": [{"id": e["id"], "libelle": e.get("libelle", e["id"]), "message": e.get("message", "")} for e in en_panne],
        "indicateurs_anciens": anciens,
    }
