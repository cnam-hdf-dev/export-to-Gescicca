import { useState, useEffect } from "react";
import "./ExportApprenants.css";
import Papa from "papaparse";

const token = process.env.REACT_APP_API_TOKEN;

let communesMap = {};
let nationalitesMap = {};
let paysMap = {};

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
        console.log(map);
        resolve(map);
      },
    });
  });
};

const formatCodePostal = (val) => {
  if (val === undefined || val === null || val === "") return "";
  return String(val).padStart(5, "0");
};

export default function ExportApprenants() {
  const [groupes, setGroupes] = useState([]);
  const [selectedGroupe, setSelectedGroupe] = useState("");
  const [nomFormation, setNomFormation] = useState("");
  const [nomCentreEnseignement, setNomCentreEnseignement] = useState("");
  const [nomCentreAttachement, setNomCentreAttachement] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupesRes = await fetch(`/api/r/v1/formation-longue/groupes`, {
          headers: { "X-Auth-Token": token },
        });
        const groupesData = await groupesRes.json();
        setGroupes(Object.values(groupesData));

        communesMap = await loadReferenceCsv("/ref/liste_communes.csv", "CODE_COMMUNE", "NOMENCL_INSEE");
        nationalitesMap = await loadReferenceCsv("/ref/liste_nationalites.csv", "CODE_NATIONALITE", "ID_BASE_EXTERNE");
        paysMap = await loadReferenceCsv("/ref/liste_pays.csv", "CODE_PAYS", "ID_BASE_EXTERNE");
      } catch (err) {
        console.error("Erreur lors du chargement initial :", err);
      }
    };

    fetchData();
  }, []);

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
          // "STATUT_EMPLOI",
          // "INSCRIT_POLE_EMPLOI",
          // "COMPTE_ANALYTIQUE",
          "FORMATION",
          // "ANNEE_FORMATION",
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

      const apprenantDetails = await Promise.all(
        apprenants.map((a) =>
          fetch(`/api/r/v1/apprenants/${a.codeApprenant}`, {
            headers: {
              "X-Auth-Token": token,
            },
          }).then((res) => res.json())
        )
      );

      apprenantDetails.forEach((d) => {
        const codeInseeNaissance = formatCodePostal(communesMap[d.codeCommuneNaissance]);
        const codePostal = formatCodePostal(d.adresse?.cp);

        csvRows.push([
          d.codeCivilite, // TITRE
          // '',// INDEMNISATION
          // '',// EXPERIENCE
          nationalitesMap[d.codeNationalite] || "", // CODE_NATIONALITE
          // '',// SITUATION_FAMILIALE
          // '',// PROFESSION_INSEE
          // '',// ANCIEN_CODE_AUDITEUR
          // '',// NUMERO_SECURITE_SOCIALE
          // '',// INE
          // '',// INE_CNAM
          d.nomApprenant, // NOM
          d.prenomApprenant, // PRENOM
          d.nomJeuneFille || '',// NOM_USAGE
          d.dateNaissance, // DATE_NAISSANCE
          paysMap[d.codePaysNaissance] || "", // PAYS_NAISSANCE
          codeInseeNaissance, // LIEU_NAISSANCE
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
          '2025',// ANNEE
          nomCentreEnseignement,// CENTRE_ENSEIGNEMENT
          nomCentreAttachement,// CENTRE_ATTACHEMENT
          // '',// STATUT_AUDITEUR
          // '',// CENTRE_REGIONAL_INSCRIPTEUR
          // '',// DIPLOME
          // '',// SITUATION_GEOGRAPHIQUE
          // '',// DISPOSITIF_FINANCEMENT
          '',// TYPE_FINANCEMENT_INSCRIPTION
          // '',// TYPE_TARIF_INSCRIPTION
          // '',// SITUATION_PROFESSIONNELLE
          // '',// STATUT_EMPLOI
          // '',// INSCRIT_POLE_EMPLOI
          // '',// COMPTE_ANALYTIQUE
          nomFormation, // FORMATION
          // '',// ANNEE_FORMATION
          // '',// OPTION_FORMATION
          nomGroupe, // GROUPE_FORMATION
          d.inscriptions[0].codeStatut,// STATUT_INSCRIPTION
          '',// TYPE_INSCRIPTION
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
    } catch (err) {
      console.error("Erreur export:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob(["\ufeff" + csvPreview.map(r => r.map(v => `"${v !== undefined && v !== null ? v : ""}"`).join(";")).join("\n")], { type: "text/csv;charset=cp1252;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `import_Gescicca_groupe_${csvPreview[1][21]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="export-container">
      <h2 className="export-title">
        Exporter les apprenants d'un groupe
      </h2>

      <select
        onChange={(e) => setSelectedGroupe(e.target.value)}
        value={selectedGroupe}
        className="export-select"
      >
        <option value="">Sélectionner un groupe</option>
        {groupes.map((g) => (
          <option key={g.codeGroupe} value={g.codeGroupe.toString()}>
            {g.nomGroupe || g.abregeGroupe || `Groupe ${g.codeGroupe}`}
          </option>
        ))}
      </select>

      <div>
        <label>Nom exact de la formation dans Gescicca : </label>
        <input
          type="text"
          value={nomFormation}
          onChange={(e) => setNomFormation(e.target.value)}
          className="export-input"
        />
      </div>

      <br />

      <div>
        <label>Centre d'enseignement : </label>
        <select
          onChange={(e) => setNomCentreEnseignement(e.target.value)}
          value={nomCentreEnseignement}
          className="export-select"
        >
          <option value="">Sélectionner un centre d'enseignement</option>
          <option>Batiment Travaux Public</option>
          <option>Informatique</option>
          <option>Prévention des Risques, QSE</option>
          <option>Industrie, Mécanique</option>
          <option>Santé Action Sociale</option>
          <option>Commerce Marketing</option>
          <option>Ressources Humaines</option>
          <option>Entrepreunariat Management Innovation</option>
          <option>Logistique Transport</option>
          <option>Gestion Comptabilite Finance</option>
          <option>Droit ICH</option>
        </select>
      </div>

      <div>
        <label>Centre d'attachement : </label>
        <select
          onChange={(e) => setNomCentreAttachement(e.target.value)}
          value={nomCentreAttachement}
          className="export-select"
        >
          <option value="">Sélectionner un centre d'attachement</option>
          <option>Amiens</option>
          <option>Lille</option>
          <option>Valenciennes</option>
        </select>
      </div>      
      
      <button
        onClick={handleExtract}
        disabled={loading || !selectedGroupe}
        className="export-button"
      >
        {loading ? "Extraction en cours..." : "Extraire"}
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
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>

      <button
        onClick={handleExport}
        disabled={csvPreview.length === 0}
        className="export-button"
      >
        {loading ? "Export en cours..." : "Exporter en CSV"}
      </button>
    </div>
  );
}
