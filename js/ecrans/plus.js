// Écran 5 — Plus : glossaire (avec recherche), état des sources, paramètres
// (jeton GitHub, thème, « Ma position »).

import { h, vider, lienExterne } from "../dom.js";
import * as f from "../format.js";
import * as donnees from "../donnees.js";
import * as maj from "../maj.js";
import { GLOSSAIRE } from "../glossaire.js";

const PAGES = { glossaire: "Glossaire", sources: "État des sources", parametres: "Paramètres" };

function normaliser(texte) {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------------------------------------------------------------- glossaire
function glossaire(terme) {
  const liste = h("dl", { class: "glossaire" });
  const vide = h("p", { class: "muet", hidden: true }, "Aucun terme ne correspond à cette recherche.");
  const entrees = [...GLOSSAIRE].sort((a, b) => a.terme.localeCompare(b.terme, "fr"));
  function dessiner(recherche) {
    const cle = normaliser(recherche.trim());
    vider(liste);
    let nombre = 0;
    for (const entree of entrees) {
      if (cle && !normaliser(`${entree.terme} ${entree.definition}`).includes(cle)) continue;
      nombre += 1;
      liste.append(h("dt", { id: `terme-${entree.id}`, class: entree.id === terme ? "surligne" : null }, entree.terme), h("dd", {}, entree.definition));
    }
    vide.hidden = nombre > 0;
  }
  dessiner("");
  const champ = h("input", { class: "recherche", type: "search", placeholder: "Rechercher un terme (NTA, Bund, WAULT…)", "aria-label": "Rechercher dans le glossaire", oninput: (e) => dessiner(e.target.value) });
  if (terme) requestAnimationFrame(() => document.getElementById(`terme-${terme}`)?.scrollIntoView({ block: "center" }));
  return h("div", {}, champ, h("div", { class: "carte" }, liste, vide));
}

// ------------------------------------------------------------------ sources
function sources(contexte) {
  const etat = contexte.sources;
  if (!etat) return h("p", { class: "carte muet" }, "Le fichier d'état des sources n'est pas disponible.");
  const groupes = { marche: "Marchés : cours, taux, indices", actualites: "Actualités", locataires: "Locataires", rapports: "Rapports financiers", ia: "Option IA", calculs: "Calculs" };
  const blocs = Object.entries(groupes).map(([cle, titre]) => {
    const lignes = etat.sources.filter((s) => (s.categorie || "marche") === cle);
    if (!lignes.length) return null;
    return h("div", { class: "carte" }, h("h3", { class: "graphique__titre" }, titre), h("ul", { class: "section" }, lignes.map((s) => {
      const ok = s.etat === "OK";
      const details = [];
      if (s.source_utilisee) details.push(`Source : ${s.source_utilisee}${s.secours_utilise ? " (source de secours)" : ""}`);
      if (s.derniere_date) details.push(`dernière valeur du ${f.date(s.derniere_date)}${s.ancienne ? " (ancienne)" : ""}`);
      if (f.estNombre(s.elements)) details.push(`${s.elements} élément${s.elements > 1 ? "s" : ""}`);
      if (!ok && s.derniere_reussite) details.push(`dernière réussite le ${f.dateHeure(s.derniere_reussite)}`);
      if (!ok && !s.derniere_reussite) details.push("jamais collectée avec succès");
      return h("li", { class: "source-ligne" },
        h("span", { class: `source-ligne__etat ${ok ? (s.secours_utilise || s.ancienne ? "muet" : "fav") : "def"}`, title: ok ? "OK" : "En échec" }, ok ? "✓" : "✕"),
        h("div", {}, h("strong", {}, s.libelle || s.id), ok ? null : h("span", { class: "marque marque--risque" }, "en échec"),
          h("div", { class: "source-ligne__detail" }, details.join(" · ")),
          s.message ? h("div", { class: "source-ligne__detail" }, s.message) : null));
    })));
  });
  return h("div", { class: "pile" },
    h("div", { class: "bandeau bandeau--info" }, h("div", {},
      h("strong", {}, `${etat.resume.ok} source${etat.resume.ok > 1 ? "s" : ""} sur ${etat.resume.total} ont répondu`),
      `Collecte du ${f.dateHeure(etat.genere_le)}, en ${f.nombre(etat.duree_secondes, 0)} secondes. Quand une source échoue, l'application garde la dernière valeur valide et l'indique.`)),
    blocs);
}

// --------------------------------------------------------------- paramètres
function blocJeton() {
  const resultat = h("p", { class: "resultat", role: "status" });
  const champ = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "github_pat_…", "aria-describedby": "aide-jeton" });
  const etat = h("p", { class: "aide" });
  const rafraichir = () => { etat.textContent = maj.jeton.lire() ? "Un jeton est enregistré sur cet appareil." : "Aucun jeton enregistré sur cet appareil : le bouton « Mettre à jour » ouvrira la page GitHub du workflow."; };
  rafraichir();
  const dire = (texte, classe) => { resultat.textContent = texte; resultat.className = `resultat ${classe || ""}`; };
  return h("div", { class: "carte" },
    h("h3", { class: "graphique__titre" }, "Jeton GitHub (bouton « Mettre à jour »)"),
    h("div", { class: "formulaire section" },
      h("label", {}, "Jeton d'accès personnel « fine-grained »", champ),
      h("p", { class: "aide", id: "aide-jeton" }, "Stocké uniquement dans ce navigateur, sur cet appareil. Il n'est envoyé qu'à api.github.com, jamais ailleurs, et n'apparaît ni dans le code ni dans le dépôt."),
      h("div", { class: "actions" },
        h("button", { class: "bouton bouton--primaire", type: "button", onclick: () => {
          if (!champ.value.trim()) return dire("Collez d'abord le jeton dans le champ.", "def");
          maj.jeton.enregistrer(champ.value); champ.value = ""; rafraichir(); dire("Jeton enregistré sur cet appareil.", "fav");
        } }, "Enregistrer"),
        h("button", { class: "bouton", type: "button", onclick: async () => {
          dire("Test en cours…");
          const test = await maj.tester(champ.value.trim() || maj.jeton.lire());
          dire(test.message, test.ok ? "fav" : "def");
        } }, "Tester"),
        h("button", { class: "bouton bouton--danger", type: "button", onclick: () => { maj.jeton.supprimer(); champ.value = ""; rafraichir(); dire("Jeton supprimé de cet appareil."); } }, "Supprimer")),
      etat, resultat),
    h("details", { class: "details" }, h("summary", {}, "Comment créer ce jeton ?"),
      h("div", { class: "aide" }, h("ol", {},
        h("li", {}, "Sur GitHub : photo de profil → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. ", lienExterne("https://github.com/settings/personal-access-tokens/new", "Ouvrir cette page")),
        h("li", {}, `Repository access : « Only select repositories », puis choisir uniquement ${maj.depot() || "le dépôt de ce tableau de bord"}.`),
        h("li", {}, "Permissions → Repository permissions → Actions : « Read and write ». Ne rien cocher d'autre."),
        h("li", {}, "Choisir une durée de validité, générer, copier le jeton (il commence par github_pat_) et le coller ici."),
        h("li", {}, "Cliquer sur « Tester », puis « Enregistrer ». À refaire une fois sur chaque appareil (GSM, PC).")),
        h("p", { class: "section" }, "Ce jeton ne peut rien faire d'autre que lancer et consulter les workflows de ce dépôt."))));
}

function blocTheme() {
  const actuel = donnees.reglages.lire("theme", "automatique");
  const appliquer = (choix) => {
    donnees.reglages.ecrire("theme", choix);
    const racine = document.documentElement;
    if (choix === "clair") racine.setAttribute("data-theme", "light");
    else if (choix === "sombre") racine.setAttribute("data-theme", "dark");
    else racine.removeAttribute("data-theme");
  };
  const groupe = h("div", { class: "segments", role: "group", "aria-label": "Thème" });
  for (const [cle, libelle] of [["automatique", "Automatique"], ["clair", "Clair"], ["sombre", "Sombre"]]) {
    groupe.append(h("button", { type: "button", "aria-pressed": String(cle === actuel), onclick: (e) => {
      groupe.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      e.currentTarget.setAttribute("aria-pressed", "true");
      appliquer(cle);
    } }, libelle));
  }
  return h("div", { class: "carte" }, h("h3", { class: "graphique__titre" }, "Thème"),
    h("div", { class: "section" }, groupe), h("p", { class: "aide section" }, "« Automatique » suit le réglage clair ou sombre de l'appareil."));
}

function blocPosition(contexte) {
  const cle = `position.${contexte.synthese.societe.id}`;
  const position = donnees.reglages.lire(cle) || {};
  const nombre = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric", value: position.nombre ?? "" });
  const prix = h("input", { type: "number", min: "0", step: "0.01", inputmode: "decimal", value: position.prix ?? "" });
  const resultat = h("p", { class: "resultat", role: "status" });
  return h("div", { class: "carte" },
    h("h3", { class: "graphique__titre" }, `Ma position en ${contexte.synthese.societe.nom}`),
    h("div", { class: "formulaire section" },
      h("label", {}, "Nombre d'actions détenues", nombre),
      h("label", {}, "Prix de revient moyen par action (€)", prix),
      h("p", { class: "aide" }, "Facultatif. Ces deux chiffres restent dans ce navigateur : ils ne sont jamais envoyés nulle part ni enregistrés dans le dépôt GitHub (qui est public). S'ils sont remplis, l'écran Synthèse affiche la valeur de votre position, la plus-value latente et le dividende net attendu."),
      h("div", { class: "actions" },
        h("button", { class: "bouton bouton--primaire", type: "button", onclick: () => {
          const n = Number(nombre.value); const p = Number(prix.value);
          if (!(n > 0)) { resultat.textContent = "Indiquez un nombre d'actions supérieur à zéro."; resultat.className = "resultat def"; return; }
          donnees.reglages.ecrire(cle, { nombre: n, prix: p > 0 ? p : null });
          resultat.textContent = "Position enregistrée sur cet appareil."; resultat.className = "resultat fav";
        } }, "Enregistrer"),
        h("button", { class: "bouton bouton--danger", type: "button", onclick: () => { donnees.reglages.effacer(cle); nombre.value = ""; prix.value = ""; resultat.textContent = "Position effacée."; resultat.className = "resultat"; } }, "Effacer")),
      resultat));
}

function parametres(contexte) {
  return h("div", { class: "pile" }, blocJeton(), blocTheme(), blocPosition(contexte),
    h("div", { class: "carte" }, h("h3", { class: "graphique__titre" }, "À propos"),
      h("p", { class: "aide section" }, "Outil personnel d'information — pas un conseil en investissement. Les données viennent de sources publiques, collectées chaque soir de semaine par GitHub Actions. Aucune donnée n'est inventée : une valeur manquante s'affiche « n.d. » avec la raison."),
      h("p", { class: "aide" },
        maj.depot() ? [lienExterne(maj.pageDepot(), "Dépôt GitHub du projet"), " · ", lienExterne(maj.pageActions(), "Historique des collectes"), " · "] : null,
        contexte.synthese.societe.page_investisseurs ? lienExterne(contexte.synthese.societe.page_investisseurs, `Site investisseurs — ${contexte.synthese.societe.nom}`) : null)));
}

// ------------------------------------------------------------------- écran
export async function afficher(racine, contexte, suite) {
  const page = PAGES[suite[0]] ? suite[0] : "glossaire";
  racine.append(
    h("nav", { class: "sous-onglets", "aria-label": "Rubriques" }, Object.entries(PAGES).map(([cle, libelle]) =>
      h("a", { class: "puce", href: `#/plus/${cle}`, "aria-pressed": String(cle === page), "aria-current": cle === page ? "page" : null }, libelle))),
    h("h2", { class: "section__titre" }, PAGES[page]),
    page === "glossaire" ? glossaire(suite[1]) : page === "sources" ? sources(contexte) : parametres(contexte));
}
