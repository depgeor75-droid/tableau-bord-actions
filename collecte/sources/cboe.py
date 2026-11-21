"""Cboe (bourse de Chicago) — historique officiel du VIX en CSV."""
import io

import pandas as pd

from .commun import SourceErreur, nettoyer, telecharger


def lire(indice: str = "VIX", debut: str | None = None) -> pd.Series:
    reponse = telecharger(f"https://cdn.cboe.com/api/global/us_indices/daily_prices/{indice}_History.csv")
    table = pd.read_csv(io.StringIO(reponse.text))
    if "CLOSE" not in table or "DATE" not in table:
        raise SourceErreur(f"format Cboe inattendu (colonnes : {list(table.columns)})")
    serie = nettoyer(pd.Series(table["CLOSE"].values, index=pd.to_datetime(table["DATE"], format="%m/%d/%Y")))
    return serie[serie.index >= debut] if debut else serie
