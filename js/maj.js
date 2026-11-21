// Bouton « Mettre à jour » : déclenche la collecte sur GitHub (workflow maj.yml),
// suit son avancement, puis attend que les nouvelles données soient en ligne.
//
// Le jeton d'accès GitHub est saisi une fois par appareil (écran Plus → Paramètres) et
// stocké uniquement dans le navigateur de cet appareil. Il n'est jamais écrit dans le
// code ni dans le dépôt, et n'est envoyé qu'à api.github.com.

import { horodatageSynthese, reglages } from "./donnees.js";

const WORKFLOW = "maj.yml";
const BRANCHE = "main";
const DELAI_MAX = 5 * 60 * 1000; // 5 minutes, puis message clair
const API = "https://api.github.com";
const HORS_LIGNE = "Le site n'est pas ouvert depuis GitHub Pages (aperçu sur votre PC ?). La mise à jour se lance depuis l'adresse en ligne du tableau de bord.";

/**
 * Dépôt GitHub (« compte/depot »), déduit de l'adresse du site : compte.github.io/depot.
 * Aucun compte n'est écrit dans le code : le projet fonctionne tel quel sur n'importe quel compte.
 * Renvoie null quand le site n'est pas servi par GitHub Pages (aperçu local, par exemple).
 */
export function depot() {
  const hote = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (!hote) return null;
  const dossier = location.pathname.split("/").filter(Boolean).find((partie) => !/\.html?$/i.test(partie));
  return `${hote[1]}/${dossier || `${hote[1]}.github.io`}`;
}

export const pageDepot = () => (depot() ? `https://github.com/${depot()}` : null);
export const pageActions = () => (depot() ? `${pageDepot()}/actions/workflows/${WORKFLOW}` : null);

export const jeton = {
  lire: () => reglages.lire("jeton", ""),
  enregistrer: (valeur) => reglages.ecrire("jeton", valeur.trim()),
  supprimer: () => reglages.effacer("jeton"),
};

function appel(chemin, valeurJeton, options = {}) {
  return fetch(`${API}/repos/${depot()}${chemin}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${valeurJeton}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

function messageErreur(statut) {
  switch (statut) {
    case 401: return "Jeton refusé par GitHub : il est invalide ou a expiré. Créez-en un nouveau (Plus → Paramètres).";
    case 403: return "Jeton accepté, mais sans le droit nécessaire. Il lui faut la permission « Actions : lecture et écriture » sur ce dépôt.";
    case 404: return `Dépôt ou workflow introuvable avec ce jeton (${depot()}). Vérifiez que le jeton donne bien accès à ce dépôt.`;
    case 422: return "GitHub a refusé la demande : le workflow maj.yml doit exister sur la branche main.";
    default: return `GitHub a répondu par une erreur (${statut}). Réessayez dans quelques minutes.`;
  }
}

/** Vérifie que le jeton permet bien de lancer la collecte. */
export async function tester(valeurJeton) {
  if (!valeurJeton) return { ok: false, message: "Aucun jeton saisi." };
  if (!depot()) return { ok: false, message: `${HORS_LIGNE} Le jeton pourra y être testé.` };
  try {
    const reponse = await appel(`/actions/workflows/${WORKFLOW}`, valeurJeton);
    if (reponse.ok) return { ok: true, message: `Jeton valide : il peut lancer la collecte sur ${depot()}.` };
    return { ok: false, message: messageErreur(reponse.status) };
  } catch {
    return { ok: false, message: "Impossible de joindre GitHub (connexion ?)." };
  }
}

const attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

/**
 * Lance la mise à jour et la suit jusqu'au bout.
 * `suivi({ texte, part })` est appelé à chaque étape (part : avancement de 0 à 1).
 * Renvoie { etat: "ok" | "sans-jeton" | "hors-ligne" | "erreur" | "delai" | "echec", message, lien }.
 */
export async function lancer(suivi) {
  if (!depot()) return { etat: "hors-ligne", message: HORS_LIGNE };
  const valeurJeton = jeton.lire();
  if (!valeurJeton) return { etat: "sans-jeton", lien: pageActions() };

  const depart = Date.now();
  const part = (plafond = 0.92) => Math.min(plafond, (Date.now() - depart) / (170 * 1000));
  suivi({ texte: "Demande de collecte envoyée à GitHub…", part: 0.03 });

  let avant = null;
  try { avant = await horodatageSynthese(); } catch { /* on fera sans */ }

  let reponse;
  try {
    reponse = await appel(`/actions/workflows/${WORKFLOW}/dispatches`, valeurJeton, {
      method: "POST", body: JSON.stringify({ ref: BRANCHE }),
    });
  } catch {
    return { etat: "erreur", message: "Impossible de joindre GitHub (connexion ?)." };
  }
  if (!reponse.ok) return { etat: "erreur", message: messageErreur(reponse.status) };

  // 1. Suivre l'exécution du workflow (toutes les 10 secondes)
  let execution = null;
  let conclusion = null;
  while (Date.now() - depart < DELAI_MAX) {
    await attendre(execution ? 10000 : 5000);
    try {
      const liste = await appel(`/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=5`, valeurJeton);
      if (liste.ok) {
        const runs = (await liste.json()).workflow_runs || [];
        execution = runs.find((run) => Date.parse(run.created_at) >= depart - 20000) || execution;
      }
    } catch { /* coupure passagère : on réessaie au tour suivant */ }
    if (!execution) { suivi({ texte: "En attente du démarrage de la collecte…", part: part(0.2) }); continue; }
    if (execution.status === "completed") { conclusion = execution.conclusion; break; }
    suivi({
      texte: execution.status === "queued" ? "Collecte en file d'attente chez GitHub…" : "Collecte en cours… (1 à 3 minutes)",
      part: part(),
    });
  }
  const lien = execution?.html_url || pageActions();
  if (!conclusion) {
    return { etat: "delai", lien, message: "La collecte dure plus de 5 minutes. Elle continue peut-être : rechargez la page dans quelques minutes, ou regardez son avancement sur GitHub." };
  }

  // 2. Attendre que les nouvelles données soient en ligne (le site est republié en fin de collecte)
  suivi({ texte: "Collecte terminée. Mise en ligne des données…", part: 0.95 });
  while (Date.now() - depart < DELAI_MAX) {
    try {
      const maintenant = await horodatageSynthese();
      if (maintenant && maintenant !== avant) {
        suivi({ texte: "Données à jour.", part: 1 });
        return conclusion === "success"
          ? { etat: "ok" }
          : { etat: "echec", lien, message: "Les données ont été mises à jour, mais une partie de la collecte a échoué." };
      }
    } catch { /* on réessaie */ }
    await attendre(5000);
  }
  if (conclusion !== "success") {
    return { etat: "echec", lien, message: "La collecte a échoué côté GitHub : les données affichées n'ont pas changé." };
  }
  return { etat: "delai", lien, message: "La collecte est terminée mais les nouvelles données ne sont pas encore visibles. Rechargez la page dans une minute." };
}

/** Sans jeton : après un lancement manuel sur GitHub, attend l'arrivée de nouvelles données. */
export async function attendreNouvellesDonnees(suivi) {
  const depart = Date.now();
  const avant = await horodatageSynthese().catch(() => null);
  while (Date.now() - depart < DELAI_MAX) {
    suivi({ texte: "En attente des nouvelles données… (1 à 3 minutes après « Run workflow »)", part: Math.min(0.95, (Date.now() - depart) / DELAI_MAX) });
    await attendre(8000);
    const maintenant = await horodatageSynthese().catch(() => null);
    if (maintenant && maintenant !== avant) { suivi({ texte: "Données à jour.", part: 1 }); return true; }
  }
  return false;
}
