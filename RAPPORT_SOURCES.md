# Rapport des sources de données (phase 0)

*Établi le 21/11/2026. Le tableau détaillé en bas de page est régénéré par `python collecte/test_sources.py` (en local) et par le workflow GitHub « Test des sources de données » (depuis les serveurs de GitHub).*

## En bref

- **Toutes les sources principales répondent** depuis un PC. Une seule source de secours ne répond pas : FRED, troisième recours pour le VIX. Reste à confirmer le tout depuis GitHub Actions (voir « À faire » plus bas) : Yahoo Finance bloque parfois les serveurs de GitHub.
- La collecte complète (16 séries de marché, actualités, locataires, rapports) prend **moins d'une minute**.
- Six points du cahier des charges ont dû être adaptés après essai. Ils sont détaillés ci-dessous, avec la source de remplacement retenue.

## Ce que les essais ont changé par rapport au cahier des charges

| Sujet | Constat | Décision |
|---|---|---|
| **Cours AED (Yahoo)** | Yahoo recalcule ses cours historiques à chaque augmentation de capital avec droits. Ses cours anciens sont **plus bas que les cours réellement cotés** : −2,3 % avant juin 2023, −4,8 % avant octobre 2020, −8,7 % avant avril 2019, −11,2 % avant mars 2017 et −18,7 % avant juin 2015. | Les cours Yahoo sont **remis à leur valeur d'origine** par cinq facteurs (config `ajustements_cours`), calibrés sur les cours de clôture officiels publiés par Aedifica. Résultat : écart nul au centime près (voir contrôle croisé). Sans cette correction, la décote historique aurait été fausse de 2 à 19 points. |
| **Bund 10 ans** | La série proposée comme principale (`BBSIS…ZST…`) est un **taux zéro-coupon** théorique ; sa variante `ZAR` est le rendement « au pair ». La série `BBSSY…WT1010` est le **rendement de l'obligation de référence à 10 ans** : c'est le chiffre cité dans la presse. Les trois diffèrent de 2 à 7 pb. | Principale : `BBSSY` (rendement du Bund de référence). Secours : `ZAR`, puis `ZST`, puis la moyenne mensuelle BCE. |
| **VSTOXX** | `^V2TX` n'existe pas sur Yahoo Finance (erreur 404). | Fichier officiel de STOXX (`h_v2tx.txt`), historique quotidien depuis 1999. Les comparaisons à 5 et 10 ans sont donc disponibles tout de suite. |
| **VIX** | FRED ne répond pas de façon fiable depuis ce PC (délais dépassés). | Principale : historique officiel du Cboe. Secours : Yahoo `^VIX`, puis FRED. |
| **Inflation (IPCH)** | La série BCE `ICP/M.U2.N.000000.4.ANR` est **arrêtée depuis décembre 2025** (changement de méthode d'Eurostat en février 2026). L'ancien jeu Eurostat `prc_hicp_manr` aussi. | Nouveau jeu Eurostat `prc_hicp_minr` (variation annuelle, zone euro), historique depuis 1996. L'ancienne série BCE reste en secours. |
| **Stooq** | Ne fournit plus de CSV sans clé (renvoie une page HTML). | Écarté. Secours du cours AED : site d'Euronext (cours non ajusté, 2 ans d'historique). |
| **Communiqués officiels** | Le flux RSS du site d'Aedifica ne contient que des « news », pas les communiqués. | Lecture de la page [Communiqués de presse](https://aedifica.eu/fr/communiques-de-presse/) : tous les PDF datés depuis 2006. Cette même page sert à détecter les nouveaux rapports. |

Deux chiffres du cahier des charges ont aussi été corrigés en lisant les rapports officiels :

- **Précompte mobilier : 30 %, pas 15 %.** Depuis le 1er janvier 2026, le taux réduit ne s'applique plus à Aedifica (rapport T1 2026, p. 20). Le dividende 2025 de 4,00 € brut a donné 2,80 € net.
- **EPRA NTA au 30/06/2026 : 77,82 €** (valeur absente de la liste de départ). Les autres valeurs de départ sont confirmées.

## Sources retenues

| # | Indicateur | Source principale | Secours | Fréquence |
|---|---|---|---|---|
| 1 | Cours de clôture AED | Yahoo Finance `AED.BR`, corrigé des augmentations de capital | Euronext (site) | jour |
| 2 | Rendement total | Yahoo Finance `AED.BR`, cours ajusté des dividendes | — | jour |
| 3-8 | NTA, VAN IFRS, décote, capitalisation, rendement, écart, multiple | Calculs à partir de `fondamentaux.json` (48 rapports officiels, 2015-2026) | — | jour |
| 9 | Taux de dépôt BCE | BCE `FM/D.U2.EUR.4F.KR.DFR.LEV` | — | jour |
| 10 | €STR | BCE `EST/B.EU000A2X2A25.WT` (depuis 10/2019) | — | jour |
| 11 | Euribor 3 mois | BCE `FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA` | — | mois |
| 12 | Bund 10 ans | Bundesbank `BBSSY/D.REN.EUR.A630.000000WT1010.A` | Bundesbank `BBSIS…ZAR…`, `BBSIS…ZST…`, BCE `IRS/M.DE…` | jour |
| 13 | OLO 10 ans et écart OLO – Bund | BCE `IRS/M.BE.L.L40.CI.0000.EUR.N.Z` et `IRS/M.DE…` | — | mois |
| 14 | VIX | Cboe (historique officiel) | Yahoo `^VIX`, FRED `VIXCLS` | jour |
| 15 | VSTOXX | STOXX (historique officiel) | — | jour |
| 16 | Immobilier coté européen | Yahoo `IQQP.DE` | Yahoo `IPRP.AS` (même ETF), Euronext Amsterdam | jour |
| 17 | Care Property Invest, Welltower | Yahoo `CPINV.BR`, `WELL` | Euronext pour Care Property ; aucun pour Welltower (New York) | jour |
| 18 | Bel 20 | Yahoo `^BFX` | Euronext (site) | jour |
| 19 | EUR/GBP | BCE `EXR/D.GBP.EUR.SP00.A` | Yahoo `EURGBP=X` | jour |
| 20 | Inflation zone euro | Eurostat `prc_hicp_minr` | BCE `ICP…` (arrêtée fin 2025) | mois |
| — | Locataires cotés | Yahoo `CLARI.PA`, `EMEIS.PA`, `ATT.ST`, `ABI.BR` | Euronext pour Clariane, emeis et AB InBev ; aucun pour Attendo (Stockholm) | jour |
| — | Communiqués et rapports officiels | aedifica.eu, page des communiqués | — | — |
| — | Presse (FR, NL, EN) et actualités des locataires | Google Actualités (RSS) | — | — |

L'écart OLO – Bund utilise les deux moyennes mensuelles de la BCE, calculées de la même façon : mélanger une moyenne mensuelle belge et un taux quotidien allemand aurait faussé l'écart. Une série quotidienne de la Banque nationale de Belgique n'a pas été retenue (pas d'accès simple et stable trouvé).

## Contrôles croisés

**Cours AED — collecte comparée au site d'Euronext** (cours non ajusté) : écart de **0,00 €** sur les 509 séances communes (du 22/11/2024 au 20/11/2026).

| Date | Collecte | Euronext | Écart |
|---|---|---|---|
| 20/11/2026 | 63,60 € | 63,60 € | 0,00 |
| 30/06/2026 | 70,60 € | 70,60 € | 0,00 |
| 31/12/2025 | 67,50 € | 67,50 € | 0,00 |
| 31/12/2024 | 56,20 € | 56,20 € | 0,00 |

**Cours AED — collecte comparée aux cours de clôture publiés dans les rapports d'Aedifica** (« Cours de Bourse de clôture ») : écart maximal de **0,001 €** sur 24 dates de 2014 à 2026. Extrait :

| Date | Rapport Aedifica | Yahoo brut | Collecte (corrigée) |
|---|---|---|---|
| 31/12/2021 | 114,90 € | 112,25 € | 114,90 € |
| 31/12/2019 | 113,20 € | 107,82 € | 113,20 € |
| 31/12/2018 | 78,70 € | 71,87 € | 78,70 € |
| 30/06/2016 | 69,68 € | 61,89 € | 69,68 € |
| 31/12/2014 | 55,55 € | 45,15 € | 55,55 € |

Limite connue : pour les deux ou trois séances qui entourent chacune des cinq augmentations de capital avec droits (juin 2015, mars 2017, avril 2019, octobre 2020, juin 2023), le cours reconstitué peut s'écarter d'environ 2 % du cours réellement coté, faute de source indépendante pour ces jours précis.

**Bund 10 ans — moyenne mensuelle de la série quotidienne Bundesbank comparée à la moyenne mensuelle publiée par la BCE** :

| Mois | Bundesbank (collecte) | BCE | Écart |
|---|---|---|---|
| 10/2026 | 3,423 % | 3,416 % | +0,7 pb |
| 10/2025 | 2,638 % | 2,617 % | +2,1 pb |
| 10/2021 | −0,150 % | −0,206 % | +5,6 pb |
| 10/2016 | 0,040 % | 0,000 % | +4,0 pb |

L'écart de quelques points de base est normal : la BCE retient un taux à maturité constante, la Bundesbank le rendement de l'obligation de référence du moment.

## À faire après la mise en ligne

1. Dans l'onglet **Actions** du dépôt, lancer le workflow **« Test des sources de données »** (bouton « Run workflow »). Il ajoute ci-dessous un second tableau, « GitHub Actions ».
2. Comparer les deux tableaux. Si Yahoo est bloqué depuis GitHub (erreur 429 ou réponse vide), la collecte bascule seule sur le site d'Euronext pour tout ce qui y est coté : cours AED, Bel 20, ETF immobilier, Care Property Invest, Clariane, emeis, AB InBev (cours identiques à ceux de Yahoo sur les séances récentes, vérifié le 21/11/2026). Seuls trois indicateurs n'ont pas de secours et afficheraient alors leur dernière valeur connue, marquée « ancien » : le rendement total d'Aedifica, Welltower et Attendo.

## Résultats détaillés

<!-- essai:local -->
### Essai du 21/11/2026 à 11:58 — en local (PC)

**39 sources utilisées sur 40 répondent** (les sources « écartées » sont testées pour mémoire).

| Indicateur | Rôle | Source | État | Points | Première date | Dernière date | Dernière valeur / erreur | Durée (s) |
|---|---|---|---|---|---|---|---|---|
| Cours de clôture AED | principale | Yahoo Finance (AED.BR), corrigé des augmentations de capital | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 63,6 | 1.2 |
| Cours de clôture AED | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 63,6 | 0.6 |
| Cours AED ajusté des dividendes | principale | Yahoo Finance (AED.BR, cours ajusté) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 63,6 | 0.0 |
| Taux de dépôt BCE | principale | BCE (taux de la facilité de dépôt) | ✅ OK | 4708 | 01/01/2014 | 21/11/2026 | 2,5 | 1.0 |
| €STR | principale | BCE (€STR, taux pondéré) | ✅ OK | 1829 | 01/10/2019 | 19/11/2026 | 2,441 | 0.9 |
| Euribor 3 mois | principale | BCE (Euribor 3 mois, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 2,6347 | 2.4 |
| Bund 10 ans | principale | Bundesbank (rendement du Bund à 10 ans de référence) | ✅ OK | 3269 | 02/01/2014 | 20/11/2026 | 3,32 | 0.6 |
| Bund 10 ans | secours 1 | Bundesbank (rendement à maturité constante 10 ans, courbe des taux) | ✅ OK | 3270 | 02/01/2014 | 20/11/2026 | 3,37 | 0.6 |
| Bund 10 ans | secours 2 | Bundesbank (taux zéro-coupon 10 ans, courbe des taux) | ✅ OK | 3270 | 02/01/2014 | 20/11/2026 | 3,39 | 0.6 |
| Bund 10 ans | secours 3 | BCE (taux long allemand, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 3,416 | 0.7 |
| Taux long allemand (moyenne mensuelle) | principale | BCE (taux long allemand, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 3,416 | 0.4 |
| OLO 10 ans (Belgique) | principale | BCE (taux long belge, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 4,38 | 1.2 |
| VIX | principale | Cboe (historique officiel du VIX) | ✅ OK | 3275 | 02/01/2014 | 20/11/2026 | 35,89 | 0.9 |
| VIX | secours 1 | Yahoo Finance (^VIX) | ✅ OK | 3244 | 02/01/2014 | 20/11/2026 | 35,89 | 0.1 |
| VIX | secours 2 | FRED (VIXCLS) | ❌ KO | 0 | — | — | SourceErreur : pas de réponse de fred.stlouisfed.org (ReadTimeout) | 93.8 |
| VSTOXX | principale | STOXX (historique officiel du VSTOXX) | ✅ OK | 3282 | 02/01/2014 | 20/11/2026 | 28,3629 | 0.6 |
| Bel 20 | principale | Yahoo Finance (^BFX) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 5 797,75 | 0.2 |
| Bel 20 | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 5 797,75 | 0.4 |
| Immobilier coté européen (ETF iShares) | principale | Yahoo Finance (IQQP.DE, Xetra) | ✅ OK | 3272 | 02/01/2014 | 20/11/2026 | 27,18 | 0.2 |
| Immobilier coté européen (ETF iShares) | secours 1 | Yahoo Finance (IPRP.AS, Amsterdam) | ✅ OK | 3297 | 02/01/2014 | 20/11/2026 | 27,23 | 0.3 |
| Immobilier coté européen (ETF iShares) | secours 2 | Euronext Amsterdam (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 27,23 | 0.4 |
| Care Property Invest | principale | Yahoo Finance (CPINV.BR) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 12,56 | 0.2 |
| Care Property Invest | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 12,56 | 0.4 |
| Welltower (États-Unis) | principale | Yahoo Finance (WELL) | ✅ OK | 3242 | 02/01/2014 | 20/11/2026 | 240,34 | 0.2 |
| EUR/GBP | principale | BCE (cours de référence euro/livre) | ✅ OK | 3299 | 02/01/2014 | 20/11/2026 | 0,8374 | 1.1 |
| EUR/GBP | secours 1 | Yahoo Finance (EURGBP=X) | ✅ OK | 3356 | 01/01/2014 | 20/11/2026 | 0,838 | 0.2 |
| Inflation zone euro (IPCH, sur un an) | principale | Eurostat (IPCH, variation annuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 4 | 0.4 |
| Inflation zone euro (IPCH, sur un an) | secours 1 | BCE (IPCH, ancienne série arrêtée fin 2025) | ✅ OK | 144 | 31/01/2014 | 31/12/2025 | 1,9 | 1.1 |
| Locataire : Groupe Clariane | principale | Yahoo Finance (CLARI.PA) | ✅ OK | 3300 | 02/01/2014 | 20/11/2026 | 3,264 | 0.2 |
| Locataire : Groupe Clariane | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 3,264 | 0.4 |
| Locataire : AB InBev | principale | Yahoo Finance (ABI.BR) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 73 | 0.2 |
| Locataire : AB InBev | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 73 | 0.4 |
| Locataire : Groupe emeis (ex-Orpea) | principale | Yahoo Finance (EMEIS.PA) | ✅ OK | 3300 | 02/01/2014 | 20/11/2026 | 9,93 | 0.2 |
| Locataire : Groupe emeis (ex-Orpea) | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 9,93 | 0.4 |
| Locataire : Attendo | principale | Yahoo Finance (ATT.ST) | ✅ OK | 2760 | 30/11/2015 | 20/11/2026 | 133,1 | 0.2 |
| Communiqués officiels | principale | https://aedifica.eu/fr/communiques-de-presse/ | ✅ OK | 573 | 25/08/2006 | 18/11/2026 | Rapport financier intermédiaire Q3 2026 | 0.7 |
| Presse (fr) | principale | Google Actualités (RSS) | ✅ OK | 45 | 17/04/2020 | 19/11/2026 |  | 0.8 |
| Presse (nl) | principale | Google Actualités (RSS) | ✅ OK | 54 | 29/11/2016 | 20/11/2026 |  | 0.7 |
| Presse (en) | principale | Google Actualités (RSS) | ✅ OK | 21 | 15/12/2014 | 20/11/2026 |  | 0.7 |
| Cours AED | écartée | Stooq (aed.be) | ❌ KO | 0 | — | — | SourceErreur : Stooq ne renvoie plus de CSV sans clé (page HTML à la place) | 3.8 |
| VSTOXX | écartée | Yahoo Finance (^V2TX) | ❌ KO | 0 | — | — | SourceErreur : Yahoo n'a renvoyé aucune donnée pour ^V2TX (blocage ou symbole inconnu) | 4.0 |
| Inflation zone euro | écartée | Eurostat prc_hicp_manr (ancienne série) | ✅ OK | 144 | 31/01/2014 | 31/12/2025 | 2 | 0.4 |
| EUR/GBP | contrôle | Yahoo Finance (EURGBP=X) | ✅ OK | 3356 | 01/01/2014 | 20/11/2026 | 0,838 | 0.0 |

<!-- fin:local -->

<!-- essai:actions -->
### Essai du 21/11/2026 à 14:11 — GitHub Actions

**39 sources utilisées sur 40 répondent** (les sources « écartées » sont testées pour mémoire).

| Indicateur | Rôle | Source | État | Points | Première date | Dernière date | Dernière valeur / erreur | Durée (s) |
|---|---|---|---|---|---|---|---|---|
| Cours de clôture AED | principale | Yahoo Finance (AED.BR), corrigé des augmentations de capital | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 63,6 | 1.4 |
| Cours de clôture AED | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 63,6 | 1.0 |
| Cours AED ajusté des dividendes | principale | Yahoo Finance (AED.BR, cours ajusté) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 63,6 | 0.0 |
| Taux de dépôt BCE | principale | BCE (taux de la facilité de dépôt) | ✅ OK | 4708 | 01/01/2014 | 21/11/2026 | 2,5 | 1.7 |
| €STR | principale | BCE (€STR, taux pondéré) | ✅ OK | 1829 | 01/10/2019 | 19/11/2026 | 2,441 | 1.4 |
| Euribor 3 mois | principale | BCE (Euribor 3 mois, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 2,6347 | 2.6 |
| Bund 10 ans | principale | Bundesbank (rendement du Bund à 10 ans de référence) | ✅ OK | 3269 | 02/01/2014 | 20/11/2026 | 3,32 | 1.5 |
| Bund 10 ans | secours 1 | Bundesbank (rendement à maturité constante 10 ans, courbe des taux) | ✅ OK | 3270 | 02/01/2014 | 20/11/2026 | 3,37 | 1.0 |
| Bund 10 ans | secours 2 | Bundesbank (taux zéro-coupon 10 ans, courbe des taux) | ✅ OK | 3270 | 02/01/2014 | 20/11/2026 | 3,39 | 0.8 |
| Bund 10 ans | secours 3 | BCE (taux long allemand, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 3,416 | 1.4 |
| Taux long allemand (moyenne mensuelle) | principale | BCE (taux long allemand, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 3,416 | 0.4 |
| OLO 10 ans (Belgique) | principale | BCE (taux long belge, moyenne mensuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 4,38 | 1.1 |
| VIX | principale | Cboe (historique officiel du VIX) | ✅ OK | 3275 | 02/01/2014 | 20/11/2026 | 35,89 | 0.2 |
| VIX | secours 1 | Yahoo Finance (^VIX) | ✅ OK | 3244 | 02/01/2014 | 20/11/2026 | 35,89 | 0.3 |
| VIX | secours 2 | FRED (VIXCLS) | ❌ KO | 0 | — | — | SourceErreur : pas de réponse de fred.stlouisfed.org (ReadTimeout) | 93.3 |
| VSTOXX | principale | STOXX (historique officiel du VSTOXX) | ✅ OK | 3282 | 02/01/2014 | 20/11/2026 | 28,3629 | 0.9 |
| Bel 20 | principale | Yahoo Finance (^BFX) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 5 797,75 | 0.3 |
| Bel 20 | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 5 797,75 | 0.9 |
| Immobilier coté européen (ETF iShares) | principale | Yahoo Finance (IQQP.DE, Xetra) | ✅ OK | 3272 | 02/01/2014 | 20/11/2026 | 27,18 | 0.4 |
| Immobilier coté européen (ETF iShares) | secours 1 | Yahoo Finance (IPRP.AS, Amsterdam) | ✅ OK | 3297 | 02/01/2014 | 20/11/2026 | 27,23 | 0.3 |
| Immobilier coté européen (ETF iShares) | secours 2 | Euronext Amsterdam (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 27,23 | 0.7 |
| Care Property Invest | principale | Yahoo Finance (CPINV.BR) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 12,56 | 0.3 |
| Care Property Invest | secours 1 | Euronext Bruxelles (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 12,56 | 0.7 |
| Welltower (États-Unis) | principale | Yahoo Finance (WELL) | ✅ OK | 3242 | 02/01/2014 | 20/11/2026 | 240,34 | 0.3 |
| EUR/GBP | principale | BCE (cours de référence euro/livre) | ✅ OK | 3299 | 02/01/2014 | 20/11/2026 | 0,8374 | 1.1 |
| EUR/GBP | secours 1 | Yahoo Finance (EURGBP=X) | ✅ OK | 3356 | 01/01/2014 | 20/11/2026 | 0,838 | 0.3 |
| Inflation zone euro (IPCH, sur un an) | principale | Eurostat (IPCH, variation annuelle) | ✅ OK | 154 | 31/01/2014 | 31/10/2026 | 4 | 0.6 |
| Inflation zone euro (IPCH, sur un an) | secours 1 | BCE (IPCH, ancienne série arrêtée fin 2025) | ✅ OK | 144 | 31/01/2014 | 31/12/2025 | 1,9 | 1.1 |
| Locataire : Groupe Clariane | principale | Yahoo Finance (CLARI.PA) | ✅ OK | 3300 | 02/01/2014 | 20/11/2026 | 3,264 | 0.3 |
| Locataire : Groupe Clariane | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 3,264 | 0.6 |
| Locataire : AB InBev | principale | Yahoo Finance (ABI.BR) | ✅ OK | 3298 | 02/01/2014 | 20/11/2026 | 73 | 0.4 |
| Locataire : AB InBev | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 73 | 0.4 |
| Locataire : Groupe emeis (ex-Orpea) | principale | Yahoo Finance (EMEIS.PA) | ✅ OK | 3300 | 02/01/2014 | 20/11/2026 | 9,93 | 0.2 |
| Locataire : Groupe emeis (ex-Orpea) | secours 1 | Euronext (site officiel) | ✅ OK | 509 | 22/11/2024 | 20/11/2026 | 9,93 | 0.6 |
| Locataire : Attendo | principale | Yahoo Finance (ATT.ST) | ✅ OK | 2760 | 30/11/2015 | 20/11/2026 | 133,1 | 0.3 |
| Communiqués officiels | principale | https://aedifica.eu/fr/communiques-de-presse/ | ✅ OK | 573 | 25/08/2006 | 18/11/2026 | Rapport financier intermédiaire Q3 2026 | 1.4 |
| Presse (fr) | principale | Google Actualités (RSS) | ✅ OK | 44 | 20/11/2020 | 19/11/2026 |  | 0.6 |
| Presse (nl) | principale | Google Actualités (RSS) | ✅ OK | 52 | 29/11/2016 | 20/11/2026 |  | 4.0 |
| Presse (en) | principale | Google Actualités (RSS) | ✅ OK | 20 | 13/05/2017 | 20/11/2026 |  | 0.4 |
| Cours AED | écartée | Stooq (aed.be) | ❌ KO | 0 | — | — | SourceErreur : Stooq ne renvoie plus de CSV sans clé (page HTML à la place) | 4.3 |
| VSTOXX | écartée | Yahoo Finance (^V2TX) | ❌ KO | 0 | — | — | SourceErreur : Yahoo n'a renvoyé aucune donnée pour ^V2TX (blocage ou symbole inconnu) | 4.0 |
| Inflation zone euro | écartée | Eurostat prc_hicp_manr (ancienne série) | ✅ OK | 144 | 31/01/2014 | 31/12/2025 | 2 | 0.5 |
| EUR/GBP | contrôle | Yahoo Finance (EURGBP=X) | ✅ OK | 3356 | 01/01/2014 | 20/11/2026 | 0,838 | 0.0 |

<!-- fin:actions -->
