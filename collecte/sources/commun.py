"""Outils communs à toutes les sources (requêtes HTTP, nettoyage, reprises)."""
from __future__ import annotations

import time

import pandas as pd
import requests

EN_TETES = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
}
DELAI = 45  # secondes par requête


class SourceErreur(Exception):
    """Erreur lisible par un humain, reprise telle quelle dans etat_sources.json."""


def avec_reprises(fonction, essais: int = 3, attente: float = 2.0):
    """Appelle `fonction()` ; en cas d'échec, réessaie avec un délai croissant."""
    derniere = None
    for numero in range(essais):
        try:
            return fonction()
        except Exception as erreur:  # noqa: BLE001 - on veut tout attraper ici
            derniere = erreur
            if numero < essais - 1:
                time.sleep(attente * (2**numero))
    raise derniere  # type: ignore[misc]


def telecharger(url: str, **kwargs) -> requests.Response:
    try:
        reponse = requests.get(url, headers=EN_TETES, timeout=DELAI, **kwargs)
    except requests.RequestException as erreur:
        raise SourceErreur(f"pas de réponse de {url.split('/')[2]} ({type(erreur).__name__})") from erreur
    if reponse.status_code != 200:
        raise SourceErreur(f"HTTP {reponse.status_code} sur {url.split('?')[0]}")
    return reponse


def nettoyer(serie: pd.Series) -> pd.Series:
    """Série numérique triée par date, sans doublon ni valeur vide."""
    serie = pd.to_numeric(serie, errors="coerce").dropna()
    index = pd.to_datetime(serie.index)
    if getattr(index, "tz", None) is not None:
        index = index.tz_localize(None)
    serie.index = index.normalize()
    serie = serie[~serie.index.duplicated(keep="last")].sort_index()
    if serie.empty:
        raise SourceErreur("la source a répondu mais sans aucune valeur exploitable")
    return serie.astype(float)


def dates_periodes(texte: pd.Series) -> pd.DatetimeIndex:
    """'2026-10' (donnée mensuelle) devient le dernier jour du mois ; sinon date normale."""
    exemple = str(texte.iloc[0])
    if len(exemple) == 7:
        return pd.PeriodIndex(texte.astype(str), freq="M").to_timestamp(how="end").normalize()
    return pd.to_datetime(texte)
