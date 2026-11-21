"""Banque centrale allemande (Deutsche Bundesbank) — API statistique SDMX, format CSV."""
import io

import pandas as pd

from .commun import SourceErreur, dates_periodes, nettoyer, telecharger


def lire(flux: str, cle: str, debut: str | None = None) -> pd.Series:
    parametres = {"format": "sdmx_csv", "lang": "en"}
    if debut:
        parametres["startPeriod"] = debut
    reponse = telecharger(f"https://api.statistiken.bundesbank.de/rest/data/{flux}/{cle}", params=parametres)
    table = pd.read_csv(io.StringIO(reponse.text), sep=None, engine="python")
    colonnes = {c.upper(): c for c in table.columns}
    if "TIME_PERIOD" not in colonnes or "OBS_VALUE" not in colonnes:
        raise SourceErreur(f"format Bundesbank inattendu (colonnes : {list(table.columns)[:6]})")
    valeurs = table[colonnes["OBS_VALUE"]].astype(str).str.replace(",", ".", regex=False)
    return nettoyer(pd.Series(valeurs.values, index=dates_periodes(table[colonnes["TIME_PERIOD"]])))
