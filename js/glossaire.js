// Glossaire : chaque sigle ou terme technique affiché dans l'application a son entrée ici.
// Les info-bulles ⓘ des écrans y renvoient (identifiant = `id`).
// Ces définitions sont générales. Ce qui est propre à une société (son précompte, ses
// pairs…) vient de sa configuration (clé « glossaire ») et remplace ou complète ces entrées.

export const GLOSSAIRE = [
  { id: "sir", terme: "SIR", definition: "Société Immobilière Réglementée : statut belge des sociétés immobilières cotées, obligées de distribuer l'essentiel de leurs bénéfices. C'est l'équivalent du REIT (Real Estate Investment Trust) dans d'autres pays." },
  { id: "epra", terme: "EPRA", definition: "European Public Real Estate Association : association qui fixe des normes de calcul communes aux sociétés immobilières cotées en Europe, pour que leurs chiffres soient comparables." },
  { id: "epra-nta", terme: "EPRA NTA", definition: "Net Tangible Assets : valeur comptable par action selon la norme EPRA (patrimoine à sa juste valeur moins les dettes, hors certains éléments comme les instruments de couverture). C'est la référence pour mesurer la décote. Elle est publiée quatre fois par an et ne bouge pas avec le cours." },
  { id: "van-ifrs", terme: "VAN IFRS", definition: "Valeur de l'Actif Net selon les normes comptables internationales IFRS (International Financial Reporting Standards) : ce que valent les actifs moins les dettes, par action." },
  { id: "epra-nav", terme: "EPRA NAV", definition: "Ancienne mesure EPRA de la valeur nette par action, remplacée en 2020 par l'EPRA NTA. Dans cette application, les valeurs comptables d'avant 2021 marquées d'un astérisque (*) sont l'ancien EPRA NAV ou, quand il n'était pas publié, l'actif net par action hors instruments de couverture." },
  { id: "decote-prime", terme: "Décote / prime", definition: "Écart entre le cours de bourse et la valeur comptable par action (EPRA NTA). Négatif = décote : l'action cote sous sa valeur comptable. Positif = prime : elle cote au-dessus. Formule : (cours ÷ NTA − 1) × 100. Pour une date passée, on utilise la dernière NTA publiée avant cette date." },
  { id: "capitalisation-boursiere", terme: "Capitalisation boursière", definition: "Valeur totale de la société en bourse : cours × nombre d'actions." },
  { id: "epra-eps", terme: "EPRA EPS (résultat EPRA par action)", definition: "Bénéfice récurrent par action, hors variations de valeur des immeubles. C'est la base du dividende. EPS = Earnings Per Share (bénéfice par action). On parle aussi d'« EPRA Earnings »." },
  { id: "multiple", terme: "Multiple de résultat", definition: "Cours ÷ EPRA EPS de l'exercice : le nombre d'années de bénéfice récurrent que l'on paie en achetant l'action. Plus il est bas, moins l'action est chère par rapport à ses bénéfices." },
  { id: "rendement-du-dividende", terme: "Rendement du dividende", definition: "Dividende brut annuel ÷ cours. Pour l'exercice en cours, on utilise le dividende prévu par la société ; pour les dates passées, le dividende versé au titre de l'exercice qui était alors en cours. Le rendement net est celui après précompte mobilier." },
  { id: "rendement-total", terme: "Rendement total", definition: "Gain complet de l'actionnaire sur une période : variation du cours + dividendes, en supposant les dividendes réinvestis en actions. Il est calculé avec le cours « ajusté » des dividendes et des augmentations de capital." },
  { id: "cours-de-cloture", terme: "Cours de clôture", definition: "Dernier cours de la séance sur Euronext. L'application affiche le cours réellement coté à chaque date (ce que l'on voyait à l'époque), sans le corriger des dividendes. Les sources en ligne recalculent souvent les cours anciens après une augmentation de capital : ici ils sont remis à leur valeur d'origine." },
  { id: "precompte-mobilier", terme: "Précompte mobilier", definition: "Impôt belge retenu à la source sur les dividendes : 30 % en règle générale. Un taux réduit de 15 % existe pour les SIR investies à plus de 80 % en immobilier de santé dans l'Espace économique européen." },
  { id: "taux-d-endettement", terme: "Taux d'endettement", definition: "Dettes ÷ total des actifs. Le plafond légal est de 65 % pour une SIR." },
  { id: "ltv", terme: "LTV (EPRA LTV)", definition: "Loan-to-Value : dette nette ÷ valeur du patrimoine, calculée selon la norme EPRA. Plus elle est basse, plus le bilan est solide." },
  { id: "cout-moyen-de-la-dette", terme: "Coût moyen de la dette", definition: "Taux d'intérêt moyen payé par la société sur ses emprunts, couvertures de taux comprises. La version « commissions comprises » ajoute les frais payés aux banques sur les lignes de crédit." },
  { id: "ratio-de-couverture", terme: "Ratio (taux) de couverture", definition: "Part de la dette protégée contre une hausse des taux d'intérêt, par des emprunts à taux fixe ou des instruments de couverture. À 90 %, une hausse des taux ne touche d'abord que 10 % de la dette." },
  { id: "wault", terme: "WAULT", definition: "Weighted Average Unexpired Lease Term : durée moyenne restante des baux, pondérée par les loyers. Plus elle est longue, plus les revenus sont visibles longtemps." },
  { id: "taux-d-occupation", terme: "Taux d'occupation", definition: "Part des surfaces louées dans le patrimoine. À ne pas confondre avec le taux d'occupation des exploitants (part des lits occupés dans leurs maisons de repos)." },
  { id: "juste-valeur", terme: "Juste valeur", definition: "Valeur des immeubles estimée chaque trimestre par des experts indépendants." },
  { id: "actifs-detenus-en-vue-de-la-vente", terme: "Actifs détenus en vue de la vente", definition: "Immeubles que la société a décidé de vendre et dont la vente est probable à court terme (norme comptable IFRS 5)." },
  { id: "bce", terme: "BCE et taux de dépôt", definition: "Banque Centrale Européenne. Le taux de dépôt est le taux qui rémunère les dépôts des banques à la BCE : c'est son principal taux directeur, celui qui pilote les taux courts." },
  { id: "estr", terme: "€STR", definition: "Euro Short-Term Rate : taux du marché interbancaire au jour le jour dans la zone euro. Il existe depuis octobre 2019." },
  { id: "euribor-3-mois", terme: "Euribor 3 mois", definition: "Taux auquel les banques se prêtent de l'argent à 3 mois. Il sert de référence aux crédits à taux variable." },
  { id: "bund", terme: "Bund 10 ans", definition: "Obligation de l'État allemand. Son rendement à 10 ans est la référence des taux longs en zone euro. Quand il monte, le dividende d'une SIR devient moins attractif par comparaison et la valeur des immeubles peut baisser." },
  { id: "olo", terme: "OLO", definition: "Obligation Linéaire Ordinaire : obligation de l'État belge. Son rendement à 10 ans est le taux long belge." },
  { id: "ecart-olo-bund", terme: "Écart OLO – Bund", definition: "Différence entre le taux à 10 ans de la Belgique et celui de l'Allemagne. C'est la prime que la Belgique paie pour emprunter : elle mesure le risque belge. Calculé avec les moyennes mensuelles publiées par la BCE." },
  { id: "ecart-dividende-bund", terme: "Écart dividende – Bund", definition: "Rendement brut du dividende moins le Bund 10 ans. C'est la prime de risque : le supplément de rendement offert par l'action par rapport à un placement sans risque. Plus il est élevé, plus l'action est attractive face aux obligations." },
  { id: "point-de-pourcentage", terme: "Point (pt)", definition: "Point de pourcentage : différence entre deux pourcentages. Passer de 2 % à 3 %, c'est + 1 point, pas « + 50 % ». Les variations de taux sont toujours données en points." },
  { id: "pb", terme: "pb (point de base)", definition: "Un point de base = 0,01 point de pourcentage. + 25 pb = + 0,25 point." },
  { id: "vix", terme: "VIX", definition: "Indice de volatilité attendue de la bourse américaine (S&P 500), surnommé « indice de la peur ». Au-dessus de 25, les marchés sont nerveux." },
  { id: "vstoxx", terme: "VSTOXX", definition: "Équivalent européen du VIX, calculé sur l'indice Euro Stoxx 50." },
  { id: "bel-20", terme: "Bel 20", definition: "Indice des vingt principales sociétés cotées à la bourse de Bruxelles." },
  { id: "indice-immobilier-cote-europeen", terme: "Immobilier coté européen", definition: "Cours de l'ETF iShares European Property Yield, un fonds coté qui réplique un panier de sociétés immobilières cotées en Europe. Il sert à comparer la société à son secteur. ETF = Exchange Traded Fund (fonds indiciel coté)." },
  { id: "pairs", terme: "Pairs", definition: "Autres sociétés cotées du même secteur, auxquelles on compare la société. Leurs cours sont ajustés des opérations sur le capital." },
  { id: "eur-gbp", terme: "EUR/GBP", definition: "Nombre de livres sterling pour un euro. Si l'euro monte face à la livre, des revenus en livres valent moins une fois convertis en euros." },
  { id: "ipch", terme: "IPCH (inflation)", definition: "Indice des Prix à la Consommation Harmonisé : mesure de l'inflation dans la zone euro, exprimée ici en hausse des prix sur un an." },
  { id: "indice-sante", terme: "Indice santé", definition: "Indice belge des prix (hors tabac, alcool et carburants) qui sert à indexer les loyers en Belgique." },
  { id: "ebitdar", terme: "EBITDAR et couverture des loyers", definition: "Bénéfice d'exploitation de l'exploitant avant intérêts, impôts, amortissements et loyers. Divisé par le loyer, il donne la couverture des loyers (parfois appelée « taux d'effort ») : à 1,5, l'exploitant gagne une fois et demie son loyer. Sous 1, il ne gagne pas assez pour le payer." },
  { id: "notation-de-credit", terme: "Notation de crédit", definition: "Note de solvabilité attribuée par une agence (S&P, Moody's). BBB+ chez S&P et A3 chez Moody's sont des notes de « qualité investissement » : le risque de défaut est jugé faible." },
  { id: "exploitant", terme: "Exploitant (locataire)", definition: "Société qui gère une maison de repos et paie le loyer au propriétaire des murs. Ses difficultés financières sont un signal d'alerte pour les loyers." },
  { id: "n-d", terme: "n.d.", definition: "Non disponible. L'application n'invente jamais une donnée : quand une valeur manque, elle affiche « n.d. » avec la raison, et conserve la dernière valeur valide connue avec sa date." },
];

/** Ajoute ou remplace des entrées par celles de la société affichée (config → synthese.json). */
export function completerGlossaire(entrees) {
  for (const entree of entrees || []) {
    if (!entree?.id || !entree.terme || !entree.definition) continue;
    const rang = GLOSSAIRE.findIndex((e) => e.id === entree.id);
    if (rang >= 0) GLOSSAIRE[rang] = entree;
    else GLOSSAIRE.push(entree);
  }
}
