// Validation d'une ligne du CSV d'import Gescicca (règles de la spec v2.4).
// `validerLigne` reçoit un objet { NOM_COLONNE: valeur } et renvoie un objet
// { NOM_COLONNE: "message" } pour chaque cellule fautive (vide si tout est bon).

import { CENTRES_ENSEIGNEMENT, CENTRES_ATTACHEMENT } from "./config/gesciccaDefaults";

const OBLIGATOIRES = new Set([
  "TITRE",
  "CODE_NATIONALITE",
  "NOM",
  "PRENOM",
  "DATE_NAISSANCE",
  "PAYS_NAISSANCE",
  "LIEU_NAISSANCE",
  "ADRESSE_1",
  "CODE_POSTAL",
  "VILLE",
  "PAYS",
  "COURRIEL_PERSONNEL",
  "ANNEE",
  "CENTRE_ENSEIGNEMENT",
  "TYPE_FINANCEMENT_INSCRIPTION",
  "FORMATION",
  "ANNEE_FORMATION",
  "GROUPE_FORMATION",
  "STATUT_INSCRIPTION",
]);

const VALEURS = {
  TITRE: ["1", "2", "3"],
  TYPE_FINANCEMENT_INSCRIPTION: ["I", "C"],
  STATUT_EMPLOI: ["1", "4", "5", "6", "7", "8", "9", "10"],
  STATUT_INSCRIPTION: [
    "auditeur en formation continue",
    "auditeur alternant",
    "autre",
  ],
  TYPE_INSCRIPTION: ["APP", "CONPRO", "EICNAM", "APP_EICNAM", "CONPRO_EICNAM"],
};

const LONGUEURS_MAX = {
  ADRESSE_1: 60,
  ADRESSE_2: 40,
  VILLE: 40,
  LIEU_NAISSANCE: 40, // uniquement quand c'est un nom de ville (hors France)
};

const RE_DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_CINQ_CHIFFRES = /^\d{5}$/;
const RE_QUATRE_CHIFFRES = /^\d{4}$/;
const RE_ENTIER = /^\d+$/;

// Jeux de caractères autorisés (test caractère par caractère).
const CH_LETTRE = "A-Za-zÀ-ÖØ-öø-ÿ";
const CH_NOM = new RegExp(`[${CH_LETTRE}' -]`); // lettres + apostrophe, espace, tiret
const CH_VILLE = new RegExp(`[${CH_LETTRE}', -]`); // + virgule
const CH_ADRESSE = new RegExp(`[0-9${CH_LETTRE}', -]`); // + chiffres

const chaine = (v) => (v === undefined || v === null ? "" : String(v));
const minus = (v) => chaine(v).trim().toLowerCase();

const premierCaractereInterdit = (valeur, autorises) => {
  for (const ch of chaine(valeur)) {
    if (!autorises.test(ch)) return ch;
  }
  return null;
};

const estFrance = (valeurPays) => {
  const s = minus(valeurPays);
  return s === "" || s === "0" || s === "france";
};

const verifierCaracteres = (valeur, autorises) => {
  const ch = premierCaractereInterdit(valeur, autorises);
  return ch === null ? null : `Caractère interdit : "${ch}"`;
};

const verifierLongueur = (valeur, colonne) => {
  const max = LONGUEURS_MAX[colonne];
  if (max && chaine(valeur).length > max) {
    return `Trop long (max ${max} caractères)`;
  }
  return null;
};

const verifierValeur = (valeur, colonne) => {
  const attendues = VALEURS[colonne];
  if (attendues && !attendues.includes(chaine(valeur))) {
    return `Valeur attendue : ${attendues.join(" | ")}`;
  }
  return null;
};

// Codes « Non mentionnée » (990) et « Sans nationalité » (995), interdits
// pour le pays de naissance comme pour la nationalité.
const verifierCodeInterdit = (valeur, libelle) =>
  ["990", "995"].includes(chaine(valeur).trim())
    ? `${libelle} non autorisé (990 / 995)`
    : null;

// Contrôles spécifiques par colonne. Reçoit (valeur, ligne) et renvoie un
// message ou null. Seulement appelé quand la valeur est non vide.
const CONTROLES = {
  NOM: (v) => verifierCaracteres(v, CH_NOM),
  PRENOM: (v) => verifierCaracteres(v, CH_NOM),
  NOM_USAGE: (v) => verifierCaracteres(v, CH_NOM),

  DATE_NAISSANCE: (v) => {
    if (!RE_DATE.test(chaine(v))) return "Date attendue au format JJ/MM/AAAA";
    const [jj, mm, aaaa] = chaine(v).split("/").map(Number);
    const d = new Date(aaaa, mm - 1, jj);
    if (d.getFullYear() !== aaaa || d.getMonth() !== mm - 1 || d.getDate() !== jj) {
      return "Date inexistante";
    }
    return null;
  },

  COURRIEL_PERSONNEL: (v) =>
    RE_EMAIL.test(chaine(v)) ? null : "Adresse e-mail invalide",

  PAYS_NAISSANCE: (v) => verifierCodeInterdit(v, "Code pays de naissance"),

  LIEU_NAISSANCE: (v, ligne) => {
    const paysNaiss = chaine(ligne.PAYS_NAISSANCE).trim();
    if (paysNaiss === "0") {
      return RE_CINQ_CHIFFRES.test(chaine(v))
        ? null
        : "Naissance en France : code commune INSEE attendu (5 chiffres)";
    }
    if (paysNaiss !== "") {
      return (
        verifierCaracteres(v, CH_VILLE) || verifierLongueur(v, "LIEU_NAISSANCE")
      );
    }
    return null; // PAYS_NAISSANCE vide : déjà signalé sur sa propre cellule
  },

  ADRESSE_1: (v) =>
    verifierCaracteres(v, CH_ADRESSE) || verifierLongueur(v, "ADRESSE_1"),
  ADRESSE_2: (v) =>
    verifierCaracteres(v, CH_ADRESSE) || verifierLongueur(v, "ADRESSE_2"),
  VILLE: (v) => verifierCaracteres(v, CH_VILLE) || verifierLongueur(v, "VILLE"),

  CODE_POSTAL: (v, ligne) =>
    estFrance(ligne.PAYS) && !RE_CINQ_CHIFFRES.test(chaine(v))
      ? "Code postal : 5 chiffres attendus (France)"
      : null,

  ANNEE: (v) =>
    RE_QUATRE_CHIFFRES.test(chaine(v)) ? null : "Année attendue au format AAAA",
  ANNEE_FORMATION: (v) =>
    RE_ENTIER.test(chaine(v)) ? null : "Nombre entier attendu",

  CODE_NATIONALITE: (v) =>
    verifierCodeInterdit(v, "Code nationalité") ||
    (RE_ENTIER.test(chaine(v).trim()) ? null : "Code nationalité invalide"),

  CENTRE_ENSEIGNEMENT: (v) =>
    CENTRES_ENSEIGNEMENT.includes(chaine(v))
      ? null
      : "Centre d'enseignement inconnu (libellé exact Gescicca attendu)",
  CENTRE_ATTACHEMENT: (v) =>
    CENTRES_ATTACHEMENT.includes(chaine(v))
      ? null
      : "Centre d'attachement inconnu (libellé exact Gescicca attendu)",
};

export function validerLigne(ligne) {
  const erreurs = {};

  for (const colonne of Object.keys(ligne)) {
    const valeur = chaine(ligne[colonne]);
    const vide = valeur.trim() === "";

    if (vide) {
      if (OBLIGATOIRES.has(colonne)) {
        erreurs[colonne] = "Champ obligatoire manquant";
      }
      continue; // pas de contrôle de format sur une valeur vide
    }

    const message =
      verifierValeur(valeur, colonne) ||
      (CONTROLES[colonne] ? CONTROLES[colonne](valeur, ligne) : null);

    if (message) erreurs[colonne] = message;
  }

  return erreurs;
}
