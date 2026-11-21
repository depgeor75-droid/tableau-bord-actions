"""Petits outils partagés par les scripts de collecte (fichiers, dates, JSON)."""
from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
FUSEAU = ZoneInfo("Europe/Brussels")


def maintenant() -> datetime:
    return datetime.now(FUSEAU).replace(microsecond=0)


def horodatage() -> str:
    """Horodatage ISO, fuseau Europe/Brussels (ex. 2026-11-21T18:47:12+01:00)."""
    return maintenant().isoformat()


def charger_config(societe: str) -> dict:
    chemin = RACINE / "societes" / f"{societe}.json"
    if not chemin.exists():
        raise SystemExit(f"Configuration introuvable : {chemin}")
    return json.loads(chemin.read_text(encoding="utf-8"))


def dossier_donnees(societe: str) -> Path:
    dossier = RACINE / "data" / societe
    (dossier / "historique").mkdir(parents=True, exist_ok=True)
    return dossier


def lire_json(chemin: Path, defaut=None):
    """Lit un JSON ; renvoie `defaut` s'il est absent ou illisible (jamais d'exception)."""
    try:
        return json.loads(Path(chemin).read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return defaut


def _sans_nan(objet):
    """JSON n'accepte pas NaN/Infini : on les remplace par null."""
    if isinstance(objet, float):
        return None if (math.isnan(objet) or math.isinf(objet)) else objet
    if isinstance(objet, dict):
        return {cle: _sans_nan(valeur) for cle, valeur in objet.items()}
    if isinstance(objet, (list, tuple)):
        return [_sans_nan(valeur) for valeur in objet]
    return objet


def ecrire_json(chemin: Path, contenu, ignorer: tuple[str, ...] = ("genere_le",), toujours: bool = False) -> bool:
    """Écrit le JSON seulement si son contenu utile a changé (hors horodatage), sauf
    `toujours=True`. Renvoie True si le fichier a été écrit."""
    contenu = _sans_nan(contenu)
    ancien = None if toujours else lire_json(chemin)
    if isinstance(ancien, dict) and isinstance(contenu, dict):
        if {c: v for c, v in ancien.items() if c not in ignorer} == {
            c: v for c, v in contenu.items() if c not in ignorer
        }:
            return False
    Path(chemin).parent.mkdir(parents=True, exist_ok=True)
    Path(chemin).write_text(json.dumps(contenu, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return True


# ------------------------------------------------------------------ séries CSV
def chemin_serie(dossier: Path, identifiant: str) -> Path:
    return dossier / "historique" / f"{identifiant}.csv"


def lire_serie_csv(chemin: Path) -> pd.Series:
    """Lit un historique `date,valeur`. Série vide si le fichier n'existe pas."""
    if not Path(chemin).exists():
        return pd.Series(dtype=float)
    try:
        table = pd.read_csv(chemin, parse_dates=["date"])
        serie = pd.Series(table["valeur"].values, index=pd.DatetimeIndex(table["date"])).dropna()
        return serie[~serie.index.duplicated(keep="last")].sort_index().astype(float)
    except Exception:  # noqa: BLE001 - fichier abîmé : on repart de zéro (réparation)
        return pd.Series(dtype=float)


def ecrire_serie_csv(chemin: Path, serie: pd.Series, decimales: int = 6) -> None:
    serie = serie.dropna().sort_index()
    lignes = ["date,valeur"]
    for date, valeur in serie.items():
        texte = f"{valeur:.{decimales}f}".rstrip("0").rstrip(".")
        lignes.append(f"{date:%Y-%m-%d},{texte}")
    Path(chemin).parent.mkdir(parents=True, exist_ok=True)
    Path(chemin).write_text("\n".join(lignes) + "\n", encoding="utf-8", newline="\n")


def iso(date) -> str | None:
    return None if date is None or pd.isna(date) else pd.Timestamp(date).strftime("%Y-%m-%d")


def arrondi(valeur, decimales: int = 4):
    if valeur is None or (isinstance(valeur, float) and (math.isnan(valeur) or math.isinf(valeur))):
        return None
    return round(float(valeur), decimales)
