import { validerLigne } from "./gesciccaValidation";

const LIGNE_OK = {
  TITRE: "1",
  CODE_NATIONALITE: "216",
  NOM: "Dupont",
  PRENOM: "Marie",
  NOM_USAGE: "",
  DATE_NAISSANCE: "05/09/1998",
  PAYS_NAISSANCE: "0",
  LIEU_NAISSANCE: "59350",
  ADRESSE_1: "12 rue des Lilas",
  ADRESSE_2: "",
  CODE_POSTAL: "59000",
  VILLE: "Lille",
  PAYS: "France",
  TELEPHONE_PERSONNEL: "",
  TELEPHONE_PORTABLE: "",
  COURRIEL_PERSONNEL: "marie@example.com",
  ANNEE: "2026",
  CENTRE_ENSEIGNEMENT: "Alternance",
  CENTRE_ATTACHEMENT: "Lille",
  TYPE_FINANCEMENT_INSCRIPTION: "C",
  STATUT_EMPLOI: "7",
  FORMATION: "Licence X",
  ANNEE_FORMATION: "1",
  GROUPE_FORMATION: "GRP1",
  STATUT_INSCRIPTION: "auditeur alternant",
  TYPE_INSCRIPTION: "APP",
};

test("une ligne conforme ne remonte aucune erreur", () => {
  expect(validerLigne(LIGNE_OK)).toEqual({});
});

test("champ obligatoire vide", () => {
  const err = validerLigne({ ...LIGNE_OK, NOM: "", VILLE: "   " });
  expect(err.NOM).toMatch(/obligatoire/i);
  expect(err.VILLE).toMatch(/obligatoire/i);
});

test("caractère interdit dans le nom", () => {
  expect(validerLigne({ ...LIGNE_OK, NOM: "Dup0nt" }).NOM).toMatch(/interdit/i);
});

test("VILLE refuse les chiffres, ADRESSE_1 les accepte", () => {
  expect(validerLigne({ ...LIGNE_OK, VILLE: "Lille2" }).VILLE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, ADRESSE_1: "3 rue de l'Abbé, bat 2" }).ADRESSE_1).toBeUndefined();
});

test("format date et e-mail", () => {
  expect(validerLigne({ ...LIGNE_OK, DATE_NAISSANCE: "1998-09-05" }).DATE_NAISSANCE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, DATE_NAISSANCE: "32/13/2000" }).DATE_NAISSANCE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, COURRIEL_PERSONNEL: "pasunemail" }).COURRIEL_PERSONNEL).toBeDefined();
});

test("code postal 5 chiffres exigé pour la France", () => {
  expect(validerLigne({ ...LIGNE_OK, CODE_POSTAL: "5900" }).CODE_POSTAL).toBeDefined();
});

test("LIEU_NAISSANCE : INSEE si né en France, nom de ville sinon", () => {
  expect(validerLigne({ ...LIGNE_OK, LIEU_NAISSANCE: "Lille" }).LIEU_NAISSANCE).toBeDefined();
  const etranger = validerLigne({
    ...LIGNE_OK,
    PAYS_NAISSANCE: "216",
    LIEU_NAISSANCE: "Shanghai",
  });
  expect(etranger.LIEU_NAISSANCE).toBeUndefined();
});

test("codes 990 / 995 interdits pour pays de naissance et nationalité", () => {
  expect(validerLigne({ ...LIGNE_OK, PAYS_NAISSANCE: "990", LIEU_NAISSANCE: "Paris" }).PAYS_NAISSANCE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, CODE_NATIONALITE: "990" }).CODE_NATIONALITE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, CODE_NATIONALITE: "995" }).CODE_NATIONALITE).toBeDefined();
});

test("valeurs de référence", () => {
  expect(validerLigne({ ...LIGNE_OK, TITRE: "M" }).TITRE).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, TYPE_FINANCEMENT_INSCRIPTION: "X" }).TYPE_FINANCEMENT_INSCRIPTION).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, STATUT_INSCRIPTION: "auditeur" }).STATUT_INSCRIPTION).toBeDefined();
  expect(validerLigne({ ...LIGNE_OK, STATUT_EMPLOI: "" }).STATUT_EMPLOI).toBeUndefined();
});
