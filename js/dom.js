// Petits outils d'affichage : création d'éléments, info-bulles ⓘ, fenêtre « feuille ».
// Tout texte venant des données est inséré avec textContent (jamais innerHTML) :
// un titre d'article ne peut donc pas injecter de code dans la page.

import { GLOSSAIRE } from "./glossaire.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Crée un élément : h("p", { class: "x", onclick: f }, "texte", autreElement) */
export function h(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === "class") element.className = valeur;
    else if (cle === "dataset") Object.assign(element.dataset, valeur);
    else if (cle.startsWith("on") && typeof valeur === "function") element.addEventListener(cle.slice(2), valeur);
    else if (valeur === true) element.setAttribute(cle, "");
    else element.setAttribute(cle, valeur);
  }
  ajouter(element, enfants);
  return element;
}

export function ajouter(parent, enfants) {
  for (const enfant of [enfants].flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return parent;
}

export function vider(element) {
  element.replaceChildren();
  return element;
}

/** Lien externe : s'ouvre toujours dans un nouvel onglet, sans transmettre l'origine. */
export function lienExterne(url, contenu, attributs = {}) {
  const sur = typeof url === "string" && /^https?:\/\//i.test(url) ? url : "#";
  return h("a", { href: sur, target: "_blank", rel: "noopener noreferrer", ...attributs }, contenu);
}

export function svg(balise, attributs = {}, ...enfants) {
  const element = document.createElementNS(SVG_NS, balise);
  for (const [cle, valeur] of Object.entries(attributs)) element.setAttribute(cle, valeur);
  for (const enfant of enfants) element.append(enfant);
  return element;
}

const ICONES = {
  synthese: "M4 19V10m5 9V5m5 14v-7m5 7V8",
  actus: "M5 5h11v14H7a2 2 0 0 1-2-2V5zm11 4h3v8a2 2 0 0 1-2 2M8 9h5M8 12.5h5M8 16h3",
  cessions: "M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5",
  locataires: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 8.5v-1.5a3.5 3.5 0 0 0-2.6-3.4M15 4.7a3 3 0 0 1 0 5.6",
  plus: "M5 12h.01M12 12h.01M19 12h.01",
};

export function icone(nom) {
  return svg("svg", { class: "icone", viewBox: "0 0 24 24", "aria-hidden": "true" },
    svg("path", {
      d: ICONES[nom] || ICONES.plus, fill: "none", stroke: "currentColor",
      "stroke-width": nom === "plus" ? "3" : "1.8", "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
}

// ------------------------------------------------------------- info-bulles ⓘ
const bulle = () => document.getElementById("bulle");
let declencheurActif = null;

function fermerBulle() {
  const element = bulle();
  if (!element || element.hidden) return;
  element.hidden = true;
  declencheurActif?.setAttribute("aria-expanded", "false");
  declencheurActif = null;
}

function ouvrirBulle(declencheur, contenu) {
  const element = bulle();
  // Une fenêtre modale passe au-dessus de tout le reste : la bulle doit alors vivre dedans.
  const hote = document.querySelector("dialog[open]") || document.body;
  if (element.parentElement !== hote) hote.append(element);
  vider(element);
  ajouter(element, contenu);
  element.hidden = false;
  declencheurActif?.setAttribute("aria-expanded", "false");
  declencheurActif = declencheur;
  declencheur.setAttribute("aria-expanded", "true");
  // Placement : sous le bouton si possible, sinon au-dessus ; toujours dans l'écran.
  const cadre = declencheur.getBoundingClientRect();
  const taille = element.getBoundingClientRect();
  const marge = 12;
  let gauche = cadre.left + cadre.width / 2 - taille.width / 2;
  gauche = Math.max(marge, Math.min(gauche, window.innerWidth - taille.width - marge));
  let haut = cadre.bottom + 8;
  if (haut + taille.height > window.innerHeight - marge) haut = Math.max(marge, cadre.top - taille.height - 8);
  element.style.left = `${Math.round(gauche)}px`;
  element.style.top = `${Math.round(haut)}px`;
}

document.addEventListener("click", (evenement) => {
  if (evenement.target.closest(".info") || evenement.target.closest("#bulle")) return;
  fermerBulle();
});
document.addEventListener("keydown", (evenement) => { if (evenement.key === "Escape") fermerBulle(); });
window.addEventListener("scroll", fermerBulle, { passive: true, capture: true });
window.addEventListener("resize", fermerBulle);

/**
 * Bouton ⓘ. `options.terme` : identifiant d'une entrée du glossaire (définition + lien).
 * `options.texte` : explication libre (date, source, raison d'un « n.d. »…).
 */
export function info(options = {}) {
  const entree = options.terme ? GLOSSAIRE.find((e) => e.id === options.terme) : null;
  const titre = options.titre || entree?.terme || "Information";
  const bouton = h("button", {
    class: "info", type: "button", "aria-label": `Explication : ${titre}`, "aria-expanded": "false",
  }, "ⓘ");
  bouton.addEventListener("click", (evenement) => {
    evenement.stopPropagation();
    evenement.preventDefault();
    if (declencheurActif === bouton) return fermerBulle();
    const contenu = [h("strong", {}, titre)];
    if (options.texte) contenu.push(h("span", {}, options.texte));
    if (entree) {
      if (options.texte) contenu.push(h("br"), h("br"));
      contenu.push(h("span", {}, entree.definition));
      contenu.push(h("br"), h("a", { href: `#/plus/glossaire/${entree.id}`, onclick: () => { fermerBulle(); fermerFeuille(); } }, "Voir le glossaire →"));
    }
    if (options.lien?.url) contenu.push(h("br"), lienExterne(options.lien.url, options.lien.texte || "Ouvrir la source →"));
    ouvrirBulle(bouton, contenu);
  });
  return bouton;
}

/** « n.d. » avec la raison dans une info-bulle (règle d'or : ne jamais inventer une donnée). */
export function nonDisponible(raison) {
  return h("span", { class: "nd" }, "n.d.", raison ? info({ titre: "Non disponible", texte: raison }) : null);
}

// ------------------------------------------------------------------ feuille
function rangerBulle() {
  fermerBulle();
  const element = bulle();
  if (element && element.parentElement !== document.body) document.body.append(element);
}

export function ouvrirFeuille(titre, contenu, options = {}) {
  const feuille = document.getElementById("feuille");
  rangerBulle();
  vider(feuille);
  const fermer = () => feuille.close();
  feuille.append(
    h("div", { class: "feuille__tete" },
      h("h2", { class: "feuille__titre", id: "feuille-titre" }, titre),
      h("button", { class: "feuille__fermer", type: "button", "aria-label": "Fermer", onclick: fermer }, "×")),
    h("div", { class: "feuille__corps" }, contenu),
  );
  feuille.onclose = () => { rangerBulle(); options.aLaFermeture?.(); vider(feuille); };
  feuille.onclick = (evenement) => { if (evenement.target === feuille) fermer(); };
  if (!feuille.open) feuille.showModal();
  return feuille;
}

export function fermerFeuille() {
  const feuille = document.getElementById("feuille");
  if (feuille?.open) feuille.close();
}
