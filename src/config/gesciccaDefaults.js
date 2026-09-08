// Valeurs par défaut des colonnes d'inscription Gescicca.
// Reprises telles quelles du code existant — à terme, certaines seront
// dérivées de la situation contractuelle Yparéo (cf. CLAUDE.md, priorité 2).
export const DEFAUTS_INSCRIPTION = {
  ANNEE: "2025",
  ANNEE_FORMATION: "1",
  TYPE_FINANCEMENT_INSCRIPTION: "C",
  STATUT_EMPLOI: "7",
  STATUT_INSCRIPTION: "auditeur alternant",
  TYPE_INSCRIPTION: "APP",
};

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
];

export const CENTRES_ATTACHEMENT = ["Amiens", "Lille", "Valenciennes"];

// Sérialisation du CSV d'import Gescicca.
export const SEPARATEUR = ";";
// Caractère de protection paramétré dans l'interface d'import Gescicca :
// chaque séparateur présent dans une valeur est encadré par ce caractère
// (ex. "a;b" -> "a\;\b"). À réaligner si le paramétrage Gescicca change.
export const SEPARATEUR_PROTECTION = "\\";
