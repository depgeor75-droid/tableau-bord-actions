// Écran 1 — Synthèse : cours, tuiles clés, points d'attention, tableau « Évolution »,
// graphiques, bloc « Valeur comptable » et carte d'identité financière.

import { h, info, nonDisponible, ouvrirFeuille, lienExterne, svg } from "../dom.js";
import * as f from "../format.js";
import * as donnees from "../donnees.js";
import * as g from "../graphiques.js";

const PERIODES = ["1m", "1a", "5a", "10a"];

// ------------------------------------------------------------------ outils
function sourceRapport(source) {
  if (!source) return "";
  return `${source.titre || "Rapport officiel"}${source.page ? `, p. ${source.page}` : ""}`;
}

function texteDate(fiche) {
  const iso = fiche.actuel?.date_valeur;
  if (!iso) return "";
  return fiche.frequence === "mois" ? f.moisAnnee(iso) : f.date(iso);
}

function infoIndicateur(fiche) {
  return info({
    terme: fiche.glossaire, titre: fiche.libelle,
    texte: [fiche.pourquoi, fiche.actuel?.date_valeur ? `Valeur du ${texteDate(fiche)}. Source : ${fiche.source}.` : null].filter(Boolean).join(" "),
  });
}

function marqueEtat(fiche) {
  if (fiche.etat === "ancien") return h("span", { class: "marque marque--ancien", title: "Dernière valeur connue : la source n'a pas répondu ou n'a pas encore publié de valeur plus récente." }, "ancien");
  return null;
}

function formatAxe(fiche) {
  switch (fiche.type) {
    case "taux": return (v) => `${f.nombre(v, 1)} %`;
    case "ecart": return (v) => `${f.nombre(v, 1)} pt`;
    case "ratio": return (v) => `${f.nombre(v, 0)} %`;
    case "montant": return (v) => f.millions(v);
    case "multiple": return (v) => `${f.nombre(v, 0)} ×`;
    case "rendement_total": return (v) => f.nombre(v, 0);
    case "indice": return (v) => f.nombre(v, 0);
    default: return (v) => `${f.nombre(v, v < 10 ? 2 : 0)}${fiche.unite ? ` ${fiche.unite}` : ""}`;
  }
}

function miniCourbe(valeurs) {
  if (!valeurs || valeurs.length < 3) return null;
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const etendue = max - min || 1;
  const trace = valeurs.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (valeurs.length - 1) * 100).toFixed(1)} ${(27 - (v - min) / etendue * 24).toFixed(1)}`).join(" ");
  return svg("svg", { class: "tuile__mini", viewBox: "0 0 100 30", preserveAspectRatio: "none", "aria-hidden": "true" }, svg("path", { d: trace }));
}

// ------------------------------------------------------- détail d'un indicateur
export function ouvrirDetail(synthese, identifiant) {
  const fiche = synthese.indicateurs[identifiant];
  if (!fiche) return;
  const estRendement = fiche.type === "rendement_total";
  const periodeInitiale = fiche.frequence === "mois" ? "5A" : "1A";
  const { conteneur, canevas } = g.zone(`Évolution : ${fiche.libelle}`);

  async function tracer(periode) {
    if (!g.disponible()) return;
    try {
      let points = g.fenetre(await donnees.serie(fiche.fichier), periode);
      if (points.length < 2) return g.message(conteneur, "Pas assez de données sur cette période.");
      g.message(conteneur, null);
      if (estRendement) points = points.map(([t, v]) => [t, v / points[0][1] * 100]);
      g.courbes(canevas, [{
        nom: estRendement ? "Rendement total (base 100 au début de la période)" : fiche.court, points,
        teinte: "--serie-1", format: (v) => (estRendement ? f.nombre(v, 1) : f.valeurIndicateur(fiche, v)),
      }], {
        axes: { y: { format: formatAxe(fiche) } },
        lignes: fiche.type === "ratio" && fiche.signe ? [{ valeur: 0 }] : (estRendement ? [{ valeur: 100, pointille: true }] : []),
      });
    } catch (erreur) {
      g.message(conteneur, `Historique indisponible (${erreur.message}).`);
    }
  }

  const lignes = PERIODES.map((cle) => {
    const periode = fiche.periodes[cle];
    const variation = f.variationPeriode(fiche, periode);
    const absent = !f.estNombre(periode?.variation);
    return h("tr", {},
      h("th", { scope: "row" }, f.LIBELLES_PERIODES[cle]),
      h("td", {}, absent ? "—" : f.date(periode.date_valeur)),
      h("td", { class: "num" }, absent || estRendement ? "—" : f.valeurIndicateur(fiche, periode.valeur)),
      h("td", { class: `num ${variation.classe}` }, absent
        ? nonDisponible(variation.raison)
        : [h("strong", {}, variation.texte), variation.complement ? h("span", { class: "muet" }, ` (${variation.complement})`) : null]));
  });

  const actuel = fiche.actuel || {};
  const corps = [
    h("p", { class: "feuille__valeur chiffres" },
      estRendement ? "Dividendes réinvestis" : (f.estNombre(actuel.valeur) ? f.valeurIndicateur(fiche, actuel.valeur) : nonDisponible(actuel.raison)), " ", marqueEtat(fiche)),
    h("p", { class: "petit muet" }, actuel.date_valeur ? `Valeur du ${texteDate(fiche)}` : "", fiche.frequence === "mois" ? " (donnée mensuelle)" : ""),
    fiche.pourquoi ? h("p", { class: "explication" }, fiche.pourquoi) : null,
    h("div", { class: "graphique__tete section" },
      h("div", { class: "graphique__titre" }, estRendement ? "Évolution (base 100)" : "Évolution"),
      g.selecteurPeriode(periodeInitiale, tracer)),
    conteneur,
    h("div", { class: "tableau-zone section" }, h("table", { class: "tableau" },
      h("thead", {}, h("tr", {}, h("th", {}, "Il y a"), h("th", {}, "Date retenue"), h("th", { class: "num" }, "Valeur"), h("th", { class: "num" }, "Variation"))),
      h("tbody", {}, lignes))),
    h("p", { class: "aide section" },
      h("strong", {}, "Source : "), fiche.source || "n.d.",
      fiche.secours_utilise ? " (source de secours : la source principale n'a pas répondu)" : "",
      fiche.historique_depuis ? ` · historique disponible depuis le ${f.date(fiche.historique_depuis)}` : "",
      ". Date retenue : dernière observation disponible à la date cible ou juste avant.",
      fiche.type === "taux" || fiche.type === "ecart" || fiche.type === "ratio" ? " Les variations sont en points de pourcentage (pt), jamais en %." : ""),
    fiche.glossaire ? h("p", { class: "aide" }, h("a", { href: `#/plus/glossaire/${fiche.glossaire}`, onclick: () => document.getElementById("feuille").close() }, "Définition dans le glossaire →")) : null,
  ];
  ouvrirFeuille(fiche.libelle, corps);
  tracer(periodeInitiale);
}

// --------------------------------------------------------------- en-tête, tuiles
function heros(synthese) {
  const seance = synthese.seance;
  const cours = synthese.indicateurs.cours;
  if (!seance) {
    return h("section", { class: "heros" }, h("p", { class: "heros__etiquette" }, "Cours de clôture"), h("p", { class: "heros__cours" }, nonDisponible("Le cours n'a pas encore pu être collecté.")));
  }
  const classe = seance.variation_pct > 0 ? "fav" : seance.variation_pct < 0 ? "def" : "neu";
  return h("section", { class: "heros", "aria-label": "Cours de clôture" },
    h("p", { class: "heros__etiquette" }, `Cours de clôture · ${synthese.societe.symbole || ""}`, cours ? infoIndicateur(cours) : null, cours ? marqueEtat(cours) : null),
    h("p", { class: "heros__ligne" },
      h("span", { class: "heros__cours" }, f.euros(seance.cours)),
      h("span", { class: `heros__variation ${classe}` }, `${f.pourcent(seance.variation_pct, 2, true)} (${f.signe(seance.variation_eur, 2)} €)`)),
    h("p", { class: "heros__date" }, `Séance du ${f.date(seance.date)} · variation par rapport à la veille (${f.date(seance.date_veille)})`));
}

function tuiles(synthese) {
  return h("div", { class: "tuiles" }, (synthese.tuiles || []).map((identifiant) => {
    const fiche = synthese.indicateurs[identifiant];
    if (!fiche) return null;
    const variation = f.variationPeriode(fiche, fiche.periodes["1m"]);
    const ouvrir = () => ouvrirDetail(synthese, identifiant);
    return h("div", {
      class: "tuile", role: "button", tabindex: "0", onclick: ouvrir,
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } },
    },
      h("div", { class: "tuile__etiquette" }, h("span", {}, fiche.court), infoIndicateur(fiche)),
      h("div", { class: "tuile__valeur chiffres" }, f.estNombre(fiche.actuel?.valeur) ? f.valeurIndicateur(fiche, fiche.actuel.valeur) : nonDisponible(fiche.actuel?.raison)),
      h("div", { class: `tuile__delta ${variation.classe}` }, variation.texte, h("span", {}, " sur 1 mois")),
      miniCourbe(fiche.mini));
  }));
}

function bandeaux(synthese, contexte) {
  const elements = [];
  for (const rapport of synthese.rapports_a_valider || []) {
    elements.push(h("div", { class: "bandeau bandeau--attention", role: "status" },
      h("span", { class: "bandeau__icone", "aria-hidden": "true" }, "!"),
      h("div", {}, h("strong", {}, `Nouveau rapport publié le ${f.date(rapport.date_publication)} — chiffres à valider`),
        `« ${rapport.titre} ». Les fondamentaux affichés (NTA, endettement…) datent encore du rapport précédent. `,
        lienExterne(rapport.url, "Ouvrir le rapport"))));
  }
  if (contexte.ageJours > 4) {
    elements.push(h("div", { class: "bandeau bandeau--attention", role: "status" },
      h("span", { class: "bandeau__icone", "aria-hidden": "true" }, "!"),
      h("div", {}, h("strong", {}, `Données anciennes : dernière collecte il y a ${contexte.ageJours} jours`),
        "La mise à jour automatique n'a pas tourné. Cliquez sur « Mettre à jour » ou vérifiez l'onglet Actions du dépôt GitHub.")));
  }
  return elements;
}

function maPosition(synthese) {
  const position = donnees.reglages.lire(`position.${synthese.societe.id}`);
  const vc = synthese.valeur_comptable;
  if (!position || !f.estNombre(position.nombre) || position.nombre <= 0 || !synthese.seance) return null;
  const cours = synthese.seance.cours;
  const valeur = position.nombre * cours;
  const faits = [fait("Valeur actuelle", f.euros(valeur, 0), `${f.nombre(position.nombre, 0)} actions × ${f.euros(cours)}`)];
  if (f.estNombre(position.prix) && position.prix > 0) {
    const gain = position.nombre * (cours - position.prix);
    faits.push(fait("Plus-value latente", h("span", { class: gain >= 0 ? "fav" : "def" }, `${f.signe(gain, 0)} €`),
      `${f.pourcent((cours / position.prix - 1) * 100, 1, true)} par rapport à votre prix de revient (${f.euros(position.prix)})`));
  }
  if (vc?.dividende_net) {
    faits.push(fait("Dividende net attendu", f.euros(position.nombre * vc.dividende_net, 0),
      `${f.euros(vc.dividende_net)} net par action (exercice ${vc.exercice}${vc.statut_exercice === "prévision" ? ", prévision" : ""})`));
  }
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Ma position"),
    h("div", { class: "carte" }, h("div", { class: "faits" }, faits),
      h("p", { class: "aide section" }, "Ces chiffres sont calculés sur cet appareil à partir de ce que vous avez saisi dans Plus → Paramètres. Ils ne quittent jamais votre navigateur.")));
}

function pointsAttention(synthese) {
  const points = synthese.points_attention || [];
  const symboles = { alerte: "!", attention: "!", info: "i" };
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Points d'attention"),
    points.length === 0
      ? h("p", { class: "carte muet" }, "Aucun signal particulier aujourd'hui.")
      : h("ul", { class: "points" }, points.map((point) => h("li", { class: `point point--${point.niveau}` },
        h("span", { class: "point__icone", "aria-hidden": "true" }, symboles[point.niveau] || "i"),
        h("div", {},
          h("p", { class: "point__titre" }, point.titre),
          h("p", { class: "point__detail" }, point.detail, point.lien ? [" ", lienExterne(point.lien, "Ouvrir")] : null,
            point.indicateur ? [" ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); ouvrirDetail(synthese, point.indicateur); } }, "Voir l'évolution")] : null))))),
    h("p", { class: "aide section" }, "Règles simples, sans IA, dont les seuils se règlent dans le fichier de configuration."));
}

// ---------------------------------------------------------- tableau « Évolution »
function cellulePeriode(fiche, cle, compacte) {
  const periode = fiche.periodes[cle];
  const variation = f.variationPeriode(fiche, periode);
  const absent = !f.estNombre(periode?.variation);
  const passe = absent || fiche.type === "rendement_total" ? "" : f.valeurIndicateur(fiche, periode.valeur);
  const titre = absent ? variation.raison : `Valeur du ${f.date(periode.date_valeur)}${passe ? ` : ${passe}` : ""}`;
  if (compacte) {
    return h("div", { class: "evo-cellule", title: titre },
      h("div", { class: "evo-cellule__periode" }, f.LIBELLES_PERIODES[cle]),
      absent
        ? h("div", { class: "evo-cellule__variation" }, nonDisponible(variation.raison))
        : [h("div", { class: `evo-cellule__variation ${variation.classe}` }, variation.texte),
          variation.complement ? h("div", { class: "evo-cellule__detail" }, variation.complement) : null,
          passe ? h("div", { class: "evo-cellule__detail" }, passe) : null]);
  }
  return h("td", { title: titre }, absent
    ? nonDisponible(variation.raison)
    : [h("span", { class: `evo-table__variation ${variation.classe}` }, variation.texte),
      h("span", { class: "evo-table__detail" }, [passe, variation.complement].filter(Boolean).join(" · "))]);
}

function valeurActuelle(fiche) {
  if (fiche.type === "rendement_total") return "—";
  return f.estNombre(fiche.actuel?.valeur) ? f.valeurIndicateur(fiche, fiche.actuel.valeur) : nonDisponible(fiche.actuel?.raison);
}

function evolution(synthese) {
  const ouvrir = (identifiant) => () => ouvrirDetail(synthese, identifiant);
  const clavier = (action) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action(); } };

  const cartes = h("div", { class: "evo-cartes-zone" }, synthese.groupes.map((groupe) => h("div", { class: "evo-groupe" },
    h("h3", { class: "evo-groupe__titre" }, groupe.libelle),
    h("div", { class: "evo-cartes" }, groupe.indicateurs.map((identifiant) => {
      const fiche = synthese.indicateurs[identifiant];
      if (!fiche) return null;
      return h("div", { class: "evo-carte", role: "button", tabindex: "0", onclick: ouvrir(identifiant), onkeydown: clavier(ouvrir(identifiant)), "aria-label": `${fiche.libelle} : ouvrir le graphique` },
        h("div", { class: "evo-carte__tete" },
          h("span", { class: "evo-carte__nom" }, fiche.court, infoIndicateur(fiche), marqueEtat(fiche)),
          h("span", { class: "evo-carte__actuel chiffres" }, valeurActuelle(fiche),
            h("span", { class: "evo-carte__date" }, fiche.type === "rendement_total" ? "dividendes réinvestis" : texteDate(fiche)))),
        h("div", { class: "evo-carte__periodes chiffres" }, PERIODES.map((cle) => cellulePeriode(fiche, cle, true))));
    })))));

  const lignes = [];
  for (const groupe of synthese.groupes) {
    lignes.push(h("tr", { class: "evo-table__groupe" }, h("th", { colspan: "6", scope: "colgroup" }, groupe.libelle)));
    for (const identifiant of groupe.indicateurs) {
      const fiche = synthese.indicateurs[identifiant];
      if (!fiche) continue;
      lignes.push(h("tr", { class: "evo-ligne", onclick: ouvrir(identifiant) },
        h("td", {}, h("button", { class: "evo-table__nom", type: "button", onclick: (e) => { e.stopPropagation(); ouvrir(identifiant)(); } }, fiche.libelle), infoIndicateur(fiche), " ", marqueEtat(fiche)),
        h("td", {}, h("span", { class: "evo-table__actuel" }, valeurActuelle(fiche)),
          h("span", { class: "evo-table__detail" }, fiche.type === "rendement_total" ? "dividendes réinvestis" : texteDate(fiche))),
        PERIODES.map((cle) => cellulePeriode(fiche, cle, false))));
    }
  }
  const table = h("div", { class: "carte evo-table-zone" }, h("table", { class: "evo-table" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Indicateur"), h("th", { scope: "col" }, "Actuel"),
      PERIODES.map((cle) => h("th", { scope: "col" }, f.LIBELLES_PERIODES[cle])))),
    h("tbody", {}, lignes)));

  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Évolution"),
    h("p", { class: "section__intro" },
      "Valeur actuelle, puis variation depuis 1 mois, 1 an, 5 ans et 10 ans (avec la valeur à l'époque). ",
      h("span", { class: "fav" }, "Vert"), ` = favorable pour ${synthese.societe.nom}, `, h("span", { class: "def" }, "rouge"),
      " = défavorable : une hausse du Bund est en rouge. Touchez une ligne pour voir le graphique."),
    cartes, table);
}

// ------------------------------------------------------------------ graphiques
function carteGraphique(titre, sousTitre, infoBulle, legende, periodeInitiale, tracer, options = null) {
  const { conteneur, canevas } = g.zone(titre);
  let periode = periodeInitiale;
  const dessiner = async () => {
    if (!g.disponible()) return;
    try { g.message(conteneur, null); await tracer(canevas, periode, conteneur); } catch (erreur) { g.message(conteneur, `Graphique indisponible (${erreur.message}).`); }
  };
  const carte = h("div", { class: "carte graphique" },
    h("div", { class: "graphique__tete" },
      h("div", {}, h("h3", { class: "graphique__titre" }, titre, infoBulle), sousTitre ? h("p", { class: "graphique__sous" }, sousTitre) : null),
      g.selecteurPeriode(periode, (choix) => { periode = choix; dessiner(); })),
    legende, conteneur, options ? options(dessiner) : null);
  return { carte, dessiner };
}

function graphiques(synthese) {
  const ind = synthese.indicateurs;
  const vc = synthese.valeur_comptable;
  const moyenne = vc?.decote_historique?.moyenne_10_ans;
  let inverse = donnees.reglages.lire("bund-inverse", false);

  const coursBund = carteGraphique(
    "Cours AED et Bund 10 ans", "Deux échelles : le cours à gauche (€), le Bund à droite (%).",
    info({ titre: "Cours et Bund", terme: "bund", texte: "Quand le taux long allemand monte, le cours d'une SIR a tendance à baisser. En inversant l'axe du Bund, les deux courbes évoluent dans le même sens quand cette relation joue." }),
    g.legende([{ nom: "Cours AED (axe de gauche, €)", classe: "c1" }, { nom: "Bund 10 ans (axe de droite, %)", classe: "c2" }]),
    "5A",
    async (canevas, periode) => {
      const [cours, bund] = await Promise.all([donnees.serie("cours"), donnees.serie("bund10")]);
      g.courbes(canevas, [
        { nom: "Cours AED", points: g.fenetre(cours, periode), teinte: "--serie-1", axe: "y", format: (v) => f.euros(v) },
        { nom: "Bund 10 ans", points: bund, teinte: "--serie-2", axe: "y1", format: (v) => f.pourcent(v, 2) },
      ], { axes: { y: { format: (v) => `${f.nombre(v, 0)} €` }, y1: { format: (v) => `${f.nombre(v, 1)} %`, inverse } } });
    },
    (dessiner) => h("div", { class: "graphique__options" }, h("label", { class: "case" },
      h("input", { type: "checkbox", checked: inverse, onchange: (e) => { inverse = e.target.checked; donnees.reglages.ecrire("bund-inverse", inverse); dessiner(); } }),
      "Axe du Bund inversé (pour voir la corrélation inverse)")));

  const decote = carteGraphique(
    "Décote / prime sur NTA dans le temps",
    f.estNombre(moyenne) ? `En pointillé : la moyenne sur 10 ans (${f.pourcent(moyenne, 1, true)}).` : null,
    info({ terme: "decote-prime", texte: "À chaque date, le cours réellement coté est comparé à la dernière valeur comptable publiée avant cette date (pas de « triche » avec le futur). Avant 2021 : ancien EPRA NAV ou équivalent (*)." }),
    null, "10A",
    async (canevas, periode) => {
      const points = g.fenetre(await donnees.serie("decote_nta"), periode);
      const lignes = [{ valeur: 0 }];
      if (f.estNombre(moyenne)) lignes.push({ valeur: moyenne, pointille: true, libelle: `Moyenne 10 ans : ${f.pourcent(moyenne, 1, true)}` });
      g.courbes(canevas, [{ nom: "Décote (−) ou prime (+)", points, teinte: "--serie-1", format: (v) => f.pourcent(v, 1, true) }],
        { aire: true, lignes, axes: { y: { format: (v) => `${f.signe(v, 0)} %` } } });
    });

  const rendement = carteGraphique(
    "Rendement du dividende et Bund 10 ans", "L'aire colorée entre les deux courbes est l'écart : la prime de risque de l'action.",
    info({ terme: "ecart-dividende-bund" }),
    g.legende([{ nom: "Rendement brut du dividende", classe: "c3" }, { nom: "Bund 10 ans", classe: "c2" }]),
    "10A",
    async (canevas, periode) => {
      const [dividende, bund] = await Promise.all([donnees.serie("rendement_dividende"), donnees.serie("bund10")]);
      g.courbes(canevas, [
        { nom: "Rendement du dividende", points: g.fenetre(dividende, periode), teinte: "--serie-3", format: (v) => f.pourcent(v, 2) },
        { nom: "Bund 10 ans", points: bund, teinte: "--serie-2", format: (v) => f.pourcent(v, 2) },
      ], { entre: { dessus: "--serie-3", dessous: "--defavorable" }, lignes: [{ valeur: 0 }], axes: { y: { format: (v) => `${f.nombre(v, 0)} %` } } });
    });

  const section = h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Graphiques"),
    h("div", { class: "pile" }, ind.cours && ind.bund10 ? coursBund.carte : null, ind.decote_nta ? decote.carte : null, ind.rendement_dividende ? rendement.carte : null));
  return { section, dessiner: () => { coursBund.dessiner(); decote.dessiner(); rendement.dessiner(); } };
}

// ------------------------------------------------------------ valeur comptable
function fait(etiquette, valeur, note, bulle) {
  return h("div", { class: "fait" },
    h("div", { class: "fait__etiquette" }, etiquette, bulle || null),
    h("div", { class: "fait__valeur chiffres" }, valeur),
    note ? h("div", { class: "fait__note" }, note) : null);
}

function infoSource(terme, donnee) {
  if (!donnee) return info({ terme });
  return info({
    terme,
    texte: `Au ${f.date(donnee.date_cloture)}, publié le ${f.date(donnee.date_publication)}. Source : ${sourceRapport(donnee.source)}.${donnee.mesure ? ` Mesure : ${donnee.mesure}.` : ""}`,
    lien: donnee.source?.url ? { url: donnee.source.url, texte: "Ouvrir le rapport (PDF) →" } : null,
  });
}

function valeurComptable(synthese) {
  const vc = synthese.valeur_comptable;
  if (!vc) {
    return h("section", { class: "section" }, h("h2", { class: "section__titre" }, "Valeur comptable"),
      h("p", { class: "carte" }, nonDisponible("Les fondamentaux (NTA) ou le cours ne sont pas disponibles.")));
  }
  const decote = vc.decote_pct < 0;
  const maxi = Math.max(vc.capitalisation_m_eur || 0, vc.valeur_comptable_totale_m_eur || 0) || 1;
  const barre = (valeur, piste) => {
    const element = h("div", { class: `comparaison__barre${piste ? " comparaison__barre--piste" : ""}` });
    element.style.width = `${Math.max(2, valeur / maxi * 100)}%`;
    return element;
  };
  const hist = vc.decote_historique;
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Valeur comptable", info({ terme: "epra-nta" })),
    h("div", { class: "carte" },
      h("div", { class: "faits" },
        fait("EPRA NTA par action", f.euros(vc.nta.valeur), `au ${f.date(vc.nta.date_cloture)}`, infoSource("epra-nta", vc.nta)),
        vc.van_ifrs ? fait("VAN IFRS par action", f.euros(vc.van_ifrs.valeur), `au ${f.date(vc.van_ifrs.date_cloture)}`, infoSource("van-ifrs", vc.van_ifrs)) : null,
        fait("Cours", f.euros(vc.cours), `clôture du ${f.date(vc.date_cours)}`),
        fait(decote ? "Décote" : "Prime", h("span", {}, f.pourcent(vc.decote_pct, 1, true)), `soit ${f.signe(vc.decote_eur, 2)} € par action`, info({ terme: "decote-prime" })),
        fait("Potentiel de retour à la NTA", f.pourcent(vc.potentiel_retour_nta_pct, 1, true), "hausse du cours nécessaire pour rejoindre la NTA",
          info({ titre: "Potentiel de retour à la NTA", texte: "(NTA ÷ cours − 1) × 100. Ce n'est pas une prévision : rien n'oblige le cours à rejoindre la valeur comptable." })),
        hist ? fait("Moyenne sur 10 ans", f.pourcent(hist.moyenne_10_ans, 1, true),
          `de ${f.pourcent(hist.minimum, 0, true)} (${f.date(hist.date_minimum)}) à ${f.pourcent(hist.maximum, 0, true)} (${f.date(hist.date_maximum)})`,
          info({ titre: "Décote / prime moyenne sur 10 ans", texte: `Moyenne de l'écart quotidien entre le cours et la dernière valeur comptable publiée, depuis le ${f.date(hist.depuis)}.` })) : null),
      h("div", { class: "comparaison" },
        h("div", { class: "comparaison__ligne" }, h("span", {}, "Capitalisation boursière", info({ terme: "capitalisation-boursiere", texte: `${f.euros(vc.cours)} × ${f.nombre(vc.nombre_actions, 0)} actions.` })),
          h("strong", { class: "chiffres" }, f.millions(vc.capitalisation_m_eur)), barre(vc.capitalisation_m_eur, false)),
        h("div", { class: "comparaison__ligne" }, h("span", {}, "Valeur comptable totale", info({ titre: "Valeur comptable totale", texte: `NTA par action × nombre d'actions : ${f.euros(vc.nta.valeur)} × ${f.nombre(vc.nombre_actions, 0)}.` })),
          h("strong", { class: "chiffres" }, f.millions(vc.valeur_comptable_totale_m_eur)), barre(vc.valeur_comptable_totale_m_eur, true))),
      h("p", { class: "explication" },
        "La valeur comptable (EPRA NTA) est publiée quatre fois par an et ", h("strong", {}, "ne bouge pas avec le cours"),
        ". Ce qui change chaque jour, c'est l'écart entre les deux. Aujourd'hui, l'action cote ", h("strong", {}, f.euros(vc.cours)),
        " pour ", h("strong", {}, f.euros(vc.nta.valeur)), " de valeur comptable : ",
        decote ? `une décote de ${f.pourcent(Math.abs(vc.decote_pct), 1)}. ` : `une prime de ${f.pourcent(vc.decote_pct, 1)}. `,
        decote ? `Pour rejoindre sa valeur comptable, le cours devrait monter de ${f.pourcent(vc.potentiel_retour_nta_pct, 1)}.` : "Le marché paie donc l'action plus cher que sa valeur comptable.")),
    h("div", { class: "carte" },
      h("div", { class: "faits" },
        fait("Rendement brut", f.pourcent(vc.rendement_brut_pct, 2), `dividende ${vc.statut_exercice === "prévision" ? "prévu" : ""} ${vc.exercice} : ${f.euros(vc.dividende_brut)}`,
          info({ terme: "rendement-du-dividende", texte: vc.note_exercice, lien: vc.source_exercice?.url ? { url: vc.source_exercice.url, texte: `Source : rapport officiel, p. ${vc.source_exercice.page_dividende} →` } : null })),
        fait("Rendement net", f.pourcent(vc.rendement_net_pct, 2), `${f.euros(vc.dividende_net)} après précompte de ${f.nombre(vc.precompte_mobilier * 100, 0)} %`,
          info({ terme: "precompte-mobilier", texte: vc.precompte_note })),
        fait("Multiple de résultat", `${f.nombre(vc.multiple, 1)} ×`, `EPRA EPS ${vc.statut_exercice === "prévision" ? "prévu" : ""} ${vc.exercice} : ${f.euros(vc.epra_eps)}`, info({ terme: "multiple" })),
        synthese.indicateurs.ecart_dividende_bund ? fait("Écart dividende – Bund", f.valeurIndicateur(synthese.indicateurs.ecart_dividende_bund, synthese.indicateurs.ecart_dividende_bund.actuel?.valeur),
          "rendement brut − Bund 10 ans", info({ terme: "ecart-dividende-bund" })) : null)));
}

// ----------------------------------------------------------- carte d'identité
function identite(synthese) {
  const id = synthese.identite || {};
  const chiffres = id.chiffres || {};
  const element = (cle, etiquette, terme, mise) => {
    const donnee = chiffres[cle];
    if (!donnee) return fait(etiquette, nonDisponible("Chiffre absent du dernier rapport intégré."), null, info({ terme }));
    return fait(etiquette, mise(donnee.valeur), `au ${f.date(donnee.date_cloture)}`, infoSource(terme, donnee));
  };
  const maintenant = new Date(); maintenant.setHours(0, 0, 0, 0);
  const evenements = (id.calendrier?.evenements || []).filter((e) => new Date(`${e.date.length === 7 ? `${e.date}-28` : e.date}T00:00:00`) >= maintenant);
  const perspectives = id.perspectives;
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Carte d'identité financière"),
    h("div", { class: "grille-2" },
      h("div", { class: "carte" },
        h("h3", { class: "graphique__titre" }, "Solidité financière"),
        h("div", { class: "notations section" }, (id.notations || []).map((n) => h("div", { class: "notation" },
          h("div", { class: "fait__etiquette" }, n.agence, info({ terme: "notation-de-credit", texte: n.detail, lien: n.source?.url ? { url: n.source.url, texte: `Source : rapport officiel, p. ${n.source.page} →` } : null })),
          h("div", { class: "notation__note" }, n.note), h("div", { class: "fait__note" }, `perspective ${n.perspective}`)))),
        h("div", { class: "faits section" },
          element("taux_endettement", "Taux d'endettement", "taux-d-endettement", (v) => f.pourcent(v, 1)),
          element("epra_ltv", "EPRA LTV", "ltv", (v) => f.pourcent(v, 1)),
          element("cout_moyen_dette_commissions", "Coût moyen de la dette", "cout-moyen-de-la-dette", (v) => f.pourcent(v, 1)),
          element("ratio_couverture", "Taux de couverture", "ratio-de-couverture", (v) => f.pourcent(v, 1)),
          element("taux_occupation", "Taux d'occupation", "taux-d-occupation", (v) => f.pourcent(v, 1)),
          element("wault", "WAULT", "wault", (v) => `${f.nombre(v, 0)} ans`),
          element("juste_valeur_total", "Patrimoine", "juste-valeur", (v) => f.millions(v)))),
      h("div", { class: "carte" },
        h("h3", { class: "graphique__titre" }, perspectives ? `Prévisions ${perspectives.exercice}` : "Prévisions"),
        perspectives ? h("div", { class: "faits section" },
          fait("EPRA EPS prévu", f.euros(perspectives.epra_eps), `EPRA Earnings : ${f.nombre(perspectives.epra_earnings_m_eur, 0)} M€`, info({ terme: "epra-eps", lien: { url: perspectives.source?.url, texte: `Source : rapport officiel, p. ${perspectives.source?.page} →` } })),
          fait("Dividende brut prévu", f.euros(perspectives.dividende_brut), "payable en mai de l'année suivante"),
          fait("Loyers prévus", f.millions(perspectives.revenus_locatifs_m_eur), "revenus locatifs de l'exercice"),
          fait("Cessions prévues", f.millions(perspectives.cessions_prevues_m_eur), "sur l'ensemble de l'exercice")) : h("p", { class: "muet section" }, "n.d."),
        h("h3", { class: "graphique__titre section" }, "Calendrier", id.calendrier?.source ? info({ titre: "Calendrier financier", texte: `${id.calendrier.source.note || ""} Source : dernier rapport financier, p. ${id.calendrier.source.page}.`, lien: { url: id.calendrier.source.url } }) : null),
        evenements.length ? h("ul", { class: "calendrier" }, evenements.map((e) => {
          const precise = e.date.length === 10;
          const reste = precise ? -f.joursDepuis(e.date) : null;
          return h("li", {},
            h("span", { class: "calendrier__date chiffres" }, f.date(e.date)),
            h("span", {}, e.libelle, precise ? h("span", { class: "calendrier__reste" }, reste === 0 ? "aujourd'hui" : `dans ${reste} jour${reste > 1 ? "s" : ""}`) : null));
        })) : h("p", { class: "muet" }, "Aucune date à venir connue."))),
    h("p", { class: "aide section" }, `Chiffres repris des rapports officiels (fondamentaux vérifiés le ${f.date(id.fondamentaux_mis_a_jour_le)}). Ils changent quatre fois par an.`));
}

// ------------------------------------------------------------------- écran
export async function afficher(racine, contexte) {
  const synthese = contexte.synthese;
  const bloc = graphiques(synthese);
  racine.append(
    heros(synthese),
    ...bandeaux(synthese, contexte),
    tuiles(synthese),
    maPosition(synthese) || "",
    pointsAttention(synthese),
    evolution(synthese),
    bloc.section,
    valeurComptable(synthese),
    identite(synthese),
  );
  bloc.dessiner();
}
