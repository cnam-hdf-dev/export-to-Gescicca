// Valeurs par défaut des colonnes d'inscription Gescicca.
// Reprises telles quelles du code existant — à terme, certaines seront
// dérivées de la situation contractuelle Yparéo (cf. CLAUDE.md, priorité 2).
export const DEFAUTS_INSCRIPTION = {
  ANNEE_FORMATION: "1",
  TYPE_FINANCEMENT_INSCRIPTION: "C",
  STATUT_EMPLOI: "7",
  STATUT_INSCRIPTION: "auditeur alternant",
  TYPE_INSCRIPTION: "APP",
};

// Année universitaire (colonne ANNEE, format AAAA). Calculées au chargement.
const _maintenant = new Date();
const _anneeCivile = _maintenant.getFullYear();

// Choix proposés dans le sélecteur : de l'an dernier à dans deux ans.
export const ANNEES = [
  _anneeCivile - 1,
  _anneeCivile,
  _anneeCivile + 1,
  _anneeCivile + 2,
].map(String);

// Présélection : année universitaire courante, bascule en septembre (mois index 8).
export const ANNEE_DEFAUT = String(
  _maintenant.getMonth() >= 8 ? _anneeCivile : _anneeCivile - 1
);

// Libellés exacts attendus par Gescicca (orthographe d'origine conservée).
export const CENTRES_ENSEIGNEMENT = [
  "Batiment Travaux Public",
  "Informatique",
  "Prévention des Risques, QSE",
  "Industrie, Mécanique",
  "Santé Action Sociale",
  "Commerce Marketing",
  "Ressources Humaines",
  "Entrepreunariat Management Innovation",
  "Logistique Transport",
  "Gestion Comptabilite Finance",
  "Droit ICH",
  "Alternance",
  "HTT",
];

// Centre d'enseignement présélectionné dans le sélecteur.
export const CENTRE_ENSEIGNEMENT_DEFAUT = "Alternance";

export const CENTRES_ATTACHEMENT = ["Amiens", "Lille", "Valenciennes"];

// Sérialisation du CSV d'import Gescicca.
export const SEPARATEUR = ";";
// Caractère de protection paramétré dans l'interface d'import Gescicca :
// chaque séparateur présent dans une valeur est encadré par ce caractère
// (ex. "a;b" -> "a\;\b"). À réaligner si le paramétrage Gescicca change.
export const SEPARATEUR_PROTECTION = "\\";
