import { useState, useEffect } from "react";
import "./ExportApprenants.css";

const token = process.env.REACT_APP_API_TOKEN;

export default function ExportApprenants() {
  const [groupes, setGroupes] = useState([]);
  const [selectedGroupe, setSelectedGroupe] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/r/v1/formation-longue/groupes`, {
      headers: {
        "X-Auth-Token": token,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const liste = Object.values(data);
        setGroupes(liste);
      })
      .catch((err) => console.error("Erreur chargement groupes:", err));
  }, []);

  const handleExport = async () => {
    const groupeInfo = groupes.find(g => g.codeGroupe.toString() === selectedGroupe);
    const nomGroupe = groupeInfo?.nomGroupe || '';
    let nomFormation = '';
    if (groupeInfo?.codeFormation) {
      try {
        const formationRes = await fetch(`/api/r/v1/formations/${groupeInfo.codeFormation}`, {
          headers: {
            "X-Auth-Token": token,
          },
        });
        const formationData = await formationRes.json();
        nomFormation = formationData.nomFormation || groupeInfo.codeFormation;
      } catch (e) {
        console.error("Erreur récupération nom de formation:", e);
        nomFormation = groupeInfo.codeFormation;
      }
    }
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
          "civilite", "nationalite", "nom", "prenom", "date_naissance",
          "pays_naissance", "lieu_naissance", "code_commune_naissance",
          "adresse_1", "code_postal", "ville", "pays",
          "telephone_1", "telephone_2", "email",
          "nom_formation", "nom_groupe"
        ].join(";")
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
        csvRows.push([
          d.codeCivilite,
          d.codeNationalite,
          d.nomApprenant,
          d.prenomApprenant,
          d.dateNaissance,
          d.codePaysNaissance,
          d.lieuNaissance,
          d.codeCommuneNaissance,
          d.adresse?.adr1,
          d.adresse?.cp,
          d.adresse?.ville,
          d.adresse?.pays?.nomPays,
          d.adresse?.tel1,
          d.adresse?.tel2,
          d.adresse?.email,
          nomFormation,
          nomGroupe
        ].map(v => `"${v !== undefined && v !== null ? v : ""}"`).join(";"));
      });

      const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `apprenants_groupe_${selectedGroupe}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur export:", err);
    } finally {
      setLoading(false);
    }
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

      <button
        onClick={handleExport}
        disabled={loading || !selectedGroupe}
        className="export-button"
      >
        {loading ? "Export en cours..." : "Exporter en CSV"}
      </button>
    </div>
  );
}
