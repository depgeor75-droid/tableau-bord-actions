// Point d'entrée : navigation entre les écrans, en-tête (pastille d'état, bouton
// « Mettre à jour ») et chargement des données produites par la collecte.

import * as donnees from "./donnees.js";
import * as f from "./format.js";
import * as maj from "./maj.js";
import { h, vider, icone, ouvrirFeuille, fermerFeuille, lienExterne } from "./dom.js";
import { nettoyer } from "./graphiques.js";
import { completerGlossaire } from "./glossaire.js";

const ECRANS = [
  { id: "synthese", libelle: "Synthèse", module: () => import("./ecrans/synthese.js") },
  { id: "actus", libelle: "Actus", module: () => import("./ecrans/actus.js") },
  { id: "cessions", libelle: "Cessions", module: () => import("./ecrans/cessions.js") },
  { id: "locataires", libelle: "Locataires", module: () => import("./ecrans/locataires.js") },
  { id: "plus", libelle: "Plus", module: () => import("./ecrans/plus.js") },
];
const racine = document.getElementById("contenu");
let contexte = null;
let tour = 0; // évite qu'un écran lent s'affiche par-dessus un écran demandé ensuite

function route() {
  const morceaux = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const ecran = ECRANS.find((e) => e.id === morceaux[0]) || ECRANS[0];
  return { ecran, suite: morceaux.slice(1) };
}

// ------------------------------------------------------------------ onglets
function dessinerOnglets() {
  const actif = route().ecran.id;
  const alerteLocataire = (contexte?.synthese.points_attention || []).some((p) => p.id === "locataire");
  for (const zone of [document.getElementById("onglets-haut"), document.getElementById("onglets-bas")]) {
    vider(zone);
    for (const ecran of ECRANS) {
      zone.append(h("a", { class: "onglet", href: `#/${ecran.id}`, "aria-current": ecran.id === actif ? "page" : null },
        icone(ecran.id), h("span", {}, ecran.libelle),
        ecran.id === "locataires" && alerteLocataire ? h("span", { class: "onglet__marque", title: "Signal de risque chez un locataire" }) : null));
    }
  }
}

// ------------------------------------------------------------------ en-tête
function etatAffiche() {
  const global = contexte.synthese.etat_global || { niveau: "orange", message: "" };
  if (global.niveau === "vert" && contexte.ageJours > 4) {
    return { niveau: "orange", message: `Dernière collecte il y a ${contexte.ageJours} jours : les données sont anciennes.` };
  }
  return global;
}

function dessinerEntete() {
  const { synthese } = contexte;
  document.title = `${synthese.societe.nom} — tableau de bord`;
  document.getElementById("nom-societe").textContent = synthese.societe.nom;
  document.getElementById("sous-societe").textContent = `Données du ${f.dateHeure(synthese.genere_le)}`;
  const etat = etatAffiche();
  const pastille = document.getElementById("pastille");
  pastille.className = `etat etat--${etat.niveau}`;
  const textes = { vert: "À jour", orange: "Données partielles", rouge: "Échec de collecte" };
  document.getElementById("pastille-texte").textContent = textes[etat.niveau] || "";
  pastille.setAttribute("aria-label", `État des données : ${textes[etat.niveau]}. ${etat.message}`);
  pastille.onclick = ouvrirEtat;
  document.getElementById("pied-detail").textContent = synthese.textes?.sources || "";
}

function ouvrirEtat() {
  const etat = etatAffiche();
  const global = contexte.synthese.etat_global || {};
  const titres = { vert: "Tout est à jour", orange: "Certaines données sont anciennes", rouge: "Échec de collecte" };
  ouvrirFeuille("État des données", [
    h("div", { class: `bandeau bandeau--${{ vert: "info", orange: "attention", rouge: "alerte" }[etat.niveau]}` },
      h("div", {}, h("strong", {}, titres[etat.niveau]), etat.message)),
    h("p", { class: "section" }, `Dernière collecte : ${f.dateHeure(contexte.synthese.genere_le)}.`),
    h("p", { class: "aide" }, "Les données sont collectées automatiquement chaque soir de semaine après la clôture d'Euronext, ou à la demande avec le bouton « Mettre à jour »."),
    (global.sources_en_panne || []).length ? [
      h("h3", { class: "graphique__titre section" }, "Sources qui n'ont pas répondu"),
      h("ul", {}, global.sources_en_panne.map((s) => h("li", { class: "source-ligne" },
        h("span", { class: "source-ligne__etat def", "aria-hidden": "true" }, "✕"),
        h("div", {}, h("strong", {}, s.libelle), h("div", { class: "source-ligne__detail" }, s.message || "pas de réponse"))))),
      h("p", { class: "aide" }, "L'application affiche pour ces indicateurs la dernière valeur valide connue, avec sa date."),
    ] : null,
    (global.indicateurs_anciens || []).length
      ? h("p", { class: "section" }, h("strong", {}, "Indicateurs dont la dernière valeur est ancienne : "), global.indicateurs_anciens.join(", "), ".") : null,
    h("p", { class: "section" }, h("a", { href: "#/plus/sources", onclick: fermerFeuille }, "Voir le détail de toutes les sources →")),
  ]);
}

// ------------------------------------------------------------- mise à jour
const progression = {
  zone: document.getElementById("progression"),
  texte: document.getElementById("progression-texte"),
  barre: document.getElementById("progression-barre"),
  montrer({ texte, part }) {
    this.zone.hidden = false;
    this.texte.textContent = texte;
    this.barre.style.width = `${Math.round(Math.max(0.02, part) * 100)}%`;
  },
  cacher() { this.zone.hidden = true; this.barre.style.width = "0"; },
};

function sourcesEnPanne() {
  return (contexte?.synthese.etat_global?.sources_en_panne || []).map((s) => s.libelle);
}

async function apresMiseAJour(resultat) {
  donnees.rafraichir();
  await demarrer();
  const pannes = sourcesEnPanne();
  const corps = [];
  if (resultat.etat === "ok" && !pannes.length) {
    corps.push(h("div", { class: "bandeau bandeau--info" }, h("div", {}, h("strong", {}, "Données mises à jour"), `Collecte du ${f.dateHeure(contexte.synthese.genere_le)} : toutes les sources ont répondu.`)));
  } else {
    corps.push(h("div", { class: "bandeau bandeau--attention" }, h("div", {},
      h("strong", {}, "Mise à jour partielle"), resultat.message || `Collecte du ${f.dateHeure(contexte.synthese.genere_le)}.`)));
    if (pannes.length) {
      corps.push(h("p", { class: "section" }, h("strong", {}, "Sources en échec : "), pannes.join(", "), "."),
        h("p", { class: "aide" }, "Pour ces indicateurs, l'application garde la dernière valeur valide connue, avec sa date."));
    }
  }
  if (resultat.lien) corps.push(h("p", { class: "section" }, lienExterne(resultat.lien, "Voir le détail sur GitHub")));
  ouvrirFeuille("Mise à jour", corps);
}

async function mettreAJour() {
  const bouton = document.getElementById("bouton-maj");
  if (bouton.disabled) return;
  bouton.disabled = true;
  bouton.classList.add("bouton--occupe");
  try {
    const resultat = await maj.lancer((etape) => progression.montrer(etape));
    if (resultat.etat === "sans-jeton") {
      window.open(resultat.lien, "_blank", "noopener");
      ouvrirFeuille("Mettre à jour sans jeton", [
        h("p", {}, "La page GitHub du workflow vient de s'ouvrir dans un nouvel onglet. Là-bas : bouton ", h("strong", {}, "« Run workflow »"), " (à droite), puis le bouton vert ", h("strong", {}, "« Run workflow »"), "."),
        h("p", { class: "section" }, lienExterne(resultat.lien, "Rouvrir la page GitHub du workflow")),
        h("div", { class: "actions section" }, h("button", {
          class: "bouton bouton--primaire", type: "button",
          onclick: async () => {
            fermerFeuille();
            bouton.disabled = true;
            const arrive = await maj.attendreNouvellesDonnees((etape) => progression.montrer(etape));
            progression.cacher();
            bouton.disabled = false;
            if (arrive) await apresMiseAJour({ etat: "ok" });
            else ouvrirFeuille("Mise à jour", h("p", {}, "Pas de nouvelles données après 5 minutes. Vérifiez sur GitHub que la collecte a bien été lancée, puis rechargez la page."));
          },
        }, "C'est lancé : attendre les nouvelles données")),
        h("p", { class: "aide section" }, "Pour mettre à jour en un seul clic depuis cette page, enregistrez un jeton GitHub dans ",
          h("a", { href: "#/plus/parametres", onclick: fermerFeuille }, "Plus → Paramètres"), " (à faire une fois par appareil)."),
      ]);
    } else if (resultat.etat === "ok" || resultat.etat === "echec") {
      await apresMiseAJour(resultat);
    } else {
      ouvrirFeuille("Mise à jour", [
        h("div", { class: "bandeau bandeau--attention" }, h("div", {}, h("strong", {}, resultat.etat === "delai" ? "Délai dépassé" : "La mise à jour n'a pas pu être lancée"), resultat.message)),
        resultat.lien ? h("p", { class: "section" }, lienExterne(resultat.lien, "Voir la collecte sur GitHub")) : null,
        resultat.etat === "erreur" ? h("p", { class: "section" }, h("a", { href: "#/plus/parametres", onclick: fermerFeuille }, "Ouvrir les paramètres du jeton →")) : null,
      ]);
    }
  } finally {
    progression.cacher();
    bouton.disabled = false;
    bouton.classList.remove("bouton--occupe");
  }
}

// ------------------------------------------------------------------ écrans
async function afficher() {
  const moi = ++tour;
  const { ecran, suite } = route();
  dessinerOnglets();
  vider(racine);
  nettoyer();
  racine.append(h("p", { class: "chargement" }, "Chargement…"));
  try {
    const module = await ecran.module();
    if (moi !== tour) return;
    const page = document.createDocumentFragment();
    const conteneur = h("div", {});
    page.append(conteneur);
    vider(racine);
    racine.append(page);
    await module.afficher(conteneur, contexte, suite);
    if (moi !== tour) return;
    if (!suite.length) window.scrollTo(0, 0);
  } catch (erreur) {
    console.error(erreur);
    if (moi !== tour) return;
    vider(racine);
    racine.append(erreurAffichage("Cet écran n'a pas pu s'afficher.", erreur));
  }
}

function erreurAffichage(titre, erreur) {
  return h("div", { class: "bandeau bandeau--alerte" }, h("div", {},
    h("strong", {}, titre), `${erreur?.message || erreur}`,
    h("div", { class: "actions section" }, h("button", { class: "bouton", type: "button", onclick: () => location.reload() }, "Recharger la page"))));
}

async function demarrer() {
  try {
    const [synthese, sources] = await Promise.all([donnees.json("synthese"), donnees.json("etat_sources", { facultatif: true })]);
    contexte = { synthese, sources, societe: donnees.societe(), ageJours: f.joursDepuis(synthese.genere_le) };
    completerGlossaire(synthese.glossaire);
    dessinerEntete();
    await afficher();
  } catch (erreur) {
    console.error(erreur);
    vider(racine);
    document.getElementById("pastille").className = "etat etat--rouge";
    document.getElementById("pastille-texte").textContent = "Données absentes";
    racine.append(erreurAffichage("Les données n'ont pas pu être chargées.",
      new Error(`${erreur.message}. Si le site vient d'être créé, lancez une première collecte avec « Mettre à jour ».`)));
  }
}

window.addEventListener("hashchange", () => { fermerFeuille(); if (contexte) afficher(); });
// Les graphiques lisent leurs couleurs à la création : on les redessine si l'appareil change de thème.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (contexte) afficher(); });
document.getElementById("bouton-maj").addEventListener("click", mettreAJour);
dessinerOnglets();
demarrer();
