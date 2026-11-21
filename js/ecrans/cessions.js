// Écran 3 — Patrimoine et cessions : avancement du programme de cessions, composition
// du patrimoine par trimestre, ventes annoncées, actifs détenus en vue de la vente.
// Les segments et les blocs du programme viennent de la configuration de la société.

import { h, info, nonDisponible, lienExterne } from "../dom.js";
import * as f from "../format.js";
import * as donnees from "../donnees.js";
import * as g from "../graphiques.js";
import { ligneActu } from "./actus.js";

const TEINTES = [
  { classe: "f1", teinte: "--serie-1" },
  { classe: "f2", teinte: "--serie-2" },
  { classe: "f3", teinte: "--serie-3" },
];
const NEUTRE = { classe: "fn", teinte: "--serie-neutre" };

/** Segments du patrimoine (config) + un dernier « autres », chacun avec sa couleur fixe. */
function segments(pat) {
  const liste = (pat.segments || []).slice(0, 3).map((segment, rang) => ({ ...segment, ...TEINTES[rang] }));
  liste.push({ id: "autres", libelle: pat.libelle_autres || "Autres", court: pat.court_autres || "Autres", ...NEUTRE });
  return liste;
}

const valeurSegment = (trimestre, id) => (id === "autres" ? trimestre.autres : trimestre.segments?.[id]) || 0;

function programme(pat, textes) {
  const p = pat.programme;
  const titre = h("h2", { class: "section__titre" }, "Programme de cessions", textes.programme ? info({ titre: "Programme de cessions", texte: textes.programme }) : null);
  if (!p) return h("section", { class: "section" }, titre, h("p", { class: "carte" }, nonDisponible("Le programme de cessions n'est pas renseigné dans cessions.json.")));
  const rempli = h("div", { class: "jauge__rempli" });
  rempli.style.width = `${Math.max(0.5, p.avancement_pct)}%`;
  const chiffre = (etiquette, valeur, note) => h("div", { class: "fait" },
    h("div", { class: "fait__etiquette" }, etiquette), h("div", { class: "fait__valeur chiffres" }, valeur), h("div", { class: "fait__note" }, note));
  return h("section", { class: "section" }, titre,
    h("div", { class: "carte" },
      h("div", { class: "faits" },
        chiffre("À vendre au départ", f.millions(p.total_depart), `au ${f.date(p.depart.date)}`),
        chiffre("Vendu depuis", f.millions(p.total_vendu, 0), `${f.pourcent(p.avancement_pct, 1)} du programme`),
        chiffre("Reste à vendre", f.millions(p.reste), `${f.pourcent(p.reste_pct, 1)} du programme`)),
      h("div", { class: "jauge section", role: "img", "aria-label": `Programme de cessions réalisé à ${f.pourcent(p.avancement_pct, 1)}` },
        h("div", { class: "jauge__piste" }, rempli),
        h("div", { class: "jauge__legende" }, h("span", {}, `Vendu : ${f.pourcent(p.avancement_pct, 1)}`), h("span", {}, `Reste : ${f.pourcent(p.reste_pct, 1)}`))),
      h("ul", { class: "section" }, p.blocs.map((bloc) => {
        const suivi = f.estNombre(bloc.derniere_juste_valeur);
        return h("li", { class: "bloc-cession" },
          h("div", { class: "bloc-cession__nom" }, bloc.libelle),
          h("div", { class: "bloc-cession__chiffres chiffres" },
            h("div", {}, h("span", { class: "evo-cellule__periode" }, "Au départ"), h("strong", {}, f.millions(bloc.depart, 1))),
            h("div", {}, h("span", { class: "evo-cellule__periode" }, "Vendu depuis"), h("strong", {}, f.millions(bloc.vendu, 0))),
            h("div", {}, h("span", { class: "evo-cellule__periode" }, suivi ? "Dernière juste valeur" : "Reste"),
              h("strong", {}, suivi ? f.millions(bloc.derniere_juste_valeur, 1) : f.millions(bloc.depart - bloc.vendu, 0)))),
          h("div", { class: "aide" }, suivi ? `Dernière juste valeur publiée au ${f.date(bloc.date_derniere_juste_valeur)}. ` : "", bloc.note || ""));
      })),
      h("ul", { class: "aide section" }, (p.notes || []).map((n) => h("li", { class: "section__intro" }, n))),
      h("p", { class: "aide" }, "Sources du point de départ : ", (p.depart.sources || []).map((s, i) => [i ? " · " : "", lienExterne(s.url, s.titre)]))));
}

function patrimoine(pat, textes) {
  const trimestres = pat.trimestres || [];
  const liste = segments(pat);
  const { conteneur, canevas } = g.zone("Juste valeur du patrimoine par trimestre et par segment");
  if (!trimestres.length) {
    return { section: h("section", { class: "section" }, h("h2", { class: "section__titre" }, "Patrimoine par trimestre"), h("p", { class: "carte" }, nonDisponible("La répartition du patrimoine n'est pas renseignée dans fondamentaux.json."))), dessiner: () => {} };
  }
  const section = h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Patrimoine par trimestre", info({ terme: "juste-valeur" })),
    textes.patrimoine ? h("p", { class: "section__intro" }, textes.patrimoine) : null,
    h("div", { class: "carte" },
      g.legende(liste.map((s) => ({ nom: s.libelle, classe: s.classe, carre: true }))),
      conteneur,
      h("div", { class: "tableau-zone section" }, h("table", { class: "tableau tableau--serre" },
        h("caption", { class: "sr" }, "Juste valeur par segment, en millions d'euros"),
        h("thead", {}, h("tr", {}, h("th", {}, "En M€"), trimestres.map((t) => h("th", { class: "num", scope: "col" }, f.dateCourte(t.date_cloture))))),
        h("tbody", {},
          liste.map((s) => h("tr", {},
            h("th", { scope: "row" }, h("span", { class: `legende__carre ${s.classe}`, "aria-hidden": "true" }), " ", s.court),
            trimestres.map((t) => h("td", { class: "num" }, valeurSegment(t, s.id) ? f.nombre(valeurSegment(t, s.id), 0) : "—")))),
          h("tr", { class: "tableau__total" }, h("th", { scope: "row" }, "Total"), trimestres.map((t) => h("td", { class: "num" }, h("strong", {}, f.nombre(t.total, 0))))),
          h("tr", {}, h("th", { scope: "row" }, "dont détenus en vue de la vente"), trimestres.map((t) => h("td", { class: "num" }, f.estNombre(t.actifs_detenus_vente) ? f.nombre(t.actifs_detenus_vente, 1) : "—")))))),
      h("p", { class: "aide section" }, "Sources : ", trimestres.map((t, i) => [i ? " · " : "", lienExterne(t.source.url, `rapport au ${f.date(t.date_cloture)}`)]))));
  const dessiner = () => g.barres(canevas, trimestres.map((t) => f.dateCourte(t.date_cloture)),
    liste.map((s) => ({ nom: s.libelle, valeurs: trimestres.map((t) => valeurSegment(t, s.id)), teinte: s.teinte })),
    { empile: true, format: (v) => f.millions(v), formatTotal: (v) => f.millions(v) });
  return { section, dessiner };
}

function ventes(cessions, pat, nomSociete) {
  const liste = [...(cessions.ventes || [])].sort((a, b) => b.date_tri.localeCompare(a.date_tri));
  const total = liste.reduce((somme, v) => somme + (v.prix_m_eur || 0), 0);
  const resultats = cessions.resultats_sur_ventes || [];
  const parSegment = Object.fromEntries(segments(pat).map((s) => [s.id, s]));
  return h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Ventes annoncées"),
    h("p", { class: "section__intro" }, liste.length
      ? `${f.millions(total, 0)} de ventes recensées, tous segments confondus. Tableau tenu à jour à la main à partir des rapports officiels (dernière vérification : ${f.date(cessions.mis_a_jour_le)}).`
      : "Aucune vente recensée dans cessions.json."),
    (pat.communiques_a_integrer || []).length ? h("div", { class: "bandeau bandeau--attention" }, h("div", {},
      h("strong", {}, "Nouveaux communiqués « Cessions » pas encore repris dans le tableau"),
      h("ul", {}, pat.communiques_a_integrer.map((c) => h("li", {}, `${f.date(c.date)} — `, lienExterne(c.lien, c.titre)))))) : null,
    liste.length ? h("div", { class: "carte" }, h("ul", { class: "ventes" }, liste.map((v) => h("li", { class: "vente" },
      h("div", { class: "vente__tete" },
        h("span", { class: "marque marque--neutre" }, h("span", { class: `legende__carre ${parSegment[v.segment]?.classe || "fn"}`, "aria-hidden": "true" }), " ", parSegment[v.segment]?.libelle || v.segment),
        h("span", { class: "vente__prix chiffres" }, f.estNombre(v.prix_m_eur) ? `≈ ${f.millions(v.prix_m_eur, 0)}` : nonDisponible("Prix non publié."))),
      h("div", { class: "vente__actifs" }, v.actifs),
      h("div", { class: "vente__meta" },
        h("span", {}, v.date_affichee), h("span", {}, v.pays),
        h("span", {}, "Écart avec la juste valeur : ", f.estNombre(v.ecart_juste_valeur_pct) ? f.pourcent(v.ecart_juste_valeur_pct, 1, true)
          : nonDisponible(`${nomSociete} ne publie pas l'écart vente par vente. Voir ci-dessous le résultat global sur les ventes.`)),
        h("span", {}, "Acheteur : ", v.acheteur || nonDisponible("Non communiqué dans le rapport."))),
      v.note ? h("div", { class: "aide" }, v.note) : null,
      h("div", { class: "petit" }, lienExterne(v.source.url, `Source : ${v.source.titre}`)))))) : null,
    resultats.length ? h("div", { class: "carte" },
      h("h3", { class: "graphique__titre" }, "Signal du marché : vendu plus cher ou moins cher que la valeur comptable ?",
        info({ titre: "Résultat sur ventes", texte: "Différence entre le prix de vente et la valeur à laquelle les immeubles étaient inscrits dans les comptes. Positif : vendu au-dessus de la juste valeur (bon signe). Négatif : vendu en dessous. Ce chiffre est publié globalement, pas vente par vente." })),
      h("ul", { class: "section" }, resultats.map((r) => h("li", { class: "bloc-cession" },
        h("div", { class: "vente__tete" }, h("span", { class: "bloc-cession__nom" }, r.periode),
          h("strong", { class: `chiffres ${r.resultat_m_eur >= 0 ? "fav" : "def"}` }, `${f.signe(r.resultat_m_eur, 1)} M€`)),
        h("div", { class: "aide" }, `Résultat sur ≈ ${f.millions(r.ventes_m_eur, 0)} de ventes cumulées. `, lienExterne(r.source.url, `Source : ${r.source.titre}`)))))) : null);
}

function detenus(pat) {
  const trimestres = (pat.trimestres || []).filter((t) => f.estNombre(t.actifs_detenus_vente));
  if (!trimestres.length) return { section: "", dessiner: () => {} };
  const { conteneur, canevas } = g.zone("Actifs détenus en vue de la vente par trimestre", true);
  const section = h("section", { class: "section" },
    h("h2", { class: "section__titre" }, "Actifs détenus en vue de la vente", info({ terme: "actifs-detenus-en-vue-de-la-vente" })),
    h("p", { class: "section__intro" }, "Immeubles dont la vente est décidée et probable à court terme, en fin de trimestre."),
    h("div", { class: "carte" }, conteneur));
  const dessiner = () => g.barres(canevas, trimestres.map((t) => f.dateCourte(t.date_cloture)),
    [{ nom: "Actifs détenus en vue de la vente", valeurs: trimestres.map((t) => t.actifs_detenus_vente), teinte: "--serie-1" }],
    { format: (v) => `${f.nombre(v, 0)} M€`, formatTotal: (v) => `${f.nombre(v, 1)} M€` });
  return { section, dessiner };
}

export async function afficher(racine, contexte) {
  const pat = contexte.synthese.patrimoine || {};
  const textes = contexte.synthese.textes || {};
  const [cessions, actualites] = await Promise.all([donnees.json("cessions", { facultatif: true }), donnees.json("actualites", { facultatif: true })]);
  const blocPatrimoine = patrimoine(pat, textes);
  const blocDetenus = detenus(pat);
  const debut = actualites?.synthese?.debut || "";
  const fil = (actualites?.articles || []).filter((a) => a.categorie === "cessions" && a.date >= debut);
  racine.append(
    programme(pat, textes), blocPatrimoine.section, ventes(cessions || {}, pat, contexte.synthese.societe.nom), blocDetenus.section,
    h("section", { class: "section" },
      h("h2", { class: "section__titre" }, "Actualités « Cessions »"),
      fil.length ? h("div", { class: "carte" }, h("ul", { class: "liste-actus" }, fil.slice(0, 20).map((a) => ligneActu(a, null))))
        : h("p", { class: "carte muet" }, "Aucune actualité classée « Cessions » sur les 6 derniers mois. ", textes.cessions_sans_actualite || "")));
  blocPatrimoine.dessiner();
  blocDetenus.dessiner();
}
