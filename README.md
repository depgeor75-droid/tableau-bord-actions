# Tableau de bord Aedifica

Une application web gratuite qui rassemble **tous les facteurs qui influencent le cours de l'action Aedifica**, avec leur évolution sur 1 mois, 1 an, 5 ans et 10 ans. Elle est hébergée sur GitHub Pages et se lit sur GSM comme sur PC.

**Adresse du tableau de bord :** https://depgeor75-droid.github.io/tableau-bord-actions/

**Dépôt :** https://github.com/depgeor75-droid/tableau-bord-actions (en ligne depuis le 21/11/2026)

> Outil personnel d'information — pas un conseil en investissement.

## Comment ça marche

```
GitHub Actions (Python)  ─►  data/aedifica/*.json  ─►  GitHub Pages (site)  ─►  GSM / PC
   ▲ chaque soir de semaine, 18 h 45 (hiver) ou 19 h 45 (été)                    │
   └──────────────── bouton « Mettre à jour » de l'application ◄─────────────────┘
```

- Les données sont collectées **côté serveur** par GitHub, jamais par votre navigateur. Elles sont enregistrées dans le dépôt, puis le site est republié.
- Si une source tombe en panne, les autres continuent. L'application garde la dernière valeur valide, l'affiche avec sa date et passe la pastille à l'orange. **Aucune donnée n'est jamais inventée** : une valeur manquante s'affiche « n.d. » avec la raison.
- Les fondamentaux (NTA, endettement, dividende…) viennent des rapports officiels d'Aedifica. Chaque chiffre porte le lien vers son rapport et le numéro de page.

## Envoyer une modification

Le dossier du projet sur le PC est relié au dépôt GitHub. Après une modification (un nouveau rapport trimestriel, un réglage), demandez à Claude Code « envoie les modifications sur GitHub ». Le site est republié une minute plus tard.

La collecte ajoute chaque soir de nouvelles données dans le dépôt. Avant tout envoi, il faut donc d'abord récupérer ces données (`git pull --rebase`), ce que Claude Code fait de lui-même.

Sur ce PC, Git est connecté au compte `depgeor75-droid` pour ce dossier. Si GitHub redemande une connexion, utilisez ce compte-là.

## Mise en ligne, pas à pas

**Déjà fait le 21/11/2026** sur le compte `depgeor75-droid`. Cette section ne sert plus que pour réinstaller le tableau de bord ailleurs : remplacez alors `VOTRE-COMPTE` par le nom du compte. Aucun nom de compte n'est écrit dans le code, qui fonctionne tel quel sur n'importe quel compte.

Comptez un quart d'heure.

### 1. Créer le dépôt

1. Connectez-vous sur [github.com](https://github.com) avec le compte qui hébergera le tableau de bord.
2. En haut à droite : **+** → **New repository**.
3. *Repository name* : `tableau-bord-actions`. Visibilité : **Public** (obligatoire pour que GitHub Pages soit gratuit).
4. Ne cochez rien d'autre (pas de README, pas de .gitignore), puis **Create repository**.

### 2. Régler GitHub Pages

Dans le dépôt, onglet **Settings** :

1. Menu de gauche **Pages** → *Build and deployment* → *Source* : choisissez **GitHub Actions**.
   C'est indispensable : avec l'autre choix (« Deploy from a branch »), les données collectées chaque soir ne seraient pas republiées et le site resterait figé.
2. Rien d'autre à régler : la collecte demande elle-même le droit d'enregistrer les données dans le dépôt (vérifié le 21/11/2026). Seulement si elle échouait avec un refus d'écriture : menu **Actions** → **General** → *Workflow permissions* → **Read and write permissions** → **Save**.

### 3. Envoyer les fichiers

Un seul fichier `index.html` ne suffit pas : il n'est que la « coquille » de l'application. Il faut aussi les données, le programme de collecte et les automatismes, soit 76 fichiers. Trois façons de les envoyer, au choix.

**A. Par Claude Code (le plus simple).** Demandez « publie le projet sur GitHub » en donnant le nom du compte. Une fenêtre vous demandera de vous connecter à GitHub. Tout part en une fois et les mises à jour suivantes se feront de la même façon.

**B. Par GitHub Desktop.** Installez [GitHub Desktop](https://desktop.github.com/) et connectez-vous avec le bon compte. *File* → *Add local repository* → choisissez ce dossier → *Publish repository* sous le nom `tableau-bord-actions`, en décochant « Keep this code private ».

**C. À la main, sur le site de GitHub (sans rien installer).** En deux temps :

1. Sur la page du dépôt vide, cliquez sur le lien **uploading an existing file** (plus tard : **Add file** → **Upload files**).
2. Dans l'Explorateur Windows, ouvrez le dossier du projet. Sélectionnez ces neuf éléments et glissez-les ensemble dans la page :
   - les dossiers `collecte`, `css`, `data`, `js`, `societes` ;
   - les fichiers `index.html`, `README.md`, `RAPPORT_SOURCES.md`, `requirements.txt`.

   Cela fait 73 fichiers (GitHub en accepte 100 par envoi). Attendez la fin du chargement, puis **Commit changes**.
3. GitHub ignore, dans un glisser-déposer, tout ce dont le nom commence par un point. Le dossier `.github` n'est donc pas parti, alors qu'il contient les trois automatismes. Créez-les un par un, pour `pages.yml`, `maj.yml` et `test-sources.yml` :
   - **Add file** → **Create new file** ;
   - dans la case du nom, tapez `.github/workflows/pages.yml` (les barres `/` créent les dossiers) ;
   - sur votre PC, ouvrez le fichier du même nom (dossier `.github\workflows`) avec le Bloc-notes, sélectionnez tout (Ctrl+A), copiez (Ctrl+C) et collez dans la grande zone de GitHub ;
   - **Commit changes**. Recommencez pour les deux autres.
4. Contrôle : le dossier `.github/workflows` du dépôt doit contenir trois fichiers, et l'onglet **Actions** doit proposer trois workflows.

À ne **pas** envoyer avec la méthode C : `SPEC_Tableau_de_bord_Aedifica_v1.md` (il contient votre nom, et le dépôt est public). Les éléments `.gitignore`, `.nojekyll` et `.claude` sont inutiles en ligne. Avec les méthodes A et B, ce tri est automatique (voir `.gitignore`).

Avec la méthode C, chaque modification future (un nouveau rapport trimestriel, par exemple) devra aussi être envoyée à la main, fichier par fichier.

### 4. Vérifier que tout tourne

Onglet **Actions** du dépôt :

1. Le workflow **Publication du site** se lance tout seul après l'envoi. Attendez la coche verte (une minute). S'il est rouge parce que Pages n'était pas encore réglé, ouvrez-le et cliquez sur **Re-run all jobs**.
2. Ouvrez `https://VOTRE-COMPTE.github.io/tableau-bord-actions/` (l'adresse exacte est affichée dans **Settings** → **Pages**) : l'application s'affiche avec les données du jour de la mise en ligne.
3. Lancez une première collecte : workflow **Mise à jour des données** → **Run workflow** → **Run workflow**. Deux minutes plus tard, la mention « Données du … » de l'application doit avoir changé.
4. Lancez une fois **Test des sources de données** → **Run workflow**. Il vérifie que chaque source répond aussi depuis les serveurs de GitHub et complète `RAPPORT_SOURCES.md`.

Ensuite il n'y a plus rien à faire : la collecte tourne du lundi au vendredi après la clôture d'Euronext.

## Le bouton « Mettre à jour »

Sans réglage, le bouton ouvre la page GitHub du workflow, où vous cliquez sur **Run workflow**.

Pour que la mise à jour se fasse **en un clic depuis l'application**, créez un jeton d'accès, une fois par appareil (GSM, PC) :

1. Sur GitHub : votre photo de profil → **Settings** → tout en bas à gauche **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. *Token name* : par exemple `tableau de bord GSM`. *Expiration* : la durée que vous voulez (un an, par exemple).
3. *Repository access* : **Only select repositories**, puis choisissez uniquement le dépôt `tableau-bord-actions`.
4. *Permissions* → **Repository permissions** → ligne **Actions** : **Read and write**. Ne touchez à rien d'autre.
5. **Generate token**, puis copiez le jeton (il commence par `github_pat_`). GitHub ne le montrera plus.
6. Dans l'application : onglet **Plus** → **Paramètres** → collez le jeton → **Tester** → **Enregistrer**.

Ce jeton ne permet que de lancer et de consulter les workflows de ce dépôt. Il est stocké **uniquement dans le navigateur de l'appareil** : il n'est ni dans le code, ni dans le dépôt. Le bouton **Supprimer** l'efface. S'il expire, l'application vous le dit et il suffit d'en créer un nouveau.

Après un clic sur « Mettre à jour », une barre de progression suit la collecte (1 à 3 minutes). Si des sources ont échoué, l'application les nomme.

## Ma position (facultatif)

Dans **Plus → Paramètres**, vous pouvez saisir votre nombre d'actions et votre prix de revient. L'écran Synthèse affiche alors la valeur de votre position, la plus-value latente et le dividende net attendu. Ces deux chiffres restent **dans le navigateur de l'appareil** : ils ne sont jamais envoyés nulle part ni écrits dans le dépôt, qui est public.

## Lire la pastille d'état

| Pastille | Signification |
|---|---|
| 🟢 Vert | Toutes les sources ont répondu. |
| 🟠 Orange | Une source n'a pas répondu, ou la dernière collecte a plus de 4 jours. Les valeurs concernées portent la mention « ancien ». |
| 🔴 Rouge | Le cours de l'action ou la majorité des sources n'ont pas pu être collectés. |

Un clic sur la pastille donne le détail. **Plus → État des sources** liste chaque source, celle qui a servi et la date de sa dernière réussite.

## Intégrer un nouveau rapport trimestriel

Aedifica publie quatre fois par an (février, avril-mai, fin juillet, fin octobre). La collecte surveille sa page de communiqués. Quand un nouveau rapport paraît :

- l'application affiche le bandeau **« Nouveau rapport publié le … — chiffres à valider »** ;
- les chiffres repérés automatiquement dans le PDF (NTA, endettement, taux d'occupation…) sont rangés dans `data/aedifica/fondamentaux_a_valider.json`, avec le numéro de page et la ligne d'origine. Rien n'est intégré sans validation.

Pour l'intégrer, ouvrez ce dossier dans Claude Code et dites simplement :

> intègre le rapport T4 2026

Claude Code relit le rapport officiel, vérifie chaque chiffre candidat, ajoute le trimestre dans `fondamentaux.json` (avec lien et page), met à jour le calendrier, les prévisions, le tableau des cessions (`cessions.json`) et, pour un rapport semestriel ou annuel, la part des loyers de chaque locataire (`societes/aedifica.json`). Il relance ensuite la collecte et envoie le tout sur GitHub. Le bandeau disparaît.

À la main, c'est possible aussi : recopiez dans `fondamentaux.json` un bloc de trimestre existant, changez les valeurs, les pages, les dates et le lien du rapport.

## Ajouter une société

Tout ce qui est propre à Aedifica vit dans `societes/aedifica.json` et dans `data/aedifica/`. Rien n'est écrit en dur dans le JavaScript. Pour une autre société :

1. Copiez `societes/aedifica.json` vers `societes/nouvelle.json`. Adaptez l'identifiant, le nom, le symbole Yahoo, l'ISIN, les pairs, les locataires, les mots-clés et la page des communiqués. Supprimez `ajustements_cours` (il est propre à l'action Aedifica).
2. Créez `data/nouvelle/fondamentaux.json` sur le modèle de celui d'Aedifica (valeur comptable par action, nombre d'actions, dividendes par exercice). Sans ce fichier, l'application fonctionne, mais la décote, le rendement et le multiple s'affichent « n.d. ».
3. Envoyez sur GitHub et lancez **Mise à jour des données** en cochant « Recharger tout l'historique ».
4. Ouvrez `https://depgeor75-droid.github.io/tableau-bord-actions/?societe=nouvelle`.

Le plus sûr reste de le demander à Claude Code (« ajoute la société X »), qui vérifiera les sources et les chiffres dans les rapports officiels.

## Option IA (facultative)

Sans rien faire, l'application fonctionne entièrement, avec une synthèse des actualités « sans IA » (compteurs par catégorie, frise, derniers communiqués).

Pour ajouter un paragraphe de synthèse rédigé par l'API Claude d'Anthropic :

1. Créez une clé sur [console.anthropic.com](https://console.anthropic.com/). L'API est **facturée à part** de l'abonnement Claude : quelques centimes par mois avec le petit modèle choisi.
2. Dans le dépôt : **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Nom : `ANTHROPIC_API_KEY`. Valeur : la clé.

À la collecte suivante, la synthèse apparaît en haut de l'écran Actus. Elle est refaite au plus une fois par semaine, ou dès qu'un communiqué officiel arrive. La même clé sert à une seconde lecture des nouveaux rapports. Le modèle se règle dans `societes/aedifica.json` (`ia.modele`). Pour couper l'IA sans supprimer la clé, mettez `ia.active` à `false`.

## Réglages utiles

Dans `societes/aedifica.json` :

| Clé | Rôle |
|---|---|
| `seuils_alertes` | Seuils des « points d'attention » : hausse du Bund sur 1 mois (0,25 point), écart de la décote avec sa moyenne sur 10 ans (10 points), VIX et VSTOXX (25), nombre de jours pour les communiqués, les résultats, les pannes et les actualités à risque. |
| `precompte_mobilier` | Taux du précompte (0,30). Sert au rendement net. |
| `locataires.liste` | Exploitants suivis, avec leur part des loyers et leur symbole de bourse. |
| `mots_cles_categories`, `mots_cles_risque` | Mots-clés du classement des actualités et de l'alerte « locataire ». |
| `calculs`, `groupes`, `tuiles` | Indicateurs affichés et leur ordre. `sens_favorable` (`hausse`, `baisse`, `neutre`) fixe la couleur. |

## Organisation du dépôt

```
index.html, css/, js/              l'application (HTML, CSS et JavaScript sans compilation)
societes/aedifica.json             configuration de la société
collecte/run.py                    chef d'orchestre de la collecte
collecte/sources/*.py              un fichier par source (BCE, Bundesbank, Yahoo, Euronext, STOXX, Cboe, Eurostat…)
collecte/marche.py                 séries de marché, collecte incrémentale, sources de secours
collecte/calculs.py                tous les calculs (décote, rendement, écarts, variations, points d'attention)
collecte/actualites.py             communiqués officiels et presse
collecte/locataires.py             cours et actualités à risque des exploitants
collecte/rapports.py               détection des nouveaux rapports, chiffres candidats
collecte/ia.py                     option IA
collecte/test_sources.py           banc d'essai des sources → RAPPORT_SOURCES.md
data/aedifica/synthese.json        tout ce que l'écran d'accueil affiche (généré)
data/aedifica/historique/*.csv     séries longues, une par indicateur (générées)
data/aedifica/actualites.json, locataires.json, etat_sources.json   (générés)
data/aedifica/fondamentaux.json    chiffres des rapports officiels (tenu à la main, sourcé)
data/aedifica/cessions.json        ventes annoncées et programme de cessions (tenu à la main, sourcé)
.github/workflows/maj.yml          collecte planifiée et à la demande, puis publication
.github/workflows/pages.yml        publication du site
.github/workflows/test-sources.yml banc d'essai des sources
```

Pour lancer la collecte sur votre PC (facultatif) : `pip install -r requirements.txt`, puis `python collecte/run.py --societe aedifica`. Pour voir l'application en local : `python -m http.server 8765`, puis ouvrez http://localhost:8765 (un double-clic sur `index.html` ne suffit pas : le navigateur bloque alors la lecture des données).

## Choix techniques

Décisions prises pendant la réalisation, là où le cahier des charges laissait le choix ou a dû être adapté. Le détail des essais est dans [RAPPORT_SOURCES.md](RAPPORT_SOURCES.md).

**Données**

- **Cours réellement cotés.** Yahoo Finance recalcule ses cours historiques à chaque augmentation de capital avec droits : ses cours d'avant 2023 sont 2 à 19 % plus bas que ceux réellement cotés. La collecte les remet à leur valeur d'origine (`ajustements_cours`), ce qui retombe au centime près sur les cours de clôture publiés par Aedifica. Une fois enregistré, un cours n'est plus jamais réécrit.
- **Rendement total** : cours ajusté des dividendes de Yahoo, rechargé en entier quand Yahoo le recalcule.
- **Bund 10 ans** : rendement de l'obligation de référence publié par la Bundesbank (le chiffre de la presse), plutôt que le taux zéro-coupon théorique proposé au départ. Trois secours.
- **VSTOXX** : fichier officiel de STOXX (Yahoo ne le fournit pas). **VIX** : Cboe. **Inflation** : Eurostat, la série BCE prévue étant arrêtée depuis fin 2025.
- **Secours si Yahoo bloque GitHub** : le site d'Euronext, pour tout ce qui y est coté (cours AED, Bel 20, ETF immobilier, Care Property Invest, Clariane, emeis, AB InBev). Une source de secours n'ajoute que les jours manquants ; dès que la source principale revient, elle reprend la main.
- **Précompte mobilier à 30 %** depuis le 1er janvier 2026, et non 15 % (rapport T1 2026, p. 20).
- **Écart OLO – Bund** : calculé avec les deux moyennes mensuelles de la BCE, pour comparer deux chiffres de même nature.
- **Valeur comptable avant 2021.** L'EPRA NTA n'existe que depuis fin 2020. Avant : ancien EPRA NAV quand le rapport le publie, sinon l'actif net par action hors instruments de couverture (la mesure qu'Aedifica utilisait elle-même pour calculer sa prime). Le champ `mesure` de `fondamentaux.json` le précise.
- **Pas de triche avec le futur.** La décote à une date passée utilise la dernière valeur comptable publiée *avant* cette date. Un rapport ne prend effet que le lendemain de sa publication.
- **Rendement du dividende et multiple dans le passé** : dividende et résultat de l'exercice qui était alors en cours, tels que finalement publiés. L'exercice 2019/2020, long de 18 mois, est ramené à 12 mois.
- **Nombre d'actions** : celui du dernier arrêté trimestriel, plus les deux opérations de 2026 à leur date exacte (offre d'échange du 10 mars, fusion du 1er juillet).
- **Date de comparaison** : dernière observation à la date cible ou juste avant, avec une tolérance de 10 jours (45 pour les séries mensuelles). Au-delà : « n.d. ».
- **Variations** : en points et en points de base pour les taux, les écarts et les ratios ; en % pour les cours, les indices, la capitalisation et le multiple.
- **Programme de cessions** : point de départ au 31/03/2026, premier arrêté après la prise de contrôle de Cofinimmo. Les ventes de maisons de repos belges ne sont pas décomptées de l'engagement de 300 millions € tant qu'Aedifica n'a pas dit lesquelles y sont imputées.
- **Écart avec la juste valeur et acheteur de chaque vente** : non publiés, donc « n.d. ». À la place, l'écran affiche le résultat global sur ventes publié chaque trimestre.
- **Taux d'occupation et couverture des loyers des exploitants** : Aedifica les publie par pays, pas par exploitant. Ils sont affichés tels quels.

**Fonctionnement**

- **Publication par le workflow.** GitHub ne republie pas un site « depuis une branche » quand le commit vient d'un workflow. La collecte publie donc elle-même le site (source Pages : « GitHub Actions »). Quand le workflow est terminé, les données sont en ligne.
- **Un commit à chaque collecte.** `synthese.json` porte l'heure de la collecte ; c'est ce que le bouton « Mettre à jour » attend de voir changer.
- **Bibliothèque de graphiques** : Chart.js 4.5, chargée depuis cdnjs avec contrôle d'intégrité. Si elle ne se charge pas, les chiffres restent affichés dans les tableaux.
- **Graphique cours / Bund à deux axes**, comme demandé, avec les échelles nommées dans la légende et l'option d'inverser l'axe du Bund.
- **Tableau « Évolution » sur GSM** : une carte par indicateur, les quatre périodes sur une ligne. Tout tient dans 360 px sans défilement horizontal. Sur PC : un tableau à six colonnes.
- **Sécurité** : une règle (Content-Security-Policy) n'autorise que les scripts du site et de cdnjs, et les seuls échanges avec le site lui-même et api.github.com. Les titres d'articles sont insérés comme du texte, jamais comme du code.
- **Actualités** : titre, source, date et lien seulement, jamais le texte des articles. Pour les communiqués officiels, un extrait de trois lignes lu dans le PDF.
- **Option IA** : modèle `claude-haiku-5-5`, le petit modèle demandé, réglable dans la configuration.

**Non réalisé**

- La notification quand un point d'attention se déclenche (phase 4, optionnelle). Elle demanderait un service d'envoi extérieur ; les points d'attention s'affichent en tête de l'écran Synthèse.
- Une série quotidienne de l'OLO auprès de la Banque nationale : pas d'accès simple et stable trouvé. L'OLO reste mensuel.
