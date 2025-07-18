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

  const nationaliteMap = {
    "France": 0,
    "Acores-Madère": 319,
    "Afghanistan": 212,
    "Afrique du Sud": 303,
    "Albanie": 125,
    "Algérie": 352,
    "Allemagne": 109,
    "Andorre": 130,
    "Angola": 395,
    "Antigua-et-Barbuda": 441,
    "Arabie Saoudite": 201,
    "Argentine": 415,
    "Arménie": 252,
    "Australie": 501,
    "Autriche": 110,
    "Azerbaïdjan": 253,
    "Bahamas": 436,
    "Bahreïn": 249,
    "Bangladesh": 246,
    "Barbade": 434,
    "Belgique": 131,
    "Belize": 429,
    "Bénin": 327,
    "Bhoutan": 214,
    "Biélorussie": 148,
    "Birmanie": 224,
    "Bolivie": 418,
    "Bosnie-Herzégovine": 118,
    "Botswana": 347,
    "Brésil": 416,
    "Brunei": 225,
    "Bulgarie": 111,
    "Burkina": 331,
    "Burundi": 321,
    "Cambodge": 234,
    "Cameroun": 322,
    "Canada": 401,
    "Cap-Vert": 396,
    "Chili": 417,
    "Chine": 216,
    "Chypre": 254,
    "Colombie": 419,
    "Comores": 397,
    "Congo": 324,
    "Congo (République Démocratique)": 312,
    "Corée du Nord": 238,
    "Corée du Sud": 239,
    "Costa Rica": 406,
    "Côte-d'Ivoire": 326,
    "Croatie": 119,
    "Cuba": 407,
    "Danemark": 101,
    "Djibouti": 399,
    "Dominicaine (Rep. ou St-Domingue)": 408,
    "Dominique (île de la)": 438,
    "Egypte": 301,
    "El Salvador": 414,
    "Emirats Arabes Unis": 247,
    "Equateur": 420,
    "Erythrée": 317,
    "Espagne": 134,
    "Estonie": 106,
    "Eswatini": 391,
    "Etats-Unis d'Amérique": 404,
    "Ethiopie": 315,
    "Fidji": 508,
    "Finlande": 105,
    "Gabon": 328,
    "Gambie": 304,
    "Géorgie": 255,
    "Ghana": 329,
    "Gibraltar": 133,
    "Grèce": 126,
    "Grenade": 435,
    "Guatemala": 409,
    "Guinée": 330,
    "Guinée Equatoriale": 314,
    "Guinée-Bissau": 392,
    "Guyana": 428,
    "Haïti": 410,
    "Honduras": 411,
    "Hongkong": 230,
    "Hongrie": 112,
    "Inde": 223,
    "Indonésie": 231,
    "Irak": 203,
    "Iran": 204,
    "Irlande": 136,
    "Islande": 102,
    "Israël": 207,
    "Italie": 127,
    "Jamaïque": 426,
    "Japon": 217,
    "Jordanie": 222,
    "Kazakhstan": 256,
    "Kenya": 332,
    "Kirghizistan": 257,
    "Kiribati": 513,
    "Kosovo": 157,
    "Koweït": 240,
    "Laos": 241,
    "Lesotho": 348,
    "Lettonie": 107,
    "Liban": 205,
    "Libéria": 302,
    "Libye": 316,
    "Liechtenstein": 113,
    "Lituanie": 108,
    "Luxembourg": 137,
    "Macao": 232,
    "Macédoine": 156,
    "Madagascar": 333,
    "Malaisie": 227,
    "Malawi": 334,
    "Maldives": 229,
    "Mali": 335,
    "Malte": 144,
    "Maroc": 350,
    "Marshall (îles)": 515,
    "Maurice": 390,
    "Mauritanie": 336,
    "Mexique": 405,
    "Micronésie": 516,
    "Moldavie": 151,
    "Monaco": 138,
    "Mongolie": 242,
    "Monténégro": 120,
    "Mozambique": 393,
    "Namibie": 311,
    "Nauru": 507,
    "Népal": 215,
    "Nicaragua": 412,
    "Niger": 337,
    "Nigeria": 338,
    "Non mentionnée": 990,
    "Norvège": 103,
    "Nouvelle-Zélande": 502,
    "Oman": 250,
    "Ouganda": 339,
    "Ouzbékistan": 258,
    "Pakistan": 213,
    "Palaos (Iles)": 517,
    "Palestine (Etat de)": 261,
    "Panama": 413,
    "Papouasie Nouvelle Guinée": 510,
    "Paraguay": 421,
    "Pays-Bas": 135,
    "Pérou": 422,
    "Philippines": 220,
    "Pologne": 122,
    "Portugal": 139,
    "Qatar": 248,
    "République Centrafricaine": 323,
    "République Tchèque": 116,
    "Roumanie": 114,
    "Royaume-Uni": 132,
    "Russie": 123,
    "Rwanda": 340,
    "Sahara Occidental": 389,
    "Saint-Christophe-et-Niévès": 442,
    "Sainte-Hélène": 306,
    "Sainte-Lucie (île)": 439,
    "Saint-Martin": 128,
    "Saint-Vincent (île)": 440,
    "Salomon": 512,
    "Samoa Occidentales": 506,
    "Sans nationalité": 995,
    "Sao tome-et-Principe": 394,
    "Sénégal": 341,
    "Serbie": 121,
    "Seychelles": 398,
    "Sierra Leone": 342,
    "Singapour": 226,
    "Slovaquie": 117,
    "Slovénie": 145,
    "Somalie": 318,
    "Soudan": 343,
    "Soudan du Sud": 349,
    "Sri Lanka": 235,
    "Suède": 104,
    "Suisse": 140,
    "Suriname": 437,
    "Syrie": 206,
    "Tadjikistan": 259,
    "Taiwan": 236,
    "Tanzanie": 309,
    "Tchad": 344,
    "Thaïlande": 219,
    "Timor Oriental": 262,
    "Togo": 345,
    "Tonga ou Friendly": 509,
    "Trinité-et-Tobago": 433,
    "Tunisie": 351,
    "Turkménistan": 260,
    "Turquie": 208,
    "Tuvalu": 511,
    "Ukraine": 155,
    "Uruguay": 423,
    "Vanuatu": 514,
    "Vatican": 129,
    "Venezuela": 424,
    "Vietnam": 243,
    "Yémen": 251,
    "Zambie": 346,
    "Zimbabwe": 310
  };

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
          "TITRE",
          "INDEMNISATION",
          "EXPERIENCE",
          "CODE_NATIONALITE",
          "SITUATION_FAMILIALE",
          "PROFESSION_INSEE",
          "ANCIEN_CODE_AUDITEUR",
          "NUMERO_SECURITE_SOCIALE",
          "INE",
          "INE_CNAM",
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
          "TELEPHONE_PROFESSIONNEL",
          "NUMERO_POSTE",
          "COURRIEL_PERSONNEL",
          "PROFESSION",
          "FONCTION",
          "DATE_CESSATION_ACTIVITE",
          "MEMO",
          "COURRIEL_PROFESSIONNEL",
          "ADRESSE_SECONDAIRE_1",
          "ADRESSE_SECONDAIRE_2",
          "CODE_POSTAL_SECONDAIRE",
          "VILLE_SECONDAIRE",
          "PAYS_SECONDAIRE",
          "COMPTE_AUXILLIAIRE",
          "RAISON_SOCIALE_ENTREPRISE",
          "SIRET_ENTREPRISE",
          "IDENTIFIANT_ENTREPRISE",
          "ANNEE",
          "CENTRE_ENSEIGNEMENT",
          "CENTRE_ATTACHEMENT",
          "STATUT_AUDITEUR",
          "CENTRE_REGIONAL_INSCRIPTEUR",
          "DIPLOME",
          "SITUATION_GEOGRAPHIQUE",
          "DISPOSITIF_FINANCEMENT",
          "TYPE_FINANCEMENT_INSCRIPTION",
          "TYPE_TARIF_INSCRIPTION",
          "SITUATION_PROFESSIONNELLE",
          "STATUT_EMPLOI",
          "INSCRIT_POLE_EMPLOI",
          "COMPTE_ANALYTIQUE",
          "FORMATION",
          "ANNEE_FORMATION",
          "OPTION_FORMATION",
          "GROUPE_FORMATION",
          "STATUT_INSCRIPTION",
          "TYPE_INSCRIPTION",
          "CODE_UNITE",
          "GROUPE_UNITE",
          "SEMESTRE_UNITE",
          "TYPE_FINANCEMENT_UNITE",
          "TYPE_TARIF_UNITE",
          "CENTRE_REGIONAL_ORGANISATEUR",
          "NOTE_SESSION_1",
          "NOTE_SESSION_2",
          "DATE_INSCRIPTION"
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
          d.codeCivilite, // TITRE
          '',// INDEMNISATION
          '',// EXPERIENCE
          d.codeNationalite, // CODE_NATIONALITE
          '',// SITUATION_FAMILIALE
          '',// PROFESSION_INSEE
          '',// ANCIEN_CODE_AUDITEUR
          '',// NUMERO_SECURITE_SOCIALE
          '',// INE
          '',// INE_CNAM
          d.nomApprenant, // NOM
          d.prenomApprenant, // PRENOM
          d.nomJeuneFille || '',// NOM_USAGE
          d.dateNaissance, // DATE_NAISSANCE
          d.codePaysNaissance, // PAYS_NAISSANCE
          d.lieuNaissance, // LIEU_NAISSANCE
          d.adresse?.adr1, // ADRESSE_1
          d.adresse?.adr2 || '', // ADRESSE_2
          d.adresse?.cp, // CODE_POSTAL
          d.adresse?.ville, // VILLE
          d.adresse?.pays?.nomPays, // PAYS
          d.adresse?.tel1, // TELEPHONE_PERSONNEL
          d.adresse?.tel2, // TELEPHONE_PORTABLE
          '',// TELEPHONE_PROFESSIONNEL
          '',// NUMERO_POSTE
          d.adresse?.email, // COURRIEL_PERSONNEL
          '',// PROFESSION
          '',// FONCTION
          '',// DATE_CESSATION_ACTIVITE
          '',// MEMO
          '',// COURRIEL_PROFESSIONNEL
          '',// ADRESSE_SECONDAIRE_1
          '',// ADRESSE_SECONDAIRE_2
          '',// CODE_POSTAL_SECONDAIRE
          '',// VILLE_SECONDAIRE
          '',// PAYS_SECONDAIRE
          '',// COMPTE_AUXILLIAIRE
          '',// RAISON_SOCIALE_ENTREPRISE
          '',// SIRET_ENTREPRISE
          '',// IDENTIFIANT_ENTREPRISE
          '',// ANNEE
          '',// CENTRE_ENSEIGNEMENT
          '',// CENTRE_ATTACHEMENT
          '',// STATUT_AUDITEUR
          '',// CENTRE_REGIONAL_INSCRIPTEUR
          '',// DIPLOME
          '',// SITUATION_GEOGRAPHIQUE
          '',// DISPOSITIF_FINANCEMENT
          '',// TYPE_FINANCEMENT_INSCRIPTION
          '',// TYPE_TARIF_INSCRIPTION
          '',// SITUATION_PROFESSIONNELLE
          '',// STATUT_EMPLOI
          '',// INSCRIT_POLE_EMPLOI
          '',// COMPTE_ANALYTIQUE
          nomFormation, // FORMATION
          '',// ANNEE_FORMATION
          '',// OPTION_FORMATION
          nomGroupe, // GROUPE_FORMATION
          '',// STATUT_INSCRIPTION
          '',// TYPE_INSCRIPTION
          '',// CODE_UNITE
          '',// GROUPE_UNITE
          '',// SEMESTRE_UNITE
          '',// TYPE_FINANCEMENT_UNITE
          '',// TYPE_TARIF_UNITE
          '',// CENTRE_REGIONAL_ORGANISATEUR
          '',// NOTE_SESSION_1
          '',// NOTE_SESSION_2
          '',// DATE_INSCRIPTION
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
