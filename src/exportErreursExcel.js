// Génération du classeur Excel des lignes en erreur de l'aperçu.
// `entetes` : noms de colonnes ; `lignes` : tableaux de valeurs (sans l'en-tête) ;
// `erreursParLigne` : sortie de validerLigne pour chaque ligne (même indices).

const COULEUR_FAUTIVE = "FFFDE2E2";
const LARGEUR_MAX = 40;

const ligneAErreurs = (erreurs) =>
  !!erreurs && Object.keys(erreurs).length > 0;

const texte = (v) => (v === undefined || v === null ? "" : String(v));

export async function genererClasseurErreurs(entetes, lignes, erreursParLigne) {
  const { default: ExcelJS } = await import("exceljs");

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet("Erreurs");

  const colonnes = [...entetes, "Erreurs"];
  feuille.addRow(colonnes);
  const largeurs = colonnes.map((c) => c.length);

  lignes.forEach((ligne, i) => {
    const erreurs = erreursParLigne[i];
    if (!ligneAErreurs(erreurs)) return;

    const valeurs = entetes.map((_, j) => texte(ligne[j]));
    const messages = Object.entries(erreurs)
      .map(([colonne, message]) => `${colonne} : ${message}`)
      .join(" ; ");
    const row = feuille.addRow([...valeurs, messages]);

    // Tout en texte pour préserver zéros initiaux, dates et téléphones.
    row.eachCell({ includeEmpty: true }, (cell, numero) => {
      cell.numFmt = "@";
      const j = numero - 1;
      if (j < entetes.length && erreurs[entetes[j]] !== undefined) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COULEUR_FAUTIVE },
        };
      }
      largeurs[j] = Math.max(largeurs[j], texte(cell.value).length);
    });
  });

  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: "frozen", ySplit: 1 }];
  feuille.columns.forEach((col, j) => {
    col.width = Math.min(largeurs[j] + 2, LARGEUR_MAX);
  });

  return classeur.xlsx.writeBuffer();
}
