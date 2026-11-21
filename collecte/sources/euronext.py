"""Site d'Euronext — cours de clôture non ajusté (environ 2 ans d'historique).
Source de secours et de contrôle croisé pour les actions, indices et ETF cotés sur Euronext."""
import io

import pandas as pd

from .commun import SourceErreur, nettoyer, telecharger


def lire(isin: str, marche: str = "XBRU", debut: str | None = None) -> pd.Series:
    aujourdhui = pd.Timestamp.today()
    limite = (aujourdhui - pd.DateOffset(years=2)).strftime("%Y-%m-%d")
    debut = max(debut, limite) if debut else limite
    url = f"https://live.euronext.com/en/ajax/AwlHistoricalPrice/getFullDownloadAjax/{isin}-{marche}"
    parametres = {
        "format": "csv", "decimal_separator": ".", "date_form": "d/m/Y", "op": "",
        "adjusted": "N", "base100": "", "startdate": debut, "enddate": aujourdhui.strftime("%Y-%m-%d"),
    }
    lignes = telecharger(url, params=parametres).text.splitlines()
    depart = next((i for i, ligne in enumerate(lignes) if ligne.lower().startswith("date")), None)
    if depart is None:
        raise SourceErreur("Euronext : format inattendu (pas de ligne d'en-tête « Date »)")
    # index_col=False : les lignes de données ont parfois un champ de plus que l'en-tête
    table = pd.read_csv(io.StringIO("\n".join(lignes[depart:])), sep=";", index_col=False)
    colonnes = {c.strip().lower(): c for c in table.columns}
    colonne = colonnes.get("close") or colonnes.get("last")
    if colonne is None or "date" not in colonnes:
        raise SourceErreur(f"Euronext : colonnes attendues absentes ({list(table.columns)})")
    return nettoyer(pd.Series(table[colonne].values, index=pd.to_datetime(table[colonnes["date"]], format="%d/%m/%Y")))
