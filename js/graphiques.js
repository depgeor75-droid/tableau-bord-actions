// Graphiques (bibliothèque Chart.js, chargée par CDN dans index.html).
// Règles de lisibilité : traits fins, grille discrète, réticule + info-bulle au survol
// ou au doigt, légende toujours présente dès qu'il y a deux séries, couleurs fixes par
// série (palette validée pour le daltonisme), jamais de texte dans la couleur d'une série.

import { date as formatDate, nombre, MOIS_COURTS } from "./format.js";
import { h } from "./dom.js";

const JOUR = 86400000;
const actifs = new Set();

export function disponible() {
  return typeof window.Chart !== "undefined";
}

function couleur(nom) {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

function teintes() {
  return {
    surface: couleur("--surface"), encre: couleur("--encre"), encre2: couleur("--encre-2"), muet: couleur("--muet"),
    filet: couleur("--filet"), axe: couleur("--axe"),
  };
}

function lavis(hex, opacite) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`;
}

/** Détruit les graphiques dont le canevas a quitté la page (changement d'écran). */
export function nettoyer() {
  for (const graphique of [...actifs]) {
    if (!graphique.canvas || !graphique.canvas.isConnected) {
      graphique.destroy();
      actifs.delete(graphique);
    }
  }
}

// ----------------------------------------------------------------- données
const RECULS = { "1M": [0, 1], "1A": [1, 0], "5A": [5, 0], "10A": [10, 0] };

/** Garde les points de la période demandée (1M, 1A, 5A, 10A), comptée depuis le dernier point. */
export function fenetre(points, periode) {
  if (!points.length || !RECULS[periode]) return points;
  const [annees, mois] = RECULS[periode];
  const debut = new Date(points[points.length - 1][0]);
  debut.setUTCFullYear(debut.getUTCFullYear() - annees);
  debut.setUTCMonth(debut.getUTCMonth() - mois);
  const seuil = debut.getTime();
  let depart = points.findIndex((p) => p[0] >= seuil);
  if (depart > 0) depart -= 1; // inclut l'observation « à la date ou juste avant »
  return points.slice(Math.max(0, depart));
}

/** Allège une longue série pour l'affichage (≈ 450 points), en gardant le dernier. */
function alleger(points, maximum = 450) {
  if (points.length <= maximum) return points;
  const pas = Math.ceil(points.length / maximum);
  const resultat = [];
  for (let i = points.length - 1; i >= 0; i -= pas) resultat.push(points[i]);
  return resultat.reverse();
}

/** Aligne plusieurs séries sur les dates de la première (dernière valeur connue à chaque date). */
export function aligner(reference, autres) {
  return autres.map((serie) => {
    let curseur = 0;
    let derniere = null;
    return reference.map(([temps]) => {
      while (curseur < serie.length && serie[curseur][0] <= temps) derniere = serie[curseur++][1];
      return [temps, derniere];
    });
  });
}

// --------------------------------------------------------------- axe du temps
function graduations(min, max, largeur) {
  const jours = (max - min) / JOUR;
  const valeurs = [];
  if (jours <= 70) {
    const pas = jours <= 40 ? 7 : 14;
    for (let t = max; t >= min; t -= pas * JOUR) valeurs.push(t);
    return { valeurs: valeurs.reverse(), libelle: (t) => formatDate(new Date(t).toISOString()).slice(0, 5) };
  }
  const debut = new Date(min);
  if (jours <= 800) {
    const pas = jours <= 430 ? (largeur < 520 ? 3 : 2) : 6;
    const curseur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
    while (curseur.getTime() <= max) {
      if (curseur.getUTCMonth() % pas === 0) valeurs.push(curseur.getTime());
      curseur.setUTCMonth(curseur.getUTCMonth() + 1);
    }
    return {
      valeurs,
      libelle: (t) => { const d = new Date(t); return `${MOIS_COURTS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`; },
    };
  }
  const pas = jours <= 2300 ? 1 : (largeur < 520 ? 2 : 1);
  for (let annee = debut.getUTCFullYear() + 1; Date.UTC(annee, 0, 1) <= max; annee++) {
    if (annee % pas === 0) valeurs.push(Date.UTC(annee, 0, 1));
  }
  return { valeurs, libelle: (t) => String(new Date(t).getUTCFullYear()) };
}

// ------------------------------------------------------------------ plugins
const reticule = {
  id: "reticule",
  afterDatasetsDraw(graphique) {
    const elements = graphique.tooltip?.getActiveElements?.() || [];
    if (!elements.length || graphique.config.type !== "line") return;
    const { ctx, chartArea } = graphique;
    ctx.save();
    ctx.strokeStyle = teintes().axe;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(elements[0].element.x) + 0.5, chartArea.top);
    ctx.lineTo(Math.round(elements[0].element.x) + 0.5, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const reperes = {
  id: "reperes",
  beforeDatasetsDraw(graphique, _args, options) {
    const { ctx, chartArea, scales } = graphique;
    const t = teintes();
    for (const repere of options.lignes || []) {
      const y = scales.y.getPixelForValue(repere.valeur);
      if (y < chartArea.top - 1 || y > chartArea.bottom + 1) continue;
      ctx.save();
      ctx.strokeStyle = repere.pointille ? t.encre2 : t.axe;
      ctx.lineWidth = repere.pointille ? 1.5 : 1;
      if (repere.pointille) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, Math.round(y) + 0.5);
      ctx.lineTo(chartArea.right, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.restore();
    }
  },
  // Les étiquettes des repères passent au-dessus des courbes, sur une pastille de la
  // couleur du fond, pour rester lisibles quand une courbe les croise.
  afterDatasetsDraw(graphique, _args, options) {
    const { ctx, chartArea, scales } = graphique;
    const t = teintes();
    for (const repere of options.lignes || []) {
      if (!repere.libelle) continue;
      const y = scales.y.getPixelForValue(repere.valeur);
      if (y < chartArea.top - 1 || y > chartArea.bottom + 1) continue;
      ctx.save();
      ctx.font = "600 11px system-ui, sans-serif";
      const largeur = ctx.measureText(repere.libelle).width + 12;
      const x = chartArea.right - largeur - 2;
      const haut = y - 22 < chartArea.top ? y + 5 : y - 22;
      ctx.fillStyle = t.surface;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.roundRect(x, haut, largeur, 17, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.encre;
      ctx.textBaseline = "middle";
      ctx.fillText(repere.libelle, x + 6, haut + 9);
      ctx.restore();
    }
  },
};

const totaux = {
  id: "totaux",
  afterDatasetsDraw(graphique, _args, options) {
    if (!options.format) return;
    const { ctx } = graphique;
    const visibles = graphique.getSortedVisibleDatasetMetas();
    if (!visibles.length) return;
    const sommet = visibles[visibles.length - 1];
    ctx.save();
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = teintes().encre;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    sommet.data.forEach((barre, i) => {
      const total = graphique.data.datasets.reduce((somme, jeu) => somme + (Number(jeu.data[i]) || 0), 0);
      ctx.fillText(options.format(total), barre.x, barre.y - 4);
    });
    ctx.restore();
  },
};

function optionsCommunes(t) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.encre, titleColor: t.surface, bodyColor: t.surface,
        titleFont: { weight: "600", size: 12 }, bodyFont: { size: 13 }, padding: 10, cornerRadius: 8,
        boxWidth: 14, boxHeight: 2, boxPadding: 6, usePointStyle: true, caretSize: 5, displayColors: true,
      },
    },
  };
}

function axeValeurs(t, reglage = {}, position = "left") {
  return {
    position,
    reverse: Boolean(reglage.inverse),
    grace: "6%",
    border: { display: false },
    grid: { color: position === "left" ? t.filet : "transparent", drawTicks: false },
    ticks: {
      color: t.encre2, font: { size: 11 }, padding: 6, maxTicksLimit: 6,
      callback: (valeur) => (reglage.format ? reglage.format(valeur) : nombre(valeur, 0)),
    },
    title: reglage.titre
      ? { display: true, text: reglage.titre, color: t.encre2, font: { size: 11, weight: "600" }, padding: { bottom: 2 } }
      : { display: false },
  };
}

function monter(canevas, configuration) {
  const existant = window.Chart.getChart(canevas);
  if (existant) { existant.destroy(); actifs.delete(existant); }
  const graphique = new window.Chart(canevas, configuration);
  actifs.add(graphique);
  return graphique;
}

// --------------------------------------------------------- courbes dans le temps
/**
 * series  : [{ nom, points: [[t, v]…], teinte: "--serie-1", axe: "y" | "y1", format }]
 * options : { axes: { y: { format, titre }, y1: { format, titre, inverse } },
 *             lignes: [{ valeur, libelle, pointille }], entre: { dessus, dessous }, aire: bool }
 */
export function courbes(canevas, series, options = {}) {
  if (!disponible()) return null;
  const t = teintes();
  const reference = alleger(series[0].points);
  const alignees = [reference, ...aligner(reference, series.slice(1).map((s) => s.points))];
  const largeur = canevas.parentElement?.clientWidth || 360;
  const min = reference[0][0];
  const max = reference[reference.length - 1][0];
  const echelle = graduations(min, max, largeur);

  const jeux = series.map((serie, rang) => {
    const teinte = couleur(serie.teinte || `--serie-${rang + 1}`);
    const dernier = alignees[rang].length - 1;
    const jeu = {
      label: serie.nom,
      data: alignees[rang].map(([x, y]) => ({ x, y })),
      yAxisID: serie.axe || "y",
      borderColor: teinte, backgroundColor: teinte,
      borderWidth: 2, borderJoinStyle: "round", borderCapStyle: "round", tension: 0, spanGaps: true,
      pointStyle: "line",
      pointRadius: (contexte) => (contexte.dataIndex === dernier ? 4 : 0),
      pointBackgroundColor: teinte, pointBorderColor: t.surface, pointBorderWidth: 2,
      pointHoverRadius: 5, pointHoverBackgroundColor: teinte, pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2,
      pointHitRadius: 12,
      fill: false,
      format: serie.format,
    };
    if (options.aire && rang === 0) {
      jeu.fill = { target: { value: 0 }, above: lavis(teinte, 0.1), below: lavis(teinte, 0.1) };
    }
    if (options.entre && rang === 0) {
      jeu.fill = {
        target: 1,
        above: lavis(couleur(options.entre.dessus || "--serie-3"), 0.14),
        below: lavis(couleur(options.entre.dessous || "--defavorable"), 0.14),
      };
    }
    return jeu;
  });

  const base = optionsCommunes(t);
  const axes = options.axes || {};
  const echelles = {
    x: {
      type: "linear", min, max,
      border: { color: t.axe }, grid: { display: false },
      afterBuildTicks: (axe) => { axe.ticks = echelle.valeurs.map((value) => ({ value })); },
      ticks: { color: t.encre2, font: { size: 11 }, maxRotation: 0, autoSkip: false, callback: (valeur) => echelle.libelle(valeur) },
    },
    y: axeValeurs(t, axes.y, "left"),
  };
  if (series.some((s) => s.axe === "y1")) echelles.y1 = axeValeurs(t, axes.y1, "right");

  return monter(canevas, {
    type: "line",
    data: { datasets: jeux },
    plugins: [reticule, reperes],
    options: {
      ...base,
      parsing: false,
      normalized: true,
      scales: echelles,
      plugins: {
        ...base.plugins,
        reperes: { lignes: options.lignes || [] },
        tooltip: {
          ...base.plugins.tooltip,
          callbacks: {
            title: (elements) => formatDate(new Date(elements[0].parsed.x).toISOString()),
            label: (element) => {
              const format = element.dataset.format || ((v) => nombre(v, 2));
              return element.parsed.y === null ? ` n.d.  ${element.dataset.label}` : ` ${format(element.parsed.y)}  ${element.dataset.label}`;
            },
            labelPointStyle: () => ({ pointStyle: "line", rotation: 0 }),
          },
        },
      },
    },
  });
}

// ------------------------------------------------------------------ barres
/**
 * categories : ["T1 2026", …] ; series : [{ nom, valeurs: […], teinte }]
 * options    : { empile, format, formatTotal, titreY }
 */
export function barres(canevas, categories, series, options = {}) {
  if (!disponible()) return null;
  const t = teintes();
  const base = optionsCommunes(t);
  const format = options.format || ((v) => nombre(v, 0));
  const jeux = series.map((serie, rang) => {
    const teinte = couleur(serie.teinte || `--serie-${rang + 1}`);
    const sommet = rang === series.length - 1 || !options.empile;
    return {
      label: serie.nom, data: serie.valeurs, backgroundColor: teinte, hoverBackgroundColor: lavis(teinte, 0.82),
      maxBarThickness: options.empile ? 40 : 24, categoryPercentage: 0.7, barPercentage: 0.9,
      borderColor: t.surface, borderWidth: sommet ? 0 : { top: 2, right: 0, bottom: 0, left: 0 },
      borderRadius: sommet ? { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } : 0, borderSkipped: false,
      pointStyle: "rect",
    };
  });
  return monter(canevas, {
    type: "bar",
    data: { labels: categories, datasets: jeux },
    plugins: [totaux],
    options: {
      ...base,
      layout: { padding: { top: 18 } },
      scales: {
        x: { stacked: Boolean(options.empile), border: { color: t.axe }, grid: { display: false }, ticks: { color: t.encre2, font: { size: 11 }, maxRotation: 0 } },
        y: { ...axeValeurs(t, { format, titre: options.titreY }), stacked: Boolean(options.empile), beginAtZero: true },
      },
      plugins: {
        ...base.plugins,
        totaux: { format: options.formatTotal || null },
        tooltip: {
          ...base.plugins.tooltip, usePointStyle: true, boxWidth: 9, boxHeight: 9,
          callbacks: { label: (element) => ` ${format(element.parsed.y)}  ${element.dataset.label}` },
        },
      },
    },
  });
}

// ----------------------------------------------------------------- habillage
/** Légende en HTML : un trait (courbes) ou un carré (barres) dans la couleur de la série, texte neutre. */
export function legende(elements) {
  return h("div", { class: "legende" }, elements.map((element) => h("span", { class: "legende__item" },
    h("span", { class: element.carre ? `legende__carre ${element.classe}` : `legende__trait ${element.classe}${element.pointille ? " legende__trait--pointille" : ""}`, "aria-hidden": "true" }),
    element.nom)));
}

/** Zone d'un graphique : canevas + message de remplacement si la bibliothèque n'est pas chargée. */
export function zone(etiquette, petit = false) {
  const canevas = h("canvas", { role: "img", "aria-label": etiquette });
  const conteneur = h("div", { class: `graphique__zone${petit ? " graphique__zone--petit" : ""}` }, canevas);
  if (!disponible()) {
    conteneur.append(h("p", { class: "graphique__message" },
      "Graphique indisponible : la bibliothèque de graphiques n'a pas pu être chargée (connexion ?). Les chiffres restent affichés dans les tableaux."));
  }
  return { conteneur, canevas };
}

export function message(conteneur, texte) {
  conteneur.querySelector(".graphique__message")?.remove();
  if (texte) conteneur.append(h("p", { class: "graphique__message" }, texte));
}

/** Sélecteur de période 1M / 1A / 5A / 10A. */
export function selecteurPeriode(actuelle, choisir, periodes = ["1M", "1A", "5A", "10A"]) {
  const groupe = h("div", { class: "segments", role: "group", "aria-label": "Période affichée" });
  for (const periode of periodes) {
    groupe.append(h("button", {
      type: "button", "aria-pressed": String(periode === actuelle),
      onclick: (evenement) => {
        groupe.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
        evenement.currentTarget.setAttribute("aria-pressed", "true");
        choisir(periode);
      },
    }, periode));
  }
  return groupe;
}
