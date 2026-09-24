import ExcelJS from "exceljs";
import { genererClasseurErreurs } from "./exportErreursExcel";

const ENTETES = ["NOM", "CODE_POSTAL", "VILLE"];
const LIGNES = [
  ["Dupont", "59000", "Lille"],
  ["Martin", "0500", "Gap2"],
  ["Durand", "05000", "Gap"],
];
const ERREURS = [
  {},
  { CODE_POSTAL: "5 chiffres attendus", VILLE: "Caractère interdit" },
  {},
];

test("le classeur ne contient que les lignes fautives, colorées, avec une colonne Erreurs", async () => {
  const buffer = await genererClasseurErreurs(ENTETES, LIGNES, ERREURS);

  const relu = new ExcelJS.Workbook();
  await relu.xlsx.load(buffer);
  const feuille = relu.getWorksheet("Erreurs");

  expect(feuille.rowCount).toBe(2);
  expect(feuille.getRow(1).values.slice(1)).toEqual([
    "NOM",
    "CODE_POSTAL",
    "VILLE",
    "Erreurs",
  ]);

  const ligne = feuille.getRow(2);
  expect(ligne.getCell(1).value).toBe("Martin");
  expect(ligne.getCell(2).value).toBe("0500");
  expect(ligne.getCell(4).value).toBe(
    "CODE_POSTAL : 5 chiffres attendus ; VILLE : Caractère interdit"
  );

  expect(ligne.getCell(1).fill?.fgColor?.argb).toBeUndefined();
  expect(ligne.getCell(2).fill.fgColor.argb).toBe("FFFDE2E2");
  expect(ligne.getCell(3).fill.fgColor.argb).toBe("FFFDE2E2");
});
