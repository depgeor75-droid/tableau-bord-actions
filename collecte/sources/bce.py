"""Banque centrale européenne — ECB Data Portal (sans clé)."""
import io

import pandas as pd

from .commun import SourceErreur, dates_periodes, nettoyer, telecharger


def lire(flux: str, cle: str, debut: str | None = None) -> pd.Series:
    parametres = {"format": "csvdata"}
    if debut:
        parametres["startPeriod"] = debut
    reponse = telecharger(f"https://data-api.ecb.europa.eu/service/data/{flux}/{cle}", params=parametres)
    if not reponse.text.strip():
        raise SourceErreur("réponse vide de la BCE (aucune observation sur la période)")
    table = pd.read_csv(io.StringIO(reponse.text))
    return nettoyer(pd.Series(table["OBS_VALUE"].values, index=dates_periodes(table["TIME_PERIOD"])))
