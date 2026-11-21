"""Yahoo Finance via la bibliothèque yfinance.

Piège connu : dans les versions récentes de yfinance, `auto_adjust=True` par
défaut, donc `Close` serait déjà ajusté des dividendes. On force
`auto_adjust=False` pour obtenir séparément :
  - `cours`        : cours de clôture non ajusté des dividendes ;
  - `cours_ajuste` : cours ajusté des dividendes (sert au rendement total) ;
  - `dividende`    : montant détaché ce jour-là (0 sinon).
"""
import pandas as pd

from .commun import SourceErreur


_CACHE: dict = {}  # évite d'interroger Yahoo deux fois pour le même titre dans une exécution


def tableau(symbole: str, debut: str | None = None) -> pd.DataFrame:
    if (symbole, debut) not in _CACHE:
        _CACHE[(symbole, debut)] = _telecharger(symbole, debut)
    return _CACHE[(symbole, debut)]


def _telecharger(symbole: str, debut: str | None = None) -> pd.DataFrame:
    import yfinance as yf

    arguments = {"auto_adjust": False, "actions": True}
    if debut:
        arguments["start"] = debut
    else:
        arguments["period"] = "max"
    table = yf.Ticker(symbole).history(**arguments)
    if table is None or table.empty or "Close" not in table:
        raise SourceErreur(f"Yahoo n'a renvoyé aucune donnée pour {symbole} (blocage ou symbole inconnu)")
    resultat = pd.DataFrame(
        {
            "cours": table["Close"],
            "cours_ajuste": table["Adj Close"] if "Adj Close" in table else table["Close"],
            "dividende": table["Dividends"] if "Dividends" in table else 0.0,
        }
    )
    index = pd.to_datetime(resultat.index)
    if getattr(index, "tz", None) is not None:
        index = index.tz_localize(None)
    resultat.index = index.normalize()
    resultat = resultat[~resultat.index.duplicated(keep="last")].sort_index().dropna(subset=["cours"])
    resultat = resultat[resultat["cours"] > 0]
    if resultat.empty:
        raise SourceErreur(f"Yahoo : série vide pour {symbole}")
    return resultat


def lire(symbole: str, debut: str | None = None, colonne: str = "cours") -> pd.Series:
    return tableau(symbole, debut)[colonne].astype(float).round(4)
