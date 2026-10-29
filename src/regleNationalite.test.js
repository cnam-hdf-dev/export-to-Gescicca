import { appliquerRegleNationalite } from "./regleNationalite";

test.each([
  ["216", "990", "216"],
  ["216", "", "216"],
  ["216", undefined, "216"],
])("né à l'étranger (%s), nationalité %p → %s déduite", (pays, nat, attendu) => {
  expect(appliquerRegleNationalite(pays, nat)).toEqual({
    codeNationalite: attendu,
    deduite: true,
  });
});

test.each([
  ["216", "105"],
  ["216", "0"],
  ["216", "995"],
  ["0", "990"],
  ["0", ""],
  ["", "990"],
  ["", ""],
  ["990", ""],
  ["995", "990"],
])("pays %p, nationalité %p → inchangé", (pays, nat) => {
  expect(appliquerRegleNationalite(pays, nat)).toEqual({
    codeNationalite: nat,
    deduite: false,
  });
});
