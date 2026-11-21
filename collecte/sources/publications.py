"""Page web listant des publications PDF datées (communiqués, rapports).
Fonctionne avec la page « Communiqués de presse » d'aedifica.eu."""
import html
import re

from .commun import SourceErreur, telecharger


def lire(url: str) -> list[dict]:
    """Renvoie [{date: 'AAAA-MM-JJ', titre, url}], du plus récent au plus ancien."""
    texte = telecharger(url).text
    resultats, deja_vus = [], set()
    for bloc in re.finditer(r'<a\s[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>', texte, re.S | re.I):
        lien, contenu = bloc.group(1), bloc.group(2)
        brut = html.unescape(re.sub(r"<[^>]+>", " ", contenu))
        date = re.search(r"(\d{2})/(\d{2})/(\d{4})", brut)
        if not date or lien in deja_vus:
            continue
        titre = re.sub(r"\s+", " ", brut.replace(date.group(0), "")).strip(" -–— ")
        if not titre:
            continue
        deja_vus.add(lien)
        resultats.append({"date": f"{date.group(3)}-{date.group(2)}-{date.group(1)}", "titre": titre, "url": lien})
    if not resultats:
        raise SourceErreur("aucune publication PDF datée trouvée sur la page (mise en page modifiée ?)")
    resultats.sort(key=lambda p: p["date"], reverse=True)
    return resultats
