// Écran 2 — Actualités : synthèse des 6 derniers mois (sans IA par défaut), puis la
// liste filtrable. On n'affiche jamais le texte des articles de presse : seulement le
// titre, la source, la date et un lien qui s'ouvre dans un nouvel onglet.

import { h, vider, info, lienExterne } from "../dom.js";
import * as f from "../format.js";
import * as donnees from "../donnees.js";
import * as g from "../graphiques.js";

const LANGUES = { fr: "Français", nl: "Néerlandais", en: "Anglais" };
const PAR_PAGE = 40;

export function ligneActu(article, categories, options = {}) {
  return h("li", { class: "actu" },
    h("div", { class: "actu__meta" },
      h("span", { class: "chiffres" }, f.date(article.date)),
      article.officiel ? h("span", { class: "marque marque--officiel" }, "Officiel") : h("span", {}, article.source),
      categories && article.categorie ? h("span", { class: "marque marque--neutre" }, categories[article.categorie] || article.categorie) : null,
      article.langue && article.langue !== "fr" ? h("span", { class: "marque marque--neutre", title: LANGUES[article.langue] || article.langue }, article.langue.toUpperCase()) : null,
      article.risque ? h("span", { class: "marque marque--risque" }, "Mot-clé de risque") : null),
    lienExterne(article.lien, article.titre, { class: "actu__titre" }),
    options.extrait && article.extrait ? h("p", { class: "actu__extrait" }, article.extrait) : null);
}

function syntheseSansIA(actualites, filtres, relancer) {
  const s = actualites.synthese;
  const categories = actualites.categories;
  const parId = new Map(actualites.articles.map((a) => [a.id, a]));
  const { conteneur, canevas } = g.zone("Nombre d'actualités par mois", true);

  const puces = h("div", { class: "puces" }, Object.entries(categories).map(([cle, libelle]) => h("button", {
    class: "puce", type: "button", "aria-pressed": String(filtres.categorie === cle), disabled: s.compteurs[cle] === 0 ? true : null,
    onclick: () => { filtres.categorie = filtres.categorie === cle ? "" : cle; relancer(true); },
  }, libelle, h("span", { class: "puce__nombre" }, String(s.compteurs[cle] || 0)))));

  const officiels = s.derniers_officiels.map((id) => parId.get(id)).filter(Boolean);
  const section = h("section", { class: "section" },
    h("h2", { class: "section__titre" }, `Synthèse des ${actualites.mois_affiches} derniers mois`),
    h("p", { class: "section__intro" }, `Du ${f.date(s.debut)} au ${f.date(s.fin)} : ${s.total} actualités, dont ${s.officiels} communiqués officiels.`),
    h("div", { class: "carte" },
      h("h3", { class: "graphique__titre" }, "Par catégorie", info({ titre: "Catégories", texte: "Classement automatique d'après des mots-clés français, néerlandais et anglais présents dans le titre. Touchez une catégorie pour filtrer la liste." })),
      h("div", { class: "section" }, puces)),
    h("div", { class: "carte" },
      h("h3", { class: "graphique__titre" }, "Frise chronologique"),
      g.legende([{ nom: "Communiqués officiels", classe: "f1", carre: true }, { nom: "Presse", classe: "fn", carre: true }]),
      conteneur),
    h("div", { class: "carte" },
      h("h3", { class: "graphique__titre" }, "Les 5 derniers communiqués officiels"),
      officiels.length ? h("ul", { class: "liste-actus" }, officiels.map((a) => ligneActu(a, categories, { extrait: true }))) : h("p", { class: "muet section" }, "Aucun communiqué officiel sur la période.")));

  const dessiner = () => g.barres(canevas, s.par_mois.map((m) => m.libelle), [
    { nom: "Communiqués officiels", valeurs: s.par_mois.map((m) => m.officiels), teinte: "--serie-1" },
    { nom: "Presse", valeurs: s.par_mois.map((m) => m.total - m.officiels), teinte: "--serie-neutre" },
  ], { empile: true, formatTotal: (v) => f.nombre(v, 0) });
  return { section, dessiner };
}

function syntheseIA(actualites) {
  const ia = actualites.synthese_ia;
  if (!ia || !ia.texte) return null;
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Synthèse rédigée par IA", info({ titre: "Synthèse IA", texte: "Option facultative : un modèle d'IA (API Claude) résume les titres des 6 derniers mois, au plus une fois par semaine. Les numéros entre crochets renvoient aux sources." })),
    h("div", { class: "carte" },
      h("p", { class: "texte-ia" }, ia.texte),
      h("p", { class: "aide section" }, `${ia.avertissement || ""} Générée le ${f.dateHeure(ia.genere_le)} (${ia.modele}).`),
      h("details", { class: "details" }, h("summary", {}, `Sources numérotées (${ia.sources.length})`),
        h("ol", { class: "liste-actus" }, ia.sources.map((s) => h("li", { class: "actu" },
          h("div", { class: "actu__meta" }, `[${s.numero}] ${f.date(s.date)} · ${s.source}`), lienExterne(s.lien, s.titre, { class: "actu__titre" })))))));
}

export async function afficher(racine, contexte) {
  const actualites = await donnees.json("actualites");
  const categories = actualites.categories;
  const filtres = { categorie: "", type: "", langue: "", periode: "6" };
  let affiches = PAR_PAGE;
  const liste = h("div", {});
  const compteur = h("p", { class: "aide", role: "status" });

  const choix = (etiquette, cle, optionsListe) => h("label", { class: "sr-etiquette" },
    h("span", { class: "sr" }, etiquette),
    h("select", { "aria-label": etiquette, onchange: (e) => { filtres[cle] = e.target.value; affiches = PAR_PAGE; dessinerListe(); } },
      optionsListe.map(([valeur, libelle]) => h("option", { value: valeur, selected: filtres[cle] === valeur ? true : null }, libelle))));

  const barreFiltres = h("div", { class: "filtres" });
  function dessinerFiltres() {
    vider(barreFiltres).append(
      choix("Catégorie", "categorie", [["", "Toutes les catégories"], ...Object.entries(categories)]),
      choix("Type", "type", [["", "Officiel et presse"], ["officiel", "Communiqués officiels"], ["presse", "Presse"]]),
      choix("Langue", "langue", [["", "Toutes les langues"], ...Object.entries(LANGUES)]),
      choix("Période", "periode", [["6", `${actualites.mois_affiches} derniers mois`], ["tout", "Toute l'archive"]]));
  }

  function dessinerListe() {
    const debut = actualites.synthese.debut;
    const retenus = actualites.articles.filter((a) =>
      (!filtres.categorie || a.categorie === filtres.categorie) &&
      (!filtres.type || (filtres.type === "officiel") === a.officiel) &&
      (!filtres.langue || a.langue === filtres.langue) &&
      (filtres.periode === "tout" || a.date >= debut));
    vider(liste);
    compteur.textContent = `${retenus.length} actualité${retenus.length > 1 ? "s" : ""}.`;
    if (!retenus.length) { liste.append(h("p", { class: "carte muet" }, "Aucune actualité ne correspond à ces filtres.")); return; }
    let moisCourant = "";
    let bloc = null;
    const carte = h("div", { class: "carte" });
    for (const article of retenus.slice(0, affiches)) {
      const mois = article.date.slice(0, 7);
      if (mois !== moisCourant) {
        moisCourant = mois;
        carte.append(h("h3", { class: "mois-titre" }, f.moisAnnee(mois)));
        bloc = h("ul", { class: "liste-actus" });
        carte.append(bloc);
      }
      bloc.append(ligneActu(article, categories));
    }
    liste.append(carte);
    if (retenus.length > affiches) {
      liste.append(h("div", { class: "actions section" }, h("button", { class: "bouton", type: "button", onclick: () => { affiches += PAR_PAGE; dessinerListe(); } },
        `Afficher plus (${retenus.length - affiches} restantes)`)));
    }
  }

  const section = h("section", { class: "section", id: "liste-actus" },
    h("h2", { class: "section__titre" }, "Toutes les actualités"),
    h("p", { class: "section__intro" }, "Les liens s'ouvrent dans un nouvel onglet. Certains journaux (L'Echo, De Tijd) sont réservés à leurs abonnés."),
    barreFiltres, compteur, liste);

  const relancer = (defiler) => {
    affiches = PAR_PAGE;
    dessinerFiltres();
    dessinerListe();
    vider(zoneSynthese);
    const bloc = syntheseSansIA(actualites, filtres, relancer);
    zoneSynthese.append(bloc.section);
    bloc.dessiner();
    if (defiler) section.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const zoneSynthese = h("div", {});
  racine.append(syntheseIA(actualites) || "", zoneSynthese, section,
    h("p", { class: "aide section" }, `Actualités collectées le ${f.dateHeure(actualites.genere_le)}. Communiqués officiels : site de la société. Presse : Google Actualités (français, néerlandais, anglais), doublons retirés.`));
  relancer(false);
}
