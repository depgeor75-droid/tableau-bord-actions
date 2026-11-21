"""Réserve fédérale de Saint-Louis (FRED) — CSV public, sans clé."""
import io

import pandas as pd

from .commun import SourceErreur, nettoyer, telecharger


def lire(identifiant: str, debut: str | None = None) -> pd.Series:
    parametres = {"id": identifiant}
    if debut:
        parametres["cosd"] = debut
    reponse = telecharger("https://fred.stlouisfed.org/graph/fredgraph.csv", params=parametres)
    table = pd.read_csv(io.StringIO(reponse.text), na_values=["."])
    if table.shape[1] < 2:
        raise SourceErreur("format FRED inattendu")
    return nettoyer(pd.Series(table.iloc[:, 1].values, index=pd.to_datetime(table.iloc[:, 0])))
