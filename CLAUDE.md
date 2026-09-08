# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vue d'ensemble

Outil web interne (mono-page React, sans backend propre) qui fait le **pont entre Yparéo et Gescicca** :

- **Source** : API REST Yparéo / Ymag (instance `lecnam.ymag.cloud`), logiciel de gestion du centre de formation (CNAM Hauts-de-France).
- **Cible** : **Gescicca** (gestion de scolarité CNAM), qui s'alimente par **import d'un fichier CSV**.

Le flux : l'utilisateur choisit un groupe de formation longue → l'app extrait les apprenants depuis Yparéo → les transforme au format d'import Gescicca → affiche un aperçu éditable → génère le CSV.

## Commandes

```bash
npm install        # dépendances (Create React App, non éjecté)
npm start          # serveur de dev sur http://localhost:3000 (avec proxy /api, cf. ci-dessous)
npm run build      # build de production dans build/
npm test           # runner de tests CRA (watch). Test unique : npm test -- ExportApprenants
```

> `src/App.test.js` est encore le test généré par CRA et **échoue** (il cherche un lien « learn react » absent). À remplacer ou supprimer.

## Configuration

`.env.local` (git-ignoré, non versionné) doit contenir :

```
REACT_APP_API_BASE_URL=https://lecnam.ymag.cloud/index.php
REACT_APP_API_TOKEN=<jeton webservice REST Yparéo>
```

- `src/setupProxy.js` proxifie `/api/*` → `REACT_APP_API_BASE_URL` en réécrivant `^/api` (contourne CORS **en dev uniquement**). En production le proxy n'existe pas : à prévoir si déploiement.
- Le token est injecté au build côté client (`process.env.REACT_APP_API_TOKEN`) et se retrouve donc dans le bundle → usage **local / interne strict**, ne pas déployer publiquement en l'état.
- Auth Yparéo : en-tête HTTP `X-Auth-Token`. Deux niveaux de licence côté Yparéo : `Clé basic` (lecture) et `Clé expert` (écriture + certains détails).

## Documentation de référence (dossier `docs/`, git-ignoré)

- `docs/ypareo-rest-api-reference.md` — 207 endpoints + 118 objets de l'API REST Yparéo (généré depuis le PDF éditeur v1.6.4). **À consulter avant toute évolution touchant les appels API.**
- `docs/Gescicc@ - Import des donnees AUDITEUR et INSCRIPTIONS.md` — spec d'import Gescicca v2.4 : liste des colonnes, obligations conditionnelles, et tous les référentiels de codes (statut auditeur, statut d'emploi, dispositifs de financement, types d'inscription, pays/nationalité, etc.).

Ces deux fichiers sont volontairement hors dépôt (dérivés de docs propriétaires). Les recréer localement si absents.

## Architecture

Toute la logique tient dans **un seul composant** : `src/components/ExportApprenants.jsx` (`App.js` ne fait que le monter). ~400 lignes, 3 responsabilités enchaînées.

Les valeurs métier externalisées sont dans **`src/config/gesciccaDefaults.js`** : `DEFAUTS_INSCRIPTION` (valeurs par défaut des colonnes d'inscription encore figées), `ANNEES` / `ANNEE_DEFAUT` (sélecteur d'année universitaire, calculés au chargement), `CENTRES_ENSEIGNEMENT` / `CENTRE_ENSEIGNEMENT_DEFAUT` / `CENTRES_ATTACHEMENT` (listes des sélecteurs), `SEPARATEUR` / `SEPARATEUR_PROTECTION` (sérialisation CSV). C'est le point d'entrée pour ajuster ces valeurs sans toucher au composant.

### 1. Chargement initial (`useEffect`)

- `GET /api/r/v1/formation-longue/groupes` → liste déroulante des groupes (triée par `nomGroupe`).
- Chargement en parallèle (`Promise.all`) des 3 CSV de référence de `public/ref/` via `papaparse`, transformés en dictionnaires stockés dans `referencesRef` (`useRef`, donc préservé au Fast Refresh). `referencesChargees` (state) passe à `true` une fois les 3 chargés ; le bouton « Extraire » reste désactivé tant que non chargé.

| Fichier | Clé | Valeur | Usage |
|---|---|---|---|
| `liste_communes.csv` | `CODE_COMMUNE` | `NOMENCL_INSEE` | code INSEE commune de naissance |
| `liste_nationalites.csv` | `CODE_NATIONALITE` | `ID_BASE_EXTERNE` | code nationalité Gescicca |
| `liste_pays.csv` | `CODE_PAYS` | `ID_BASE_EXTERNE` | code pays de naissance Gescicca |

### 2. Extraction + transformation (`handleExtract`)

- `GET /api/r/v1/groupes/{codeGroupe}/apprenants` → `wrApprenant[]` (chaque objet embarque déjà `inscriptions[]`, `informationsCourantes`, `adresse`).
- **Filtre** : ne garde que l'inscription courante active — `informationsCourantes.codeInscription` retrouvé dans `inscriptions[]` et sans `dateDepart`.
- Construit `csvPreview` : tableau de tableaux, `csvPreview[0]` = en-têtes, une ligne par apprenant retenu.
- Le format cible complet (colonnes optionnelles Gescicca) est présent **en commentaires** dans le code — utile comme aide-mémoire mais fragile (cf. plus bas).

Règles de transformation notables :

- **Nom / nom d'usage** : `NOM` = `nomJeuneFille` si présent, sinon `nomApprenant`. `NOM_USAGE` = `nomApprenant` seulement si `nomJeuneFille` existe **et** diffère.
- **Lieu de naissance** : code INSEE via la table `communes` de `referencesRef`, sinon libellé `lieuNaissance`.
- **Codes postaux et INSEE** : `formatCodePostal` = `String(val).padStart(5, "0")` (mal nommé : sert aussi au code INSEE).

### 3. Aperçu éditable + export

- Rendu en `<table>` ; **double-clic sur une cellule** → `<input>` contrôlé qui réécrit directement `csvPreview`. Ligne finale « Total d'apprenants ».
- `handleExport` : sérialisation via `protegerSeparateur` (encadre chaque `;` interne d'une valeur par le caractère de protection Gescicca, cf. `SEPARATEUR_PROTECTION`), BOM `﻿` en tête, `Blob` téléchargé via un `<a download>` créé à la volée. Nom de fichier : `import_Gescicca_groupe_${sanitizeNomFichier(nomGroupeExport)}.csv` (le libellé du groupe est mémorisé dans un state à l'extraction, plus d'index positionnel).

## Points d'attention connus / pistes d'évolution

### Priorité 1 — corrections

- **Incohérence d'encodage** : BOM UTF-8 écrit mais `Blob` typé `charset=cp1252`. À trancher par un test d'import réel.
- **Aucune erreur remontée à l'UI** en cas d'échec `fetch` (seulement `console.error`).

Déjà traité : nom de fichier via index magique `csvPreview[1][23]` (→ `sanitizeNomFichier(nomGroupeExport)`), échappement du séparateur `;` (→ `protegerSeparateur`), race au chargement des référentiels (→ `referencesRef` + `referencesChargees`).

### Priorité 2 — valeurs codées en dur à dériver de la situation contractuelle

Colonnes actuellement figées dans `handleExtract` :

| Colonne | Valeur figée | Devrait dépendre de |
|---|---|---|
| `ANNEE_FORMATION` | `'1'` | `inscription.annee` (Yparéo) |
| `TYPE_FINANCEMENT_INSCRIPTION` | `'C'` | situation contractuelle |
| `STATUT_EMPLOI` | `'7'` (apprenti sous contrat) | type de contrat |
| `STATUT_INSCRIPTION` | `'auditeur alternant'` | type de contrat |
| `TYPE_INSCRIPTION` | `'APP'` | type de contrat |

**Donnée pivot** : `inscriptionEnCours.statut` (`wrStatut`) est **déjà dans le payload** `groupes/{code}/apprenants` — le code le récupère mais ne l'utilise que pour `dateDepart`. Exploiter aussi :

- `inscriptionEnCours.statut.nomStatut` / `.abregeStatut` + les booléens `isFacturableNpec` / `isFacturableContrat` (→ alternance) vs `isFacturableFormation` (→ formation continue).
- `inscriptionEnCours.annee` → `ANNEE_FORMATION`.
- `inscriptionEnCours.codePeriode` / `.situation` → pourrait préremplir le sélecteur `ANNEE` et la situation.
- `isInscriptionEnCours` (`wrInscription`) : repère l'inscription courante plus directement que le calcul actuel.

**Approche recommandée** : externaliser les règles dans un `public/ref/mapping_statuts.csv` (chargé comme les autres réfs), colonnes du type `CODE_STATUT_YPAREO ; NOM_STATUT ; STATUT_INSCRIPTION ; TYPE_INSCRIPTION ; TYPE_FINANCEMENT_INSCRIPTION ; DISPOSITIF_FINANCEMENT ; STATUT_EMPLOI`. Le gestionnaire maintient le fichier, le code ne bouge pas. Valider les libellés avec le contenu réel de `GET /r/v1/statuts` de l'instance.

Correspondances cibles indicatives : apprentissage → `APP` / `C` / dispositif `04` / emploi `7` ; contrat pro → `CONPRO` / `C` / `05` / `6` ; plan de dév. compétences → `auditeur en formation continue` / `C` / `07` ; CPF → `I` / `03`.

### Priorité 3 — enrichissement via appels supplémentaires

- `GET /r/v1/apprenants/{codeApprenant}/contrats` (`wrContrat[]`, clé basic) : type de contrat, `resilEnCours` / `dateResiliation` (exclure ou basculer « autre »), `codeEntreprise`.
- `GET /r/v1/entreprises/{codeEntreprise}` → `siret`, `nomEntreprise` → colonnes `SIRET_ENTREPRISE` / `RAISON_SOCIALE_ENTREPRISE` (Gescicca rattache l'auditeur à l'employeur en alternance).
- Référentiels `GET /r/v1/statuts`, `/annees`, `/periodes`, `/diplomes-prepares` mis en cache comme les CSV `public/ref/`.
- Filtrer côté API : `formation-longue/groupes?@filtre=codesSite=…&@filtre=codesPeriode=…` (format filtre Yparéo : `?@filtre=X&@filtre=Y`, suffixe `[]` = valeurs multiples séparées par virgules).

### Priorité 4 — validation avant export

Contrôler dans l'aperçu (surligner les cellules fautives) les règles de la spec Gescicca : champs obligatoires (`TITRE`, `CODE_NATIONALITE`, `NOM`, `PRENOM`, `DATE_NAISSANCE`, `PAYS_NAISSANCE`, `LIEU_NAISSANCE`, `ADRESSE_1`, `CODE_POSTAL`, `VILLE`, `PAYS`, `COURRIEL_PERSONNEL`), formats (`CODE_POSTAL` = `99999` si France, email valide, dates `JJ/MM/AAAA`), `LIEU_NAISSANCE` = code INSEE si `PAYS_NAISSANCE` = `0` sinon nom de ville, `PAYS_NAISSANCE` ≠ `990`/`995`.

### Refactor structurant

Représenter chaque ligne comme un **objet `{ NOM_COLONNE: valeur }`** + une liste ordonnée de colonnes unique dont dérivent l'aperçu et le CSV. Supprime les accès positionnels restants (`csvPreview[0]`, `.slice(1)`, tableau en-têtes / lignes tenus en parallèle), la maintenance des colonnes commentées, et rend le mapping par clé (dont la logique contractuelle ci-dessus) nettement plus lisible. Bon candidat à extraire en fonction pure `wrApprenant → ligne`, testable unitairement.

## Divers

- Le remote `origin` (`github.com/cnam-hdf-dev/export-to-Gescicca`) a pu contenir un token dans son URL. Vérifier `git remote -v` et utiliser un credential manager plutôt qu'un token en clair dans `.git/config`.
- `README.md` est le contenu générique CRA, sans valeur métier.
