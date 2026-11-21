// Chargement des fichiers produits par la collecte (data/<societe>/…).
// Le navigateur ne va jamais chercher de données ailleurs : il lit ces fichiers, c'est tout.

const cacheJson = new Map();
const cacheSeries = new Map();
let jeton = ""; // suffixe anti-cache après un clic sur « Mettre à jour »

/** Société affichée : ?societe=xxx dans l'adresse, Aedifica par défaut. */
export function societe() {
  const demande = new URLSearchParams(location.search).get("societe") || "aedifica";
  return /^[a-z0-9-]{1,40}$/.test(demande) ? demande : "aedifica";
}

function adresse(chemin) {
  return `data/${societe()}/${chemin}${jeton ? `?t=${jeton}` : ""}`;
}

/** Oublie tout ce qui est en mémoire et force le navigateur à relire les fichiers. */
export function rafraichir() {
  cacheJson.clear();
  cacheSeries.clear();
  jeton = String(Date.now());
}

export async function json(nom, { facultatif = false } = {}) {
  if (cacheJson.has(nom)) return cacheJson.get(nom);
  const promesse = fetch(adresse(`${nom}.json`), { cache: "no-cache" }).then((reponse) => {
    if (!reponse.ok) {
      if (facultatif) return null;
      throw new Error(`Fichier ${nom}.json introuvable (HTTP ${reponse.status})`);
    }
    return reponse.json();
  });
  cacheJson.set(nom, promesse);
  promesse.catch(() => cacheJson.delete(nom));
  return promesse;
}

/** Lecture directe, sans cache, pour surveiller l'arrivée de nouvelles données. */
export async function horodatageSynthese() {
  const reponse = await fetch(`data/${societe()}/synthese.json?t=${Date.now()}`, { cache: "no-store" });
  if (!reponse.ok) return null;
  return (await reponse.json()).genere_le || null;
}

/** Historique d'un indicateur : tableau de [temps en millisecondes, valeur]. */
export async function serie(fichier) {
  if (cacheSeries.has(fichier)) return cacheSeries.get(fichier);
  const promesse = fetch(adresse(`historique/${fichier}.csv`), { cache: "no-cache" }).then(async (reponse) => {
    if (!reponse.ok) throw new Error(`Historique « ${fichier} » introuvable`);
    const lignes = (await reponse.text()).trim().split("\n");
    const points = [];
    for (let i = 1; i < lignes.length; i++) {
      const virgule = lignes[i].indexOf(",");
      const temps = Date.parse(`${lignes[i].slice(0, virgule)}T00:00:00Z`);
      const valeur = Number(lignes[i].slice(virgule + 1));
      if (Number.isFinite(temps) && Number.isFinite(valeur)) points.push([temps, valeur]);
    }
    return points;
  });
  cacheSeries.set(fichier, promesse);
  promesse.catch(() => cacheSeries.delete(fichier));
  return promesse;
}

// ------------------------------------------------- réglages propres à l'appareil
// Stockés uniquement dans le navigateur (localStorage) : jamais dans le dépôt GitHub.
export const reglages = {
  lire(cle, defaut = null) {
    try {
      const brut = localStorage.getItem(`tba.${cle}`);
      return brut === null ? defaut : JSON.parse(brut);
    } catch { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(`tba.${cle}`, JSON.stringify(valeur)); return true; } catch { return false; }
  },
  effacer(cle) {
    try { localStorage.removeItem(`tba.${cle}`); } catch { /* rien à effacer */ }
  },
};
