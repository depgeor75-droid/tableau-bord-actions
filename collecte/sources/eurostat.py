"""Eurostat — API de diffusion (JSON-stat). Utilisé pour l'inflation (IPCH)."""
import pandas as pd

from .commun import SourceErreur, nettoyer, telecharger


def lire(jeu: str, filtres: dict | None = None, debut: str | None = None) -> pd.Series:
    parametres = {"format": "JSON", **(filtres or {})}
    if debut:
        parametres["sinceTimePeriod"] = debut[:7]
    reponse = telecharger(
        f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{jeu}", params=parametres
    )
    donnees = reponse.json()
    tailles = donnees.get("size", [])
    if not tailles or any(taille != 1 for taille in tailles[:-1]):
        raise SourceErreur(f"Eurostat : la requête doit renvoyer une seule série (dimensions {tailles})")
    periodes = donnees["dimension"]["time"]["category"]["index"]
    valeurs = donnees.get("value", {})
    serie = pd.Series({periode: valeurs.get(str(position)) for periode, position in periodes.items()})
    serie.index = pd.PeriodIndex(serie.index, freq="M").to_timestamp(how="end").normalize()
    return nettoyer(serie)
