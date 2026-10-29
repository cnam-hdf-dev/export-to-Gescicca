// Règle appliquée à l'extraction : une personne née à l'étranger dont la
// nationalité est « non mentionnée » (990) ou absente reçoit la nationalité de
// son pays de naissance. Les valeurs comparées sont des codes Gescicca ("0" =
// France).

const CODES_INTERDITS = ["990", "995"];

const chaine = (v) => (v === undefined || v === null ? "" : String(v).trim());

export function appliquerRegleNationalite(paysNaissance, codeNationalite) {
  const pays = chaine(paysNaissance);
  const nationalite = chaine(codeNationalite);

  // Rien à recopier si le pays de naissance est vide ou lui-même interdit : la
  // cellule reste signalée par la validation.
  const paysRecopiable =
    pays !== "" && pays !== "0" && !CODES_INTERDITS.includes(pays);
  const nationaliteARevoir = nationalite === "" || nationalite === "990";

  if (paysRecopiable && nationaliteARevoir) {
    return { codeNationalite: pays, deduite: true };
  }
  return { codeNationalite, deduite: false };
}
