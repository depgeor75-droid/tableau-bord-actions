"""Sources de données : un module par fournisseur.

`lire_serie(definition, debut)` choisit le bon module d'après `definition["type"]`
et renvoie une série datée. Les définitions vivent dans societes/<societe>.json.
"""
from __future__ import annotations

import pandas as pd

from . import bce, bundesbank, cboe, euronext, eurostat, fred, publications, rss, stoxx, yahoo
from .commun import SourceErreur, avec_reprises

__all__ = [
    "lire_serie", "SourceErreur", "avec_reprises",
    "bce", "bundesbank", "cboe", "euronext", "eurostat", "fred", "publications", "rss", "stoxx", "yahoo",
]


def lire_serie(definition: dict, debut: str | None = None) -> pd.Series:
    """Interroge une source décrite par un dictionnaire de configuration."""
    genre = definition["type"]
    if genre == "yahoo":
        return yahoo.lire(definition["symbole"], debut, definition.get("colonne", "cours"))
    if genre == "bce":
        return bce.lire(definition["flux"], definition["cle"], debut)
    if genre == "bundesbank":
        return bundesbank.lire(definition["flux"], definition["cle"], debut)
    if genre == "fred":
        return fred.lire(definition["identifiant"], debut)
    if genre == "cboe":
        return cboe.lire(definition.get("indice", "VIX"), debut)
    if genre == "stoxx":
        return stoxx.lire(definition.get("symbole", "v2tx"), debut)
    if genre == "eurostat":
        return eurostat.lire(definition["jeu"], definition.get("filtres"), debut)
    if genre == "euronext":
        return euronext.lire(definition["isin"], definition.get("marche", "XBRU"), debut)
    raise SourceErreur(f"type de source inconnu : {genre}")
