"""STOXX — historique officiel des indices (dont le VSTOXX, symbole V2TX)."""
import io

import pandas as pd

from .commun import SourceErreur, nettoyer, telecharger


def lire(symbole: str = "v2tx", debut: str | None = None) -> pd.Series:
    url = f"https://www.stoxx.com/document/Indices/Current/HistoricalData/h_{symbole.lower()}.txt"
    table = pd.read_csv(io.StringIO(telecharger(url).text), sep=";")
    if "Indexvalue" not in table or "Date" not in table:
        raise SourceErreur(f"format STOXX inattendu (colonnes : {list(table.columns)})")
    serie = nettoyer(pd.Series(table["Indexvalue"].values, index=pd.to_datetime(table["Date"], format="%d.%m.%Y")))
    return serie[serie.index >= debut] if debut else serie
