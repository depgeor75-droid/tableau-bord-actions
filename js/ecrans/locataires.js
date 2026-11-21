// Écran 4 — Locataires (exploitants) : part des loyers, cours de bourse des groupes
// cotés (un effondrement = signal de stress), actualités à risque, et santé des
// exploitants par pays (taux d'occupation, couverture des loyers).

import { h, info, nonDisponible, lienExterne } from "../dom.js";
import * as f from "../format.js";
import * as donnees from "../donnees.js";
import { ligneActu } from "./actus.js";

const PERIODES = { "1m": "1 mois", "1a": "1 an", "5a": "5 ans" };

function blocCours(cours) {
  if (!cours) return null;
  if (!f.estNombre(cours.actuel?.valeur)) return h("p", { class: "aide" }, "Cours : ", nonDisponible("Le cours de ce locataire n'a pas pu être collecté."));
  const fiche = { type: "cours", decimales: 2 };
  return h("div", {},
    h("div", { class: "cours-locataire chiffres" },
      h("div", { class: "evo-cellule" }, h("div", { class: "evo-cellule__periode" }, `Cours (${cours.symbole})`),
        h("div", { class: "evo-cellule__variation" }, `${f.nombre(cours.actuel.valeur, 2)} ${cours.devise}`),
        h("div", { class: "evo-cellule__detail" }, f.dateCourte(cours.actuel.date_valeur))),
      Object.entries(PERIODES).map(([cle, libelle]) => {
        const variation = f.variationPeriode(fiche, cours.periodes[cle]);
        const absent = variation.classe === "nd";
        return h("div", { class: "evo-cellule", title: absent ? variation.raison : `Cours du ${f.date(cours.periodes[cle].date_valeur)} : ${f.nombre(cours.periodes[cle].valeur, 2)} ${cours.devise}` },
          h("div", { class: "evo-cellule__periode" }, libelle),
          absent ? h("div", { class: "evo-cellule__variation" }, nonDisponible(variation.raison)) : h("div", { class: `evo-cellule__variation ${variation.classe}` }, variation.texte));
      })),
    h("p", { class: "aide" }, `${cours.bourse || "Bourse"} · ${cours.source}. ${cours.note || ""}`, cours.etat === "ancien" ? " Dernière valeur connue : la source n'a pas répondu." : ""));
}

function carteLocataire(locataire, seuilJours) {
  const metre = h("div", { class: "metre__rempli" });
  metre.style.width = `${Math.min(100, locataire.part_loyers / 12 * 100)}%`;
  const actus = locataire.actualites || [];
  const aRisque = actus.filter((a) => a.risque).length;
  return h("li", { class: "carte" },
    h("div", { class: "locataire__tete" },
      h("div", {},
        h("h3", { class: "locataire__nom" }, locataire.nom, " ",
          locataire.alerte ? h("span", { class: "marque marque--risque" }, "Alerte") : null),
        h("p", { class: "locataire__pays" }, `${locataire.pays} · ${f.nombre(locataire.sites, 0)} sites · `,
          locataire.cote ? "coté en bourse" : "non coté",
          locataire.segment === "distribution" ? " · réseaux de distribution" : "")),
      h("div", { class: "locataire__part chiffres" }, h("strong", {}, `${f.nombre(locataire.part_loyers, 0)} %`), h("span", { class: "petit muet" }, "des loyers"))),
    h("div", { class: "metre", role: "img", "aria-label": `${locataire.part_loyers} % des loyers` }, metre),
    locataire.alerte ? h("div", { class: "bandeau bandeau--alerte" }, h("span", { class: "bandeau__icone", "aria-hidden": "true" }, "!"), h("div", {},
      h("strong", {}, `Actualité à risque de moins de ${seuilJours} jours`),
      `${f.date(locataire.alerte.date)} — `, lienExterne(locataire.alerte.lien, locataire.alerte.titre),
      h("span", { class: "petit" }, ` (mot-clé : ${locataire.alerte.mots_risque.join(", ")})`))) : null,
    locataire.note ? h("p", { class: "aide" }, locataire.note) : null,
    blocCours(locataire.cours),
    locataire.veille_actualites
      ? h("details", { class: "details" },
        h("summary", {}, actus.length ? `Dernières actualités (${actus.length}${aRisque ? `, dont ${aRisque} avec un mot-clé de risque` : ""})` : "Aucune actualité récente trouvée"),
        actus.length ? h("ul", { class: "liste-actus" }, actus.map((a) => ligneActu(a, null))) : null)
      : null);
}

function parPays(donneesPays) {
  if (!donneesPays) return null;
  const tableau = (titre, bulle, enTetes, lignes) => h("div", { class: "carte" },
    h("h3", { class: "graphique__titre" }, titre, bulle),
    h("div", { class: "tableau-zone section" }, h("table", { class: "tableau" },
      h("thead", {}, h("tr", {}, enTetes.map((e, i) => h("th", { class: i ? "num" : "" }, e)))), h("tbody", {}, lignes))));
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Santé des exploitants, par pays"),
    h("p", { class: "section__intro" }, donneesPays.explication, ` Situation au ${f.date(donneesPays.date)}.`),
    h("div", { class: "grille-2" },
      tableau("Taux d'occupation des maisons de repos", info({ terme: "taux-d-occupation", texte: "Ici : part des lits occupés chez les exploitants (pas le taux d'occupation du patrimoine de la société)." }),
        ["Pays", "Occupation", "Sur un an"],
        donneesPays.taux_occupation.map((l) => h("tr", {}, h("th", { scope: "row" }, l.pays), h("td", { class: "num" }, f.pourcent(l.valeur, 0)),
          h("td", { class: `num ${l.variation_pb >= 0 ? "fav" : "def"}` }, `${f.signe(l.variation_pb, 0)} pb`)))),
      tableau("Couverture des loyers", info({ terme: "ebitdar" }),
        ["Pays", "Couverture", "Données"],
        donneesPays.couverture_loyers.map((l) => h("tr", {}, h("th", { scope: "row" }, l.pays), h("td", { class: "num" }, h("strong", {}, `${f.nombre(l.valeur, 1)} ×`)),
          h("td", { class: "num muet" }, `${f.nombre(l.couverture_donnees, 0)} % du loyer`))))),
    h("p", { class: "aide section" }, lienExterne(donneesPays.source.url, `Source : ${donneesPays.source.titre}, p. ${donneesPays.source.page}`)));
}

export async function afficher(racine) {
  const d = await donnees.json("locataires");
  const liste = d.locataires || [];
  const alertes = liste.filter((l) => l.alerte);
  const total = liste.reduce((somme, l) => somme + (l.part_loyers || 0), 0);
  racine.append(
    h("section", { class: "section" },
      h("h2", { class: "section__titre" }, "Principaux locataires", info({ terme: "exploitant" })),
      h("p", { class: "section__intro" },
        `Les ${liste.length} premiers groupes pèsent ${f.nombre(total, 0)} % des loyers (${d.nombre_groupes ? `sur environ ${d.nombre_groupes} groupes de locataires` : "portefeuille diversifié"}). `,
        `Parts au ${f.date(d.date_parts)}. `, d.source_parts ? lienExterne(d.source_parts.url, "Source : rapport semestriel") : null),
      alertes.length
        ? h("div", { class: "bandeau bandeau--alerte" }, h("span", { class: "bandeau__icone", "aria-hidden": "true" }, "!"), h("div", {}, h("strong", {}, `${alertes.length} locataire${alertes.length > 1 ? "s" : ""} avec une actualité à risque récente`), alertes.map((l) => l.nom).join(", ")))
        : h("div", { class: "bandeau bandeau--info" }, h("div", {}, h("strong", {}, "Aucune alerte"), `Aucune actualité contenant un mot-clé de risque (faillite, insolvabilité, restructuration, loyers impayés…) depuis ${d.seuil_alerte_jours} jours.`)),
      h("ul", { class: "pile section" }, liste.map((l) => carteLocataire(l, d.seuil_alerte_jours)))),
    parPays(d.exploitants_par_pays) || "",
    h("p", { class: "aide section" }, `Cours et actualités collectés le ${f.dateHeure(d.genere_le)}. La veille des actualités repose sur des mots-clés dans les titres (français, néerlandais, anglais, allemand) : elle peut manquer un article ou en signaler un à tort.`));
}
