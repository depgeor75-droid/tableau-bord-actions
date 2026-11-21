"""Lecture de flux RSS/Atom (Google News, etc.)."""
from urllib.parse import quote_plus

from .commun import SourceErreur, telecharger


def lire(url: str) -> list:
    import feedparser

    flux = feedparser.parse(telecharger(url).content)
    if flux.bozo and not flux.entries:
        raise SourceErreur(f"flux RSS illisible : {flux.bozo_exception}")
    return list(flux.entries)


def google_news(requete: str, langue: str, pays: str = "BE") -> list:
    """Flux Google Actualités pour une recherche, dans une langue donnée."""
    url = (
        f"https://news.google.com/rss/search?q={quote_plus(requete)}"
        f"&hl={langue}&gl={pays}&ceid={pays}:{langue}"
    )
    return lire(url)
