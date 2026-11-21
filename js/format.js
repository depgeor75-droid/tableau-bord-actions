// Mise en forme « à la belge » : virgule décimale, espace pour les milliers, dates JJ/MM/AAAA.
// Aucun calcul financier ici : tout vient déjà calculé de synthese.json.

const MOINS = "−"; // vrai signe moins (plus lisible que le trait d'union)
const INSECABLE = " ";
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const formats = new Map();

function formateur(decimales) {
  if (!formats.has(decimales)) {
    formats.set(decimales, new Intl.NumberFormat("fr-BE", {
      minimumFractionDigits: decimales, maximumFractionDigits: decimales,
    }));
  }
  return formats.get(decimales);
}

export function estNombre(valeur) {
  return typeof valeur === "number" && Number.isFinite(valeur);
}

/** 1234.5 → « 1 234,50 » */
export function nombre(valeur, decimales = 2) {
  if (!estNombre(valeur)) return "n.d.";
  return formateur(decimales).format(valeur).replace("-", MOINS);
}

/** Toujours avec le signe : « +1,2 » ou « −3,4 » (on ne dépend pas que de la couleur). */
export function signe(valeur, decimales = 1) {
  if (!estNombre(valeur)) return "n.d.";
  const arrondi = Number(valeur.toFixed(decimales));
  const texte = formateur(decimales).format(Math.abs(arrondi));
  if (arrondi > 0) return `+${texte}`;
  if (arrondi < 0) return `${MOINS}${texte}`;
  return texte;
}

/** « 2026-11-20 » → « 20/11/2026 » ; « 2027-03 » → « mars 2027 » */
export function date(iso) {
  if (!iso) return "n.d.";
  const [annee, mois, jour] = iso.slice(0, 10).split("-");
  if (!jour) return `${MOIS_COURTS[Number(mois) - 1]} ${annee}`;
  return `${jour}/${mois}/${annee}`;
}

export function dateCourte(iso) {
  if (!iso) return "";
  const [annee, mois, jour] = iso.slice(0, 10).split("-");
  return `${jour}/${mois}/${annee.slice(2)}`;
}

/** « 2026-11-21T11:20:31+01:00 » → « 21/11/2026 à 11:20 » (heure belge, telle qu'écrite par la collecte) */
export function dateHeure(iso) {
  if (!iso) return "n.d.";
  return `${date(iso)} à ${iso.slice(11, 16)}`;
}

export function moisAnnee(iso) {
  const [annee, mois] = iso.split("-");
  return `${MOIS_COURTS[Number(mois) - 1]} ${annee}`;
}

export function joursDepuis(iso) {
  const debut = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((aujourdhui - debut) / 86400000);
}

/** Montant en millions d'euros : « 878 M€ » ou « 12,59 Md€ ». */
export function millions(valeur, decimalesMillions = 0) {
  if (!estNombre(valeur)) return "n.d.";
  if (Math.abs(valeur) >= 1000) return `${nombre(valeur / 1000, 2)}${INSECABLE}Md€`;
  return `${nombre(valeur, decimalesMillions)}${INSECABLE}M€`;
}

export function pourcent(valeur, decimales = 1, avecSigne = false) {
  if (!estNombre(valeur)) return "n.d.";
  return `${avecSigne ? signe(valeur, decimales) : nombre(valeur, decimales)}${INSECABLE}%`;
}

export function euros(valeur, decimales = 2) {
  if (!estNombre(valeur)) return "n.d.";
  return `${nombre(valeur, decimales)}${INSECABLE}€`;
}

/** Valeur d'un indicateur, avec son unité, selon son type. */
export function valeurIndicateur(fiche, valeur, options = {}) {
  if (!estNombre(valeur)) return "n.d.";
  const decimales = options.decimales ?? fiche.decimales ?? 2;
  switch (fiche.type) {
    case "taux":
      return `${nombre(valeur, decimales)}${INSECABLE}%`;
    case "ratio":
      return `${fiche.signe ? signe(valeur, decimales) : nombre(valeur, decimales)}${INSECABLE}%`;
    case "ecart":
      return `${nombre(valeur, decimales)}${INSECABLE}pt`;
    case "montant":
      return millions(valeur);
    case "multiple":
      return `${nombre(valeur, decimales)}${INSECABLE}×`;
    case "indice":
      return nombre(valeur, decimales);
    case "rendement_total":
      return "—";
    default:
      return fiche.unite ? `${nombre(valeur, decimales)}${INSECABLE}${fiche.unite}` : nombre(valeur, decimales);
  }
}

/**
 * Variation d'une période : texte principal (toujours signé), complément éventuel
 * (points de base pour les taux, rythme annuel pour le rendement total) et classe de couleur.
 * Les taux varient en points, jamais en %.
 */
export function variationPeriode(fiche, periode) {
  if (!periode || !estNombre(periode.variation)) {
    return { texte: "n.d.", complement: "", classe: "nd", raison: periode?.raison || "donnée non disponible" };
  }
  const enPoints = periode.unite_variation === "pt";
  const decimalesAffichees = enPoints ? (fiche.type === "ratio" ? Math.max(1, fiche.decimales ?? 1) : 2) : 1;
  // Une variation qui s'affiche « 0,0 » reste neutre : pas de couleur pour un mouvement invisible.
  const nulle = Number(periode.variation.toFixed(decimalesAffichees)) === 0;
  const classe = nulle ? "neu" : ({ favorable: "fav", defavorable: "def" }[periode.impact] || "neu");
  if (enPoints) {
    const decimales = decimalesAffichees;
    return {
      texte: `${signe(periode.variation, decimales)}${INSECABLE}pt`,
      complement: estNombre(periode.variation_pb) ? `${signe(periode.variation_pb, 0)}${INSECABLE}pb` : "",
      classe,
    };
  }
  return {
    texte: `${signe(periode.variation, 1)}${INSECABLE}%`,
    complement: estNombre(periode.annualise) ? `${signe(periode.annualise, 1)}${INSECABLE}%/an` : "",
    classe,
  };
}

export const LIBELLES_PERIODES = { "1m": "1 mois", "1a": "1 an", "5a": "5 ans", "10a": "10 ans" };
export { MOIS_COURTS, INSECABLE, MOINS };
