import { useState, useEffect, useRef } from "react";
import "./ExportApprenants.css";
import Papa from "papaparse";
import {
  DEFAUTS_INSCRIPTION,
  ANNEES,
  ANNEE_DEFAUT,
  CENTRES_ENSEIGNEMENT,
  CENTRE_ENSEIGNEMENT_DEFAUT,
  CENTRES_ATTACHEMENT,
  SEPARATEUR,
  SEPARATEUR_PROTECTION,
} from "../config/gesciccaDefaults";

const token = process.env.REACT_APP_API_TOKEN;

const loadReferenceCsv = async (filePath, keyField, valueField) => {
  return new Promise((resolve) => {
    Papa.parse(filePath, {
      header: true,
      download: true,
      delimiter: ";",
      complete: (results) => {
        const map = {};
        results.data.forEach((row) => {
          if (row[keyField] && row[valueField]) {
            map[row[keyField]] = row[valueField];
          }
        });
        resolve(map);
      },
    });
  });
};

const formatCodePostal = (val) => {
  if (val === undefined || val === null || val === "") return "";
  return String(val).padStart(5, "0");
};

// Protège le séparateur à l'intérieur d'une valeur, selon le mécanisme
// d'import Gescicca : chaque séparateur interne est encadré par le
// caractère de protection paramétré. Les valeurs sans séparateur sont
// renvoyées inchangées (sortie identique à l'existant).
const protegerSeparateur = (val) => {
  const s = val !== undefined && val !== null ? String(val) : "";
  if (!s.includes(SEPARATEUR)) return s;
  return s
    .split(SEPARATEUR)
    .join(SEPARATEUR_PROTECTION + SEPARATEUR + SEPARATEUR_PROTECTION);
};

// Rend un libellé utilisable comme nom de fichier (retire accents et
// caractères interdits, replie les espaces/underscores).
const sanitizeNomFichier = (val, fallback = "groupe") => {
  const nettoye = String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return nettoye || fallback;
};

// Normalise une chaîne pour une recherche insensible à la casse et aux accents.
const sansAccents = (val) =>
  String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Libellé d'affichage d'un groupe.
const libelleGroupe = (g) =>
  g.nomGroupe || g.abregeGroupe || `Groupe ${g.codeGroupe}`;

export default function ExportApprenants() {
  const [groupes, setGroupes] = useState([]);
  const [selectedGroupe, setSelectedGroupe] = useState("");
  const [annee, setAnnee] = useState(ANNEE_DEFAUT);
  const [nomFormation, setNomFormation] = useState("");
  const [nomCentreEnseignement, setNomCentreEnseignement] = useState(CENTRE_ENSEIGNEMENT_DEFAUT);
  const [nomCentreAttachement, setNomCentreAttachement] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [nomGroupeExport, setNomGroupeExport] = useState("");
  const [editingCell, setEditingCell] = useState(null);

  // Combobox de recherche du groupe.
  const [rechercheGroupe, setRechercheGroupe] = useState("");
  const [groupeOuvert, setGroupeOuvert] = useState(false);
  const [indexActifGroupe, setIndexActifGroupe] = useState(0);
  const comboboxGroupeRef = useRef(null);

  // Tables de correspondance Yparéo -> Gescicca, chargées une fois au montage.
  const referencesRef = useRef({ communes: {}, nationalites: {}, pays: {} });
  const [referencesChargees, setReferencesChargees] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupesRes = await fetch(`/api/r/v1/formation-longue/groupes`, {
          headers: { "X-Auth-Token": token },
        });
        const groupesData = await groupesRes.json();
        const liste = Object.values(groupesData).sort((a, b) =>
          (a.nomGroupe || "").localeCompare(b.nomGroupe || "")
        );
        setGroupes(liste);

        const [communes, nationalites, pays] = await Promise.all([
          loadReferenceCsv("/ref/liste_communes.csv", "CODE_COMMUNE", "NOMENCL_INSEE"),
          loadReferenceCsv("/ref/liste_nationalites.csv", "CODE_NATIONALITE", "ID_BASE_EXTERNE"),
          loadReferenceCsv("/ref/liste_pays.csv", "CODE_PAYS", "ID_BASE_EXTERNE"),
        ]);
        referencesRef.current = { communes, nationalites, pays };
        setReferencesChargees(true);
      } catch (err) {
        console.error("Erreur lors du chargement initial :", err);
      }
    };

    fetchData();
  }, []);

  // Ferme la liste du combobox groupe au clic en dehors.
  useEffect(() => {
    if (!groupeOuvert) return;
    const handleClic = (e) => {
      if (comboboxGroupeRef.current && !comboboxGroupeRef.current.contains(e.target)) {
        setGroupeOuvert(false);
      }
    };
    document.addEventListener("mousedown", handleClic);
    return () => document.removeEventListener("mousedown", handleClic);
  }, [groupeOuvert]);

  const groupeSelectionne = groupes.find(
    (g) => g.codeGroupe.toString() === selectedGroupe
  );
  // Quand le champ affiche exactement le libellé du groupe choisi, on ne filtre
  // pas : la liste complète reste accessible pour en sélectionner un autre.
  const rechercheEffective =
    groupeSelectionne && rechercheGroupe === libelleGroupe(groupeSelectionne)
      ? ""
      : rechercheGroupe;
  const groupesFiltres = groupes.filter((g) =>
    sansAccents(libelleGroupe(g)).includes(sansAccents(rechercheEffective))
  );

  const choisirGroupe = (g) => {
    setSelectedGroupe(g.codeGroupe.toString());
    setRechercheGroupe(libelleGroupe(g));
    setGroupeOuvert(false);
  };

  const handleRechercheGroupeKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setGroupeOuvert(true);
      setIndexActifGroupe((i) => Math.min(i + 1, groupesFiltres.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndexActifGroupe((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (groupeOuvert && groupesFiltres[indexActifGroupe]) {
        e.preventDefault();
        choisirGroupe(groupesFiltres[indexActifGroupe]);
      }
    } else if (e.key === "Escape") {
      setGroupeOuvert(false);
    }
  };

  const handleExtract = async () => {
    const groupeInfo = groupes.find(g => g.codeGroupe.toString() === selectedGroupe);
    const nomGroupe = groupeInfo?.nomGroupe || '';

    if (!selectedGroupe) return;
    setLoading(true);
    try {
      const apprenantsRaw = await fetch(`/api/r/v1/groupes/${selectedGroupe}/apprenants`, {
        headers: {
          "X-Auth-Token": token,
        },
      }).then(res => res.json());
      const apprenants = Object.values(apprenantsRaw);

      const csvRows = [
        [
          "TITRE",
          // "INDEMNISATION",
          // "EXPERIENCE",
          "CODE_NATIONALITE",
          // "SITUATION_FAMILIALE",
          // "PROFESSION_INSEE",
          // "ANCIEN_CODE_AUDITEUR",
          // "NUMERO_SECURITE_SOCIALE",
          // "INE",
          // "INE_CNAM",
          "NOM",
          "PRENOM",
          "NOM_USAGE",
          "DATE_NAISSANCE",
          "PAYS_NAISSANCE",
          "LIEU_NAISSANCE",
          "ADRESSE_1",
          "ADRESSE_2",
          "CODE_POSTAL",
          "VILLE",
          "PAYS",
          "TELEPHONE_PERSONNEL",
          "TELEPHONE_PORTABLE",
          // "TELEPHONE_PROFESSIONNEL",
          // "NUMERO_POSTE",
          "COURRIEL_PERSONNEL",
          // "PROFESSION",
          // "FONCTION",
          // "DATE_CESSATION_ACTIVITE",
          // "MEMO",
          // "COURRIEL_PROFESSIONNEL",
          // "ADRESSE_SECONDAIRE_1",
          // "ADRESSE_SECONDAIRE_2",
          // "CODE_POSTAL_SECONDAIRE",
          // "VILLE_SECONDAIRE",
          // "PAYS_SECONDAIRE",
          // "COMPTE_AUXILLIAIRE",
          // "RAISON_SOCIALE_ENTREPRISE",
          // "SIRET_ENTREPRISE",
          // "IDENTIFIANT_ENTREPRISE",
          "ANNEE",
          "CENTRE_ENSEIGNEMENT",
          "CENTRE_ATTACHEMENT",
          // "STATUT_AUDITEUR",
          // "CENTRE_REGIONAL_INSCRIPTEUR",
          // "DIPLOME",
          // "SITUATION_GEOGRAPHIQUE",
          // "DISPOSITIF_FINANCEMENT",
          "TYPE_FINANCEMENT_INSCRIPTION",
          // "TYPE_TARIF_INSCRIPTION",
          // "SITUATION_PROFESSIONNELLE",
          "STATUT_EMPLOI",
          // "INSCRIT_POLE_EMPLOI",
          // "COMPTE_ANALYTIQUE",
          "FORMATION",
          "ANNEE_FORMATION",
          // "OPTION_FORMATION",
          "GROUPE_FORMATION",
          "STATUT_INSCRIPTION",
          "TYPE_INSCRIPTION",
          // "CODE_UNITE",
          // "GROUPE_UNITE",
          // "SEMESTRE_UNITE",
          // "TYPE_FINANCEMENT_UNITE",
          // "TYPE_TARIF_UNITE",
          // "CENTRE_REGIONAL_ORGANISATEUR",
          // "NOTE_SESSION_1",
          // "NOTE_SESSION_2",
          // "DATE_INSCRIPTION"
        ]
      ];

      // const apprenantDetails = await Promise.all(
      //   apprenants.map((a) =>
      //     fetch(`/api/r/v1/apprenants/${a.codeApprenant}`, {
      //       headers: {
      //         "X-Auth-Token": token,
      //       },
      //     }).then((res) => res.json())
      //   )
      // );

      const { communes, nationalites, pays } = referencesRef.current;

      apprenants.forEach((d) => {
        const codeInscriptionEnCours = d.informationsCourantes?.codeInscription;

        const inscriptionEnCours = d.inscriptions?.find(i => i.codeInscription === codeInscriptionEnCours);
        const isInscriptionActive = !inscriptionEnCours?.dateDepart;

        if (!isInscriptionActive) {
          return;
        }

        const codeInseeNaissance = formatCodePostal(communes[d.codeCommuneNaissance]);
        const codePostal = formatCodePostal(d.adresse?.cp);

        csvRows.push([
          d.codeCivilite, // TITRE
          // '',// INDEMNISATION
          // '',// EXPERIENCE
          nationalites[d.codeNationalite] || "", // CODE_NATIONALITE
          // '',// SITUATION_FAMILIALE
          // '',// PROFESSION_INSEE
          // '',// ANCIEN_CODE_AUDITEUR
          // '',// NUMERO_SECURITE_SOCIALE
          // '',// INE
          // '',// INE_CNAM
          d.nomJeuneFille ? d.nomJeuneFille : d.nomApprenant, // NOM
          d.prenomApprenant, // PRENOM
          (d.nomJeuneFille !== null && d.nomJeuneFille !== '') && d.nomJeuneFille !== d.nomApprenant ? d.nomApprenant : '' || '',// NOM_USAGE
          d.dateNaissance, // DATE_NAISSANCE
          pays[d.codePaysNaissance] || '', // PAYS_NAISSANCE
          codeInseeNaissance !== '' ? codeInseeNaissance : d.lieuNaissance, // LIEU_NAISSANCE
          d.adresse?.adr1, // ADRESSE_1
          d.adresse?.adr2 || '', // ADRESSE_2
          codePostal, // CODE_POSTAL
          d.adresse?.ville, // VILLE
          d.adresse?.pays?.nomPays, // PAYS
          d.adresse?.tel1, // TELEPHONE_PERSONNEL
          d.adresse?.tel2, // TELEPHONE_PORTABLE
          // '',// TELEPHONE_PROFESSIONNEL
          // '',// NUMERO_POSTE
          d.adresse?.email, // COURRIEL_PERSONNEL
          // '',// PROFESSION
          // '',// FONCTION
          // '',// DATE_CESSATION_ACTIVITE
          // '',// MEMO
          // '',// COURRIEL_PROFESSIONNEL
          // '',// ADRESSE_SECONDAIRE_1
          // '',// ADRESSE_SECONDAIRE_2
          // '',// CODE_POSTAL_SECONDAIRE
          // '',// VILLE_SECONDAIRE
          // '',// PAYS_SECONDAIRE
          // '',// COMPTE_AUXILLIAIRE
          // '',// RAISON_SOCIALE_ENTREPRISE
          // '',// SIRET_ENTREPRISE
          // '',// IDENTIFIANT_ENTREPRISE
          annee,// ANNEE
          nomCentreEnseignement,// CENTRE_ENSEIGNEMENT
          nomCentreAttachement,// CENTRE_ATTACHEMENT
          // '',// STATUT_AUDITEUR
          // '',// CENTRE_REGIONAL_INSCRIPTEUR
          // '',// DIPLOME
          // '',// SITUATION_GEOGRAPHIQUE
          // '',// DISPOSITIF_FINANCEMENT
          DEFAUTS_INSCRIPTION.TYPE_FINANCEMENT_INSCRIPTION,// TYPE_FINANCEMENT_INSCRIPTION
          // '',// TYPE_TARIF_INSCRIPTION
          // '',// SITUATION_PROFESSIONNELLE
          DEFAUTS_INSCRIPTION.STATUT_EMPLOI,// STATUT_EMPLOI
          // '',// INSCRIT_POLE_EMPLOI
          // '',// COMPTE_ANALYTIQUE
          nomFormation, // FORMATION
          DEFAUTS_INSCRIPTION.ANNEE_FORMATION,// ANNEE_FORMATION
          // '',// OPTION_FORMATION
          nomGroupe, // GROUPE_FORMATION
          DEFAUTS_INSCRIPTION.STATUT_INSCRIPTION,// STATUT_INSCRIPTION
          DEFAUTS_INSCRIPTION.TYPE_INSCRIPTION,// TYPE_INSCRIPTION
          // '',// CODE_UNITE
          // '',// GROUPE_UNITE
          // '',// SEMESTRE_UNITE
          // '',// TYPE_FINANCEMENT_UNITE
          // '',// TYPE_TARIF_UNITE
          // '',// CENTRE_REGIONAL_ORGANISATEUR
          // '',// NOTE_SESSION_1
          // '',// NOTE_SESSION_2
          // '',// DATE_INSCRIPTION
        ]);
      });
      setCsvPreview(csvRows);
      setNomGroupeExport(nomGroupe || selectedGroupe);
    } catch (err) {
      console.error("Erreur export:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob(["\ufeff" + csvPreview.map(r => r.map(protegerSeparateur).join(SEPARATEUR)).join("\n")], { type: "text/csv;charset=cp1252;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `import_Gescicca_groupe_${sanitizeNomFichier(nomGroupeExport)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="export-container">
      <h2 className="export-title">
        Exporter les apprenants d'un groupe
      </h2>

      <div className="groupe-combobox" ref={comboboxGroupeRef}>
        <input
          type="text"
          className="export-select"
          placeholder="Rechercher un groupe…"
          value={rechercheGroupe}
          role="combobox"
          aria-expanded={groupeOuvert}
          aria-controls="groupe-combobox-liste"
          aria-autocomplete="list"
          onChange={(e) => {
            setRechercheGroupe(e.target.value);
            setSelectedGroupe("");
            setGroupeOuvert(true);
            setIndexActifGroupe(0);
          }}
          onFocus={(e) => {
            setGroupeOuvert(true);
            e.target.select();
          }}
          onKeyDown={handleRechercheGroupeKeyDown}
        />
        {groupeOuvert && (
          <ul
            id="groupe-combobox-liste"
            className="groupe-combobox-liste"
            role="listbox"
          >
            {groupesFiltres.length === 0 ? (
              <li className="groupe-combobox-vide">Aucun groupe</li>
            ) : (
              groupesFiltres.map((g, i) => (
                <li
                  key={g.codeGroupe}
                  role="option"
                  aria-selected={g.codeGroupe.toString() === selectedGroupe}
                  className={
                    "groupe-combobox-option" +
                    (i === indexActifGroupe ? " actif" : "")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choisirGroupe(g);
                  }}
                  onMouseEnter={() => setIndexActifGroupe(i)}
                >
                  {libelleGroupe(g)}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div>
        <label>Année universitaire : </label><br />
        <select
          onChange={(e) => setAnnee(e.target.value)}
          value={annee}
          className="export-select"
        >
          {ANNEES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Nom exact de la formation dans Gescicca : </label><br />
        <input
          type="text"
          value={nomFormation}
          onChange={(e) => setNomFormation(e.target.value)}
          className="export-input"
        />
      </div>

      <br />

      <div>
        <label>Centre d'enseignement : </label><br />
        <select
          onChange={(e) => setNomCentreEnseignement(e.target.value)}
          value={nomCentreEnseignement}
          className="export-select"
        >
          <option value="">Sélectionner un centre d'enseignement</option>
          {CENTRES_ENSEIGNEMENT.map((centre) => (
            <option key={centre}>{centre}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Centre d'attachement : </label><br />
        <select
          onChange={(e) => setNomCentreAttachement(e.target.value)}
          value={nomCentreAttachement}
          className="export-select"
        >
          <option value="">Sélectionner un centre d'attachement</option>
          {CENTRES_ATTACHEMENT.map((centre) => (
            <option key={centre}>{centre}</option>
          ))}
        </select>
      </div>      
      
      <button
        onClick={handleExtract}
        disabled={loading || !selectedGroupe || !referencesChargees}
        className="export-button"
      >
        {loading
          ? "Extraction en cours..."
          : referencesChargees
          ? "Extraire"
          : "Chargement des référentiels..."}
      </button>
      
      <div>
      {csvPreview.length > 1 && (
        <table className="preview-table">
          <thead>
            <tr>
              {csvPreview[0].map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvPreview.slice(1).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                <td key={j} onDoubleClick={() => setEditingCell({ row: i, col: j })}>
                  {editingCell && editingCell.row === i && editingCell.col === j ? (
                    <input
                      type="text"
                      autoFocus
                      value={cell ?? ""}
                      onBlur={() => setEditingCell(null)}
                      onChange={(e) => {
                        const next = [...csvPreview];
                        next[i + 1] = [...next[i + 1]];
                        next[i + 1][j] = e.target.value;
                        setCsvPreview(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <span>{cell}</span>
                  )}
                </td>
                ))}
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={csvPreview[0].length}>
                Total d'apprenants : {csvPreview.length - 1}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      </div>

      <button
        onClick={handleExport}
        disabled={csvPreview.length <= 1}
        className="export-button"
      >
        {loading ? "Export en cours..." : "Exporter en CSV"}
      </button>
    </div>
  );
}
