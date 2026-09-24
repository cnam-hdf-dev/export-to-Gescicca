import { useState, useEffect, useRef, useMemo } from "react";
import "./ExportApprenants.css";
import Papa from "papaparse";
import { validerLigne } from "../gesciccaValidation";
import { genererClasseurErreurs } from "../exportErreursExcel";
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

// Plan de formation d'un groupe (matières triées par abrégé pour l'affichage).
const matieresTriees = (g) =>
  [...(g.matieres || [])].sort((a, b) =>
    (a.abregeMatiere || "").localeCompare(b.abregeMatiere || "")
  );

// Parse une date Yparéo au format JJ/MM/AAAA.
const parseDateFr = (s) => {
  const [jj, mm, aaaa] = String(s ?? "").split("/").map(Number);
  if (!jj || !mm || !aaaa) return null;
  return new Date(aaaa, mm - 1, jj);
};

// Détermine la période scolaire courante : celle qui englobe aujourd'hui,
// ou à défaut la plus récente déjà commencée.
const periodeCourante = (listePeriodes) => {
  const maintenant = new Date();
  const dansLIntervalle = listePeriodes.find((p) => {
    const debut = parseDateFr(p.dateDeb);
    const fin = parseDateFr(p.dateFin);
    return debut && fin && debut <= maintenant && maintenant <= fin;
  });
  if (dansLIntervalle) return dansLIntervalle.codePeriode.toString();

  const dejaCommencees = listePeriodes
    .filter((p) => {
      const debut = parseDateFr(p.dateDeb);
      return debut && debut <= maintenant;
    })
    .sort((a, b) => parseDateFr(b.dateDeb) - parseDateFr(a.dateDeb));
  if (dejaCommencees[0]) return dejaCommencees[0].codePeriode.toString();

  return listePeriodes[0] ? listePeriodes[0].codePeriode.toString() : "";
};

export default function ExportApprenants() {
  const [periodes, setPeriodes] = useState([]);
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [groupes, setGroupes] = useState([]);
  const [groupesCharges, setGroupesCharges] = useState(false);
  // Codes (string) des groupes sélectionnés, dans l'ordre de sélection.
  const [groupesSelectionnes, setGroupesSelectionnes] = useState([]);
  // Nom exact de la formation dans Gescicca, par code de groupe.
  const [nomsFormation, setNomsFormation] = useState({});
  const [annee, setAnnee] = useState(ANNEE_DEFAUT);
  const [nomCentreEnseignement, setNomCentreEnseignement] = useState(CENTRE_ENSEIGNEMENT_DEFAUT);
  const [nomCentreAttachement, setNomCentreAttachement] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  // Fragment de nom de fichier (« groupe_X » ou « N_groupes ») fixé à l'extraction.
  const [libelleExport, setLibelleExport] = useState("");
  // Groupes dont l'extraction a échoué (libellés), signalés sous le bouton Extraire.
  const [groupesEnEchec, setGroupesEnEchec] = useState([]);
  // Vrai quand l'extraction a abouti mais sans aucun apprenant à afficher.
  const [aucunApprenant, setAucunApprenant] = useState(false);
  // Indices (dans csvPreview.slice(1)) des lignes qui ouvrent un nouveau groupe.
  const [debutsGroupe, setDebutsGroupe] = useState(() => new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [exportErreursEnCours, setExportErreursEnCours] = useState(false);
  // Indices (0-based dans csvPreview.slice(1)) des lignes cochées pour l'export.
  const [lignesSelectionnees, setLignesSelectionnees] = useState(() => new Set());

  // Combobox de recherche du groupe.
  const [rechercheGroupe, setRechercheGroupe] = useState("");
  const [groupeOuvert, setGroupeOuvert] = useState(false);
  const [indexActifGroupe, setIndexActifGroupe] = useState(0);
  const comboboxGroupeRef = useRef(null);

  // Infos formation par codeFormation (purement informatif, hors CSV) :
  // { statut: "chargement" | "ok" | "erreur", abregeFormation }.
  const [formationsInfo, setFormationsInfo] = useState({});
  const formationsDemandeesRef = useRef(new Set());

  // Tables de correspondance Yparéo -> Gescicca, chargées une fois au montage.
  const referencesRef = useRef({ communes: {}, nationalites: {}, pays: {} });
  const [referencesChargees, setReferencesChargees] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [periodesData, communes, nationalites, pays] = await Promise.all([
          fetch(`/api/r/v1/periodes`, {
            headers: { "X-Auth-Token": token },
          }).then((res) => res.json()),
          loadReferenceCsv("/ref/liste_communes.csv", "CODE_COMMUNE", "NOMENCL_INSEE"),
          loadReferenceCsv("/ref/liste_nationalites.csv", "CODE_NATIONALITE", "ID_BASE_EXTERNE"),
          loadReferenceCsv("/ref/liste_pays.csv", "CODE_PAYS", "ID_BASE_EXTERNE"),
        ]);

        const listePeriodes = Object.values(periodesData).sort(
          (a, b) => parseDateFr(b.dateDeb) - parseDateFr(a.dateDeb)
        );
        setPeriodes(listePeriodes);
        setSelectedPeriode(periodeCourante(listePeriodes));

        referencesRef.current = { communes, nationalites, pays };
        setReferencesChargees(true);
      } catch (err) {
        console.error("Erreur lors du chargement initial :", err);
      }
    };

    fetchData();
  }, []);

  // Recharge les groupes de formation longue à chaque changement de période.
  useEffect(() => {
    if (!selectedPeriode) return;
    const fetchGroupes = async () => {
      setGroupesCharges(false);
      try {
        const res = await fetch(
          `/api/r/v1/formation-longue/groupes?codesPeriode=${selectedPeriode}`,
          { headers: { "X-Auth-Token": token } }
        );
        const data = await res.json();
        const liste = Object.values(data).sort((a, b) =>
          (a.nomGroupe || "").localeCompare(b.nomGroupe || "")
        );
        setGroupes(liste);
      } catch (err) {
        console.error("Erreur lors du chargement des groupes :", err);
      } finally {
        setGroupesCharges(true);
      }
    };
    fetchGroupes();
  }, [selectedPeriode]);

  const handleChangerPeriode = (e) => {
    setSelectedPeriode(e.target.value);
    setGroupesSelectionnes([]);
    setRechercheGroupe("");
    setGroupeOuvert(false);
    setCsvPreview([]);
    setGroupesEnEchec([]);
    setAucunApprenant(false);
    setLignesSelectionnees(new Set());
  };

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

  // Groupes sélectionnés (objets wrGroupe), dans l'ordre de sélection.
  const groupesSelectionnesObjets = groupesSelectionnes
    .map((code) => groupes.find((g) => g.codeGroupe.toString() === code))
    .filter(Boolean);

  // Récupère l'abrégé de formation (code diplôme Gescicca) de chaque groupe
  // sélectionné, absent de wrGroupe : un appel dédié à /formations par
  // codeFormation, une seule fois (cache par code).
  useEffect(() => {
    groupesSelectionnes.forEach((code) => {
      const groupe = groupes.find((g) => g.codeGroupe.toString() === code);
      if (!groupe) return;
      const codeFormation = groupe.codeFormation;
      if (formationsDemandeesRef.current.has(codeFormation)) return;
      formationsDemandeesRef.current.add(codeFormation);
      setFormationsInfo((prev) => ({ ...prev, [codeFormation]: { statut: "chargement" } }));
      fetch(`/api/r/v1/formations/${codeFormation}`, {
        headers: { "X-Auth-Token": token },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setFormationsInfo((prev) => ({
            ...prev,
            [codeFormation]: { statut: "ok", abregeFormation: data.abregeFormation },
          }));
        })
        .catch((err) => {
          console.error("Erreur lors du chargement de la formation :", err);
          setFormationsInfo((prev) => ({ ...prev, [codeFormation]: { statut: "erreur" } }));
        });
    });
  }, [groupesSelectionnes, groupes]);

  const groupesFiltres = groupes.filter((g) =>
    sansAccents(libelleGroupe(g)).includes(sansAccents(rechercheGroupe))
  );
  const estSelectionne = (g) => groupesSelectionnes.includes(g.codeGroupe.toString());
  const tousFiltresSelectionnes =
    groupesFiltres.length > 0 && groupesFiltres.every(estSelectionne);

  const basculerGroupe = (g) => {
    const code = g.codeGroupe.toString();
    setGroupesSelectionnes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const retirerGroupe = (code) => {
    setGroupesSelectionnes((prev) => prev.filter((c) => c !== code));
  };

  // Ajoute (ou retire, si tous déjà cochés) l'ensemble des résultats filtrés.
  const basculerTousFiltres = () => {
    const codes = groupesFiltres.map((g) => g.codeGroupe.toString());
    setGroupesSelectionnes((prev) =>
      tousFiltresSelectionnes
        ? prev.filter((c) => !codes.includes(c))
        : [...prev, ...codes.filter((c) => !prev.includes(c))]
    );
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
        basculerGroupe(groupesFiltres[indexActifGroupe]);
      }
    } else if (e.key === "Escape") {
      setGroupeOuvert(false);
    }
  };

  // Validation des lignes de l'aperçu (recalculée à chaque édition de cellule).
  const erreursParLigne = useMemo(() => {
    if (csvPreview.length <= 1) return [];
    const entetes = csvPreview[0];
    return csvPreview.slice(1).map((row) => {
      const ligne = {};
      entetes.forEach((col, j) => {
        ligne[col] = row[j];
      });
      return validerLigne(ligne);
    });
  }, [csvPreview]);

  const nbLignes = Math.max(csvPreview.length - 1, 0);
  const ligneEstFautive = (i) =>
    erreursParLigne[i] && Object.keys(erreursParLigne[i]).length > 0;
  // Lignes sélectionnables : une ligne fautive ne peut pas être cochée
  // (case désactivée, cf. rendu) tant que ses cellules en rouge ne sont
  // pas corrigées.
  const indicesSelectionnables = Array.from({ length: nbLignes }, (_, i) => i).filter(
    (i) => !ligneEstFautive(i)
  );
  const toutSelectionne =
    indicesSelectionnables.length > 0 &&
    indicesSelectionnables.every((i) => lignesSelectionnees.has(i));
  const selectionPartielle =
    lignesSelectionnees.size > 0 && !toutSelectionne;
  const selectionContientErreur = [...lignesSelectionnees].some(ligneEstFautive);
  const nbLignesFautives = erreursParLigne.filter((_, i) => ligneEstFautive(i)).length;

  const basculerLigne = (i) => {
    if (ligneEstFautive(i)) return;
    setLignesSelectionnees((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(i)) suivant.delete(i);
      else suivant.add(i);
      return suivant;
    });
  };

  const basculerToutes = () => {
    setLignesSelectionnees(
      toutSelectionne ? new Set() : new Set(indicesSelectionnables)
    );
  };

  const handleExtract = async () => {
    if (groupesSelectionnesObjets.length === 0) return;
    setLoading(true);
    setGroupesEnEchec([]);
    setAucunApprenant(false);
    try {
      // Un appel par groupe, en parallèle ; l'échec d'un groupe n'empêche pas
      // l'affichage des autres.
      const resultats = await Promise.allSettled(
        groupesSelectionnesObjets.map(async (g) => {
          const res = await fetch(`/api/r/v1/groupes/${g.codeGroupe}/apprenants`, {
            headers: { "X-Auth-Token": token },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return Object.values(await res.json());
        })
      );

      // Lignes source, regroupées par groupe (ordre de sélection).
      const lignesSource = [];
      const groupesReussis = [];
      const echecs = [];
      resultats.forEach((resultat, k) => {
        const g = groupesSelectionnesObjets[k];
        if (resultat.status === "rejected") {
          console.error(`Erreur extraction du groupe ${libelleGroupe(g)} :`, resultat.reason);
          echecs.push(libelleGroupe(g));
          return;
        }
        groupesReussis.push(g);
        const nomGroupe = g.nomGroupe || "";
        const nomFormation = nomsFormation[g.codeGroupe.toString()] || "";
        resultat.value.forEach((d) =>
          lignesSource.push({ d, nomGroupe, nomFormation, codeGroupe: g.codeGroupe })
        );
      });
      const codesGroupeLignes = [];

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

      lignesSource.forEach(({ d, nomGroupe, nomFormation, codeGroupe }) => {
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
        codesGroupeLignes.push(codeGroupe);
      });

      const debuts = new Set();
      codesGroupeLignes.forEach((code, i) => {
        if (i > 0 && code !== codesGroupeLignes[i - 1]) debuts.add(i);
      });

      setCsvPreview(csvRows);
      setDebutsGroupe(debuts);
      setGroupesEnEchec(echecs);
      setAucunApprenant(csvRows.length === 1 && groupesReussis.length > 0);
      setLibelleExport(
        groupesReussis.length === 1
          ? `groupe_${sanitizeNomFichier(groupesReussis[0].nomGroupe || groupesReussis[0].codeGroupe)}`
          : `${groupesReussis.length}_groupes`
      );
      setLignesSelectionnees(new Set());
    } catch (err) {
      console.error("Erreur export:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const lignesAExporter = [
      csvPreview[0],
      ...csvPreview.slice(1).filter((_, i) => lignesSelectionnees.has(i)),
    ];
    const blob = new Blob(["\ufeff" + lignesAExporter.map(r => r.map(protegerSeparateur).join(SEPARATEUR)).join("\n")], { type: "text/csv;charset=cp1252;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `import_Gescicca_${libelleExport}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exporte toutes les lignes fautives (indépendamment de la sélection) en
  // .xlsx, cellules en erreur colorées + colonne « Erreurs ».
  const handleExportErreurs = async () => {
    setExportErreursEnCours(true);
    try {
      const buffer = await genererClasseurErreurs(
        csvPreview[0],
        csvPreview.slice(1),
        erreursParLigne
      );
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `erreurs_Gescicca_${libelleExport}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur export Excel des erreurs :", err);
    } finally {
      setExportErreursEnCours(false);
    }
  };

  return (
    <div className="export-container">
      <h2 className="export-title">
        Exporter les apprenants de groupes de formation
      </h2>

      <section className="export-card">
        <h3 className="export-card-titre">Sélection</h3>
        <div className="champ-grid">
          <div className="champ">
            <label>Année scolaire</label>
            <select
              onChange={handleChangerPeriode}
              value={selectedPeriode}
              className="export-select"
            >
              {periodes.map((p) => (
                <option key={p.codePeriode} value={p.codePeriode.toString()}>
                  {p.nomPeriode}
                </option>
              ))}
            </select>
          </div>

          <div className="champ groupe-combobox" ref={comboboxGroupeRef}>
            <label>Groupes de formation</label>
            <input
              type="text"
              className="export-select"
              placeholder="Rechercher un ou plusieurs groupes…"
              value={rechercheGroupe}
              role="combobox"
              aria-expanded={groupeOuvert}
              aria-controls="groupe-combobox-liste"
              aria-autocomplete="list"
              onChange={(e) => {
                setRechercheGroupe(e.target.value);
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
              <div className="groupe-combobox-panneau">
                {rechercheGroupe.trim() !== "" && groupesFiltres.length > 0 && (
                  <button
                    type="button"
                    className="groupe-combobox-action"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      basculerTousFiltres();
                    }}
                  >
                    {tousFiltresSelectionnes
                      ? `Désélectionner les ${groupesFiltres.length} résultats`
                      : `Sélectionner les ${groupesFiltres.length} résultats`}
                  </button>
                )}
                <ul
                  id="groupe-combobox-liste"
                  className="groupe-combobox-liste"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  {groupesFiltres.length === 0 ? (
                    <li className="groupe-combobox-vide">Aucun groupe</li>
                  ) : (
                    groupesFiltres.map((g, i) => (
                      <li
                        key={g.codeGroupe}
                        role="option"
                        aria-selected={estSelectionne(g)}
                        className={
                          "groupe-combobox-option" +
                          (i === indexActifGroupe ? " actif" : "")
                        }
                        onMouseDown={(e) => {
                          e.preventDefault();
                          basculerGroupe(g);
                        }}
                        onMouseEnter={() => setIndexActifGroupe(i)}
                      >
                        <span
                          className={
                            "groupe-case" + (estSelectionne(g) ? " groupe-case-cochee" : "")
                          }
                          aria-hidden="true"
                        >
                          {estSelectionne(g) ? "✓" : ""}
                        </span>
                        {libelleGroupe(g)}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {groupesSelectionnesObjets.length > 0 && (
          <div className="groupes-selectionnes">
            {groupesSelectionnesObjets.length > 1 && (
              <button
                type="button"
                className="lien-bouton"
                onClick={() => setGroupesSelectionnes([])}
              >
                Tout retirer ({groupesSelectionnesObjets.length} groupes)
              </button>
            )}
            {groupesSelectionnesObjets.map((g) => {
              const code = g.codeGroupe.toString();
              const info = formationsInfo[g.codeFormation];
              return (
                <div className="groupe-carte" key={code}>
                  <div className="groupe-carte-entete">
                    <span>{libelleGroupe(g)}</span>
                    <button
                      type="button"
                      className="groupe-carte-retirer"
                      onClick={() => retirerGroupe(code)}
                      aria-label={`Retirer le groupe ${libelleGroupe(g)}`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="formation-info">
                    <p>
                      <span className="formation-info-label">Diplôme</span>
                      <span className="formation-info-valeur">
                        {!info || info.statut === "chargement"
                          ? "Chargement…"
                          : info.statut === "erreur"
                          ? "Indisponible"
                          : info.abregeFormation || "Non renseigné"}
                      </span>
                    </p>
                    <p className="formation-info-label formation-info-sous-titre">
                      Plan de formation du groupe
                    </p>
                    <div className="matieres-liste">
                      {matieresTriees(g).length > 0 ? (
                        matieresTriees(g).map((m) => (
                          <span
                            key={m.codeMatiere}
                            className={
                              "matiere-pastille" +
                              (m.nePlusUtiliser ? " matiere-pastille-desactivee" : "")
                            }
                            title={m.nePlusUtiliser ? "Matière ne plus utiliser" : undefined}
                          >
                            {m.abregeMatiere}
                          </span>
                        ))
                      ) : (
                        <span className="formation-info-valeur">Aucune matière</span>
                      )}
                    </div>
                  </div>

                  <div className="champ">
                    <label>Nom exact de la formation dans Gescicca</label>
                    <input
                      type="text"
                      value={nomsFormation[code] || ""}
                      onChange={(e) =>
                        setNomsFormation((prev) => ({ ...prev, [code]: e.target.value }))
                      }
                      className="export-input"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="export-card">
        <h3 className="export-card-titre">Paramètres d'export</h3>
        <div className="champ-grid">
          <div className="champ">
            <label>Année universitaire</label>
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

          <div className="champ">
            <label>Centre d'enseignement</label>
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

          <div className="champ">
            <label>Centre d'attachement</label>
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
        </div>
      </section>

      <div className="barre-actions">
        <button
          onClick={handleExtract}
          disabled={
            loading ||
            groupesSelectionnes.length === 0 ||
            !referencesChargees ||
            !groupesCharges
          }
          className="export-button"
        >
          {loading
            ? "Extraction en cours..."
            : referencesChargees && groupesCharges
            ? groupesSelectionnes.length > 1
              ? `Extraire ${groupesSelectionnes.length} groupes`
              : "Extraire"
            : "Chargement des référentiels..."}
        </button>
      </div>

      {groupesEnEchec.length > 0 && (
        <div className="export-alerte" role="alert">
          <strong>
            Extraction impossible pour {groupesEnEchec.length} groupe(s) :
          </strong>
          <ul>
            {groupesEnEchec.map((nom) => (
              <li key={nom}>{nom}</li>
            ))}
          </ul>
          {csvPreview.length > 1 && <p>Les autres groupes sont affichés ci-dessous.</p>}
        </div>
      )}

      {aucunApprenant && (
        <p className="export-info">Aucun apprenant dans le ou les groupes sélectionnés.</p>
      )}

      {csvPreview.length > 1 && (
        <section className="export-card apercu-card">
        <table className="preview-table">
          <thead>
            <tr>
              <th className="col-selection">
                <input
                  type="checkbox"
                  checked={toutSelectionne}
                  disabled={indicesSelectionnables.length === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = selectionPartielle;
                  }}
                  onChange={basculerToutes}
                  aria-label="Tout sélectionner"
                />
              </th>
              {csvPreview[0].map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvPreview.slice(1).map((row, i) => (
              <tr
                key={i}
                className={
                  [
                    lignesSelectionnees.has(i) ? "ligne-selectionnee" : "",
                    debutsGroupe.has(i) ? "debut-groupe" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              >
                <td className="col-selection">
                  <input
                    type="checkbox"
                    checked={lignesSelectionnees.has(i)}
                    disabled={ligneEstFautive(i)}
                    onChange={() => basculerLigne(i)}
                    aria-label={`Sélectionner la ligne ${i + 1}`}
                    title={
                      ligneEstFautive(i)
                        ? "Corrigez les cellules en rouge avant de sélectionner cette ligne"
                        : undefined
                    }
                  />
                </td>
                {row.map((cell, j) => {
                const erreur = erreursParLigne[i]?.[csvPreview[0][j]];
                return (
                <td
                  key={j}
                  className={erreur ? "cellule-fautive" : undefined}
                  title={erreur || undefined}
                  onDoubleClick={() => setEditingCell({ row: i, col: j })}
                >
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
                );
                })}
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={csvPreview[0].length + 1}>
                {lignesSelectionnees.size} sélectionnée(s) / {nbLignes} apprenant(s)
              </td>
            </tr>
          </tbody>
        </table>
        </section>
      )}

      {csvPreview.length > 1 && (
        <div className="barre-actions barre-actions-fin">
          {lignesSelectionnees.size === 0 && (
            <p className="export-erreur">
              Sélectionnez au moins une ligne à exporter.
            </p>
          )}
          {selectionContientErreur && (
            <p className="export-erreur">
              Une ligne sélectionnée contient des cellules à corriger (en rouge).
            </p>
          )}
          <div className="barre-actions-boutons">
            <button
              onClick={handleExportErreurs}
              disabled={nbLignesFautives === 0 || exportErreursEnCours}
              className="export-button export-button-secondaire"
            >
              {exportErreursEnCours
                ? "Génération..."
                : "Export Excel des erreurs"}
            </button>
            <button
              onClick={handleExport}
              disabled={lignesSelectionnees.size === 0 || selectionContientErreur}
              className="export-button"
            >
              {loading ? "Export en cours..." : "Exporter en CSV"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
