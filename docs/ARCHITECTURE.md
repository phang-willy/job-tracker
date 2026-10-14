# Job Tracker — architecture proposée

Extension Chrome Manifest V3 pour suivre des candidatures sur LinkedIn, Indeed, HelloWork et Welcome to the Jungle.

Google Sheets est la source de vérité. Il n’y a ni backend, ni base de données, ni Firebase, ni Supabase. `chrome.storage.local` sert uniquement aux paramètres et aux opérations en attente : file d’écritures, verrou local par URL, brouillons de candidatures externes non encore confirmés. Aucun cache métier des candidatures n’est conservé : l’affichage relit le classeur.

Ce document décrit la cible à valider. Le code du projet n’est pas encore généré.

## Décisions à valider

| Sujet | Choix |
|---|---|
| Build | WXT plutôt que CRXJS |
| UI popup et Paramètres | React, Tailwind CSS, shadcn/ui, Lucide |
| UI injectée dans les sites | React dans un Shadow DOM, sans shadcn/ui |
| État global | Aucun Zustand au départ |
| Auth | `chrome.identity`, scope OAuth `spreadsheets` |
| Doublon | Uniquement l’URL normalisée, comparée à la colonne N de tous les onglets annuels |
| Ordre des lignes | Chronologique croissant sur la colonne H (`Postulé le`), insertion à la position exacte |

## Stack

| Domaine | Choix |
|---|---|
| Langage | TypeScript strict |
| Extension | WXT, Manifest V3, Vite |
| Formulaires | React Hook Form + Zod |
| Contrats de messages | Zod |
| État d’interface | État local React |
| Stockage | `chrome.storage.local` |
| Google | Sheets API v4 |
| Authentification | OAuth 2.0 via Chrome Identity API |
| Tests | Vitest, Testing Library, Playwright |
| Qualité | ESLint, Prettier, GitHub Actions |

WXT est retenu parce qu’il traite le popup, la page Paramètres, le content script et le service worker comme des entrypoints, et qu’il fournit un montage en Shadow DOM. CRXJS reste viable pour un manifest écrit entièrement à la main, avec plus de collage entre les contextes.

shadcn/ui reste dans le popup et la page Paramètres. Ses menus rendent leurs portails dans `document.body` : dans une page d’emploi, ils sortiraient du Shadow DOM. Le bouton injecté utilise quelques composants locaux. Tailwind y est compilé sans preflight.

Pas de librairie de dates : les dates métier sont des chaînes `YYYY-MM-DD`. Pas de client HTTP dédié : les appels Google passent par `fetch`.

## Contextes Chrome

| Contexte | Rôle |
|---|---|
| Content script | Lit le DOM, normalise l’URL, détecte le statut du site, affiche le bouton |
| Popup | Consulte l’offre de l’onglet actif et confirme une candidature |
| Page Paramètres | Connecte Google et valide le classeur |
| Service worker | Seul contexte qui appelle OAuth, Sheets et la file persistante |

Le content script et le popup n’appellent jamais Google. Ils envoient des messages au service worker.

Un seul content script couvre les quatre sites et choisit l’adaptateur selon l’hôte. Les navigations SPA sont suivies via `pushState`, `replaceState`, `popstate` et un `MutationObserver` limité au conteneur de l’offre.

## Clean Architecture

```text
Presentation  →  Application  →  Domain
Infrastructure → Application  →  Domain
```

| Couche | Dépend de | Responsabilité |
|---|---|---|
| Domain | Rien d’extérieur | Offre, date civile, année, équivalence d’URL, dédoublonnage, position chronologique |
| Application | Domain | Use cases et ports |
| Infrastructure | Application | Parseurs DOM, Sheets API, OAuth, storage, file |
| Presentation | Application | Popup, Paramètres, bouton injecté, messages |

L’injection est une factory manuelle dans `src/composition/`, sans conteneur. Les use cases ne reçoivent que des ports.

Use cases du content script, parce qu’ils lisent le DOM :

- `ExtractJobOffer`
- `DetectApplicationStatus`
- `DetectApplicationSubmission`

Use cases du service worker :

- `FindExistingApplication`
- `FindChronologicalInsertionPosition`
- `PrepareApplicationWrite`
- `ConfirmApplication`
- `ImportExistingApplication`
- `ResolveApplicationYear`
- `ValidateSpreadsheetConfig`
- `SyncApplication`
- `VerifyApplicationWrite`
- `RetryPendingSynchronizations`
- création d’un onglet annuel, après confirmation
- déplacement d’une candidature dont la date change, y compris d’année, après confirmation

`FindChronologicalInsertionPosition` s’appuie sur une fonction pure du domaine. Le use case lit la colonne H via le port tableur, retire éventuellement la ligne en cours de déplacement, puis appelle cette fonction. Il n’écrit rien.

Ports, sans les découper davantage :

| Port | Rôle |
|---|---|
| `SpreadsheetGateway` | Lecture des onglets annuels, colonnes H et N, et `spreadsheets.batchUpdate` |
| `PendingOperationRepository` | File, verrou par URL, brouillons externes dans `chrome.storage.local` |
| `GoogleAuthGateway` | Jeton Chrome Identity et invalidation sur `401` |
| `Clock` | Date de tentative et calcul du délai de reprise |

La normalisation d’URL est une règle métier pure. Elle vit dans le domaine. Les adaptateurs extraient l’URL brute, puis appellent ce normaliseur.

Zod valide les frontières : messages, formulaires, données extraites, opérations persistées. Les règles du domaine restent des fonctions pures.

## Arborescence

```text
job-tracker/
├── entrypoints/
│   ├── background.ts
│   ├── popup/
│   ├── options/
│   └── job-boards.content.ts
├── src/
│   ├── domain/
│   │   ├── shared/
│   │   ├── job-offer/
│   │   │   └── normalizers/
│   │   ├── application/
│   │   └── spreadsheet/
│   ├── application/
│   │   ├── ports/
│   │   ├── use-cases/
│   │   └── dto/
│   ├── infrastructure/
│   │   ├── platforms/
│   │   │   ├── linkedin/
│   │   │   ├── indeed/
│   │   │   ├── hellowork/
│   │   │   └── welcome-to-the-jungle/
│   │   ├── google/
│   │   └── chrome/
│   ├── presentation/
│   │   ├── popup/
│   │   ├── options/
│   │   ├── injected/
│   │   └── messaging/
│   └── composition/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/html/
├── e2e/
├── public/icon/
└── .github/workflows/ci.yml
```

Les entrypoints restent minces. Un nouveau site ajoute un dossier d’adaptateur, un normaliseur et une entrée de registre.

## Modèle métier

Identifiants :

- `CivilDate` : `YYYY-MM-DD`, calculée avec la date locale, jamais avec `toISOString()`
- `NormalizedJobUrl` : clé de candidature
- `SpreadsheetId`
- `ApplicationYear` : dérivée de la date de candidature
- `PlatformId` : `linkedin`, `indeed`, `hellowork`, `welcome-to-the-jungle`

État vu sur le site : `not_applied`, `applied` (avec date optionnelle), `unknown`, `external_redirect`.

Signal d’envoi : confirmation explicite, confirmation utilisateur requise, ou pas encore envoyé.

Une offre extraite porte l’URL source, l’URL normalisée, la société, le poste, le lieu, les salaires, le contrat, les dates et l’état vu sur le site.

Un brouillon enregistrable exige la société, le poste, la date de candidature et l’URL normalisée. Le reste est optionnel. L’origine du brouillon est `submission_detected`, `already_applied` ou `manual`.

Une correspondance existante porte l’année, le numéro de ligne, le lien, le statut, la date, la société et le poste.

Une opération en attente porte l’URL normalisée, les informations de la candidature, la date réelle de candidature, l’identifiant du classeur, le type d’opération, le statut, le nombre de tentatives et la date de dernière tentative. Les types sont `insert`, `reposition` et `move_year`. Les statuts sont `pending`, `syncing`, `synced`, `failed` et `needs_review`.

`FindChronologicalInsertionPosition` retourne soit une ligne d’insertion, soit un refus tant que l’onglet n’est pas ordonné. Le placement rendu est `before_all`, `between`, `after_all` ou `same_day`.

## Google Sheets

Onglets annuels : `2025`, `2026`, `2027`, etc. Un onglet annuel a un titre qui matche `^(19|20)\d{2}$`. L’onglet `Paramètres` est exclu de la recherche et de l’insertion.

| Colonne | Nom |
|---|---|
| A | Société |
| B | Pays |
| C | Région / Dep |
| D | Ville |
| E | Poste |
| F | Salaire mensuel |
| G | Salaire annuel |
| H | Postulé le |
| I | Expire le |
| J | Contrat Début |
| K | Contrat Fin |
| L | Type |
| M | CV |
| N | Lien |
| O | Statut |
| P | Date Retour 1 |
| Q | Retour 1 |

La colonne G peut contenir une formule. Elle est lue pour l’affichage. À l’insertion, la formule et le format de la ligne de référence sont copiés, puis A–F et H–Q sont écrits. G n’est pas écrasée quand la cellule copiée contient une formule. Aucun `updateCells` ne vise G dans ce cas.

Les dates sont écrites en numéro de série Sheets, pour rester de vraies dates dans un classeur en locale française. Le domaine continue de manipuler `YYYY-MM-DD`. La comparaison chronologique utilise ces dates civiles, ou le numéro de série lu avec `UNFORMATTED_VALUE`. Le texte affiché n’est jamais trié : un ordre lexicographique sur `JJ/MM/AAAA` ne suit pas le calendrier. La colonne N est lue en `FORMULA` afin de voir un `HYPERLINK`.

Les listes Pays, Type, CV et Statut sont lues depuis les validations de données de l’onglet annuel. Si une validation pointe vers `Paramètres`, cette plage est lue. Le layout de `Paramètres` n’est pas codé en dur.

L’année d’insertion vient de la date réelle de candidature. Une candidature ne change pas d’onglet parce que l’année courante change. Si l’onglet manque, l’extension propose de le créer à partir du dernier onglet annuel : les candidatures copiées sont effacées, les validations et la formule de G sont conservées.

Si l’utilisateur corrige la date, la candidature est repositionnée dans l’ordre chronologique. Si l’année change, le déplacement est confirmé : ajout dans l’onglet cible à la position chronologique, puis suppression de la ligne source seulement après vérification de l’ajout.

### Ordre chronologique strict

Chaque onglet annuel contient les candidatures classées par la colonne H, de la date la plus ancienne à la plus récente.

L’insertion ne vise jamais la première ligne vide. La nouvelle ligne prend sa place exacte :

- date antérieure à toutes les candidatures : première ligne de données, immédiatement sous les en-têtes ;
- date postérieure à toutes les candidatures : après la dernière ligne qui contient des données ;
- date comprise entre deux candidatures : entre ces deux lignes ;
- même date civile : la nouvelle ligne rejoint ce groupe, après les lignes qui ont déjà cette date.

Aucun ordre secondaire n’est imposé à l’intérieur d’un même jour : ni société, ni poste, ni heure. La convention technique est seulement de placer la nouvelle ligne après le groupe existant, pour que la position soit déterministe et que les lignes déjà présentes ne soient pas réordonnées.

`insertDimension` n’est utilisé que lorsque la position tombe sur une ligne déjà occupée, ou lorsqu’il faut ouvrir un emplacement au début ou au milieu. Écrire dans une ligne déjà vide en fin de données ne crée pas de dimension supplémentaire. Dans les deux cas, les cellules écrites sont uniquement celles de la nouvelle candidature.

Avant de calculer cette position, l’onglet est vérifié. Il est ordonné si toutes les lignes de données ont une date civile lisible en colonne H et si ces dates sont croissantes au sens large, sans trou vide au milieu du bloc de données. Les lignes vides après la dernière candidature ne comptent pas comme un trou.

Si l’onglet n’est pas ordonné, aucune insertion et aucune réorganisation silencieuse n’ont lieu. L’extension demande une confirmation. La réorganisation éventuelle déplace des lignes entières, sur toute la largeur réellement utilisée. Si du contenu existe au-delà de la colonne Q, ces colonnes font partie du déplacement. Trier la seule colonne H est interdit : cela dissocierait les dates des autres cellules de la candidature.

La ligne 1 reste les en-têtes. Aucune insertion ne la vise.

## Déduplication

L’unique critère automatique est l’URL normalisée, comparée aux valeurs de la colonne N de tous les onglets annuels. Cette recherche a lieu avant chaque tentative d’insertion, y compris après un échec, un timeout ou un redémarrage du service worker.

Deux candidatures ne sont jamais considérées comme des doublons parce qu’elles partagent la société, le poste ou la localisation.

Exemple traité comme une seule offre :

```text
https://www.linkedin.com/jobs/view/123456789/?trackingId=abc
https://www.linkedin.com/jobs/view/123456789/
```

La comparaison normalise aussi l’URL déjà stockée. Les anciennes cellules qui contiennent encore un paramètre de tracking restent trouvables, sans réécriture de la ligne.

| Plateforme | Identité extraite | Forme enregistrée |
|---|---|---|
| LinkedIn | Identifiant numérique de `/jobs/view/` ou `currentJobId` | `https://www.linkedin.com/jobs/view/{id}` |
| Indeed | Paramètre `jk` ou `vjk` | `https://{hôte}/viewjob?jk={clé}` |
| HelloWork | Identifiant numérique du chemin `.html` | URL sans paramètres de tracking |
| Welcome to the Jungle | Société + slug d’offre, locale ignorée | `https://www.welcometothejungle.com/fr/companies/{société}/jobs/{offre}` |

Limites assumées :

- une offre republiée avec un nouvel identifiant est une nouvelle candidature ;
- l’URL du site d’emploi et l’URL d’un ATS sont deux identités ;
- une formule `HYPERLINK` est lue via sa formule ;
- une puce de lien riche peut échapper au texte de la cellule ;
- si aucune identité d’offre ne peut être extraite, la comparaison retombe sur l’URL canonique complète ;
- Sheets n’impose pas d’unicité sur la colonne N. La recherche préalable réduit le risque ; elle ne le supprime pas si deux contextes écrivent en même temps.

## Scénarios

### A — Pas encore postulé

1. Extraire l’offre.
2. Chercher l’URL normalisée dans les onglets annuels.
3. Lire l’indication du site.
4. Si le site ne dit pas que la candidature est déjà partie, observer le flux quand il reste sur le même site.
5. N’ouvrir le formulaire qu’après une confirmation explicite, ou après une confirmation manuelle.
6. Laisser corriger les champs, puis enregistrer à la position chronologique de la date confirmée.

Un clic sur « Postuler » n’est pas une preuve d’envoi.

### B — Déjà postulé

1. Récupérer l’URL.
2. La chercher dans tous les onglets annuels.
3. Si la ligne existe, afficher son statut et ne pas créer de doublon.
4. Sinon, extraire l’offre.
5. Reprendre la date fournie par le site, ou la demander.
6. Après validation du formulaire, insérer la ligne dans l’onglet de cette date, à sa position chronologique.

### C — Statut inconnu

Afficher « Non déterminé ». Proposer une confirmation manuelle. Ne rien enregistrer automatiquement.

### D — Candidature externe

Si « Postuler » quitte l’hôte du site d’emploi, l’extension garde un brouillon local lié à l’URL de l’offre pendant sept jours. Elle ne demande pas l’accès au site externe. Au retour sur l’offre, elle propose de confirmer. Elle ne déduit pas qu’une candidature a été envoyée.

Fiabilité attendue :

| Plateforme | Déjà postulé | Confirmation d’envoi | Redirection externe |
|---|---|---|---|
| LinkedIn | Souvent lisible | Écran Easy Apply, fragile | Confirmation manuelle |
| Indeed | Libellé de page, fragile | Indeed Apply sur le même site | Confirmation manuelle |
| HelloWork | Souvent absent | Peu fiable | Confirmation manuelle |
| Welcome to the Jungle | Parfois affiché | Formulaire du même site seulement | Confirmation manuelle |

Les sélecteurs DOM sont des heuristiques, testées sur des fixtures HTML. Le filet de sécurité est le formulaire validé, puis la relecture de la colonne N.

## Préparation de l’écriture

`PrepareApplicationWrite` ne modifie pas le classeur. Avant toute écriture :

1. Valider la candidature avec Zod. Une candidature invalide ne rejoint pas la file.
2. Vérifier l’authentification Google et l’accès en lecture au classeur.
3. Identifier l’onglet annuel de la date réelle de candidature. S’il manque, s’arrêter et proposer sa création. Ne pas le créer pendant une reprise automatique.
4. Chercher l’URL normalisée dans la colonne N de tous les onglets annuels.
5. Si l’URL existe déjà, ne rien insérer et retourner la candidature existante. Pour un repositionnement, la ligne source de cette même candidature ne compte pas comme un doublon ; une autre ligne qui porte la même URL bloque l’écriture.
6. Lire les dates de la colonne H et calculer la position avec `FindChronologicalInsertionPosition`.
7. Si l’onglet n’est pas ordonné, retourner un refus et demander confirmation avant toute réorganisation.
8. Préparer les valeurs, la formule de G si la ligne de référence en contient une, les formats et les validations. Le plan désigne la ligne cible et la ligne de référence après prise en compte du décalage qu’un `insertDimension` produira.

Le plan décrit une écriture. `SyncApplication` l’exécute. Un plan périmé n’est pas réutilisé tel quel après une erreur : la préparation est recommencée depuis la relecture.

## Écriture regroupée

Une succession de requêtes HTTP indépendantes peut laisser une ligne vide ou à moitié remplie. Une nouvelle candidature est donc envoyée dans un seul `spreadsheets.batchUpdate`.

Séquence quand une ligne doit être ouverte :

1. `insertDimension` sur `ROWS`, une seule ligne, à l’index de la position chronologique. `inheritFromBefore` ne reprend que les propriétés de dimension, comme la hauteur de ligne. Il ne copie ni valeurs, ni formules, ni validations.
2. `copyPaste` avec `PASTE_FORMAT`, puis `PASTE_DATA_VALIDATION`, depuis la ligne de référence vers la nouvelle ligne, colonnes A–Q. `PASTE_CONDITIONAL_FORMATTING` est inclus pour conserver les mises en forme conditionnelles portées par cette ligne.
3. `copyPaste` avec `PASTE_FORMULA` sur la seule colonne G, uniquement si la cellule de référence contient une formule.
4. `updateCells` sur A–F et H–Q de la nouvelle ligne. G est absent de cette requête lorsque l’étape 3 a copié une formule.

`PASTE_NORMAL` est interdit : il copierait les valeurs d’une autre candidature.

Les index de l’API sont nuls et la fin de plage est exclue. Les requêtes d’un même lot voient les effets des requêtes précédentes. Un `insertDimension` décale les lignes situées à partir de l’index choisi. La ligne de référence est donc :

- la ligne précédente, dont l’index ne change pas, lorsqu’on insère au milieu ou à la fin ;
- l’ancienne première ligne de données, décalée d’un cran, lorsqu’on insère sous les en-têtes.

S’il n’existe aucune ligne de données, il n’y a pas de formule à copier. Les valeurs sont écrites sur la première ligne libre sous les en-têtes, sans écraser autre chose.

`updateCells` ne couvre jamais une plage qui contient déjà une candidature. Une candidature existante n’est pas écrasée par une insertion.

### Garanties réelles de l’API

Dans un seul `batchUpdate`, Google valide l’ensemble des requêtes puis les applique en ordre. Si l’une est invalide, aucune n’est appliquée. Côté serveur, le lot ne laisse donc pas une ligne insérée sans ses cellules.

Cette atomicité s’arrête à la frontière de l’appel HTTP :

- il n’existe pas de clé d’idempotence. Rejouer le même lot insère une seconde ligne ;
- un timeout ou une coupure après l’envoi ne dit pas si le serveur a appliqué le lot ;
- deux appels successifs ne forment pas une transaction ;
- l’API ne fournit pas de verrou ni de contrainte d’unicité sur la colonne N ;
- l’API ne fournit pas de précondition du type « n’écrire que si cette cellule est encore vide » ;
- un `batchUpdate` dont le tableau de requêtes est vide ne modifie rien et ne prouve pas le droit d’écriture sur le fichier.

Le client traite donc chaque envoi comme ambigu jusqu’à la relecture. L’URL normalisée sert de clé de rapprochement, faute d’idempotence côté Google.

### Date modifiée

Si la date change sans changer d’année, la ligne source est exclue du calcul de position. Si elle est déjà dans le bon groupe, seules les cellules modifiées sont mises à jour, jamais en recopiant la colonne G lorsqu’elle contient une formule. Si la position change, un `moveDimension` déplace la ligne entière, et la mise à jour des cellules modifiées voyage dans le même `batchUpdate`. `moveDimension` conserve les formules, les validations et les formats. Le calcul d’index tient compte de la règle Google : la destination est exprimée avant le déplacement.

Si la date change d’année, l’utilisateur confirme. L’ajout cible et la suppression source ne sont pas placés dans le même lot : la suppression n’est envoyée qu’après `VerifyApplicationWrite` sur l’onglet cible. Un lot unique éviterait le doublon transitoire, mais supprimerait aussi la seule copie si l’écriture cible était mauvaise et pas encore relue. Le doublon transitoire est repris au redémarrage : URL déjà correcte sur la cible, la source est supprimée ; URL absente de la cible, l’ajout est préparé de nouveau ; situation illisible, `needs_review`.

## Protection contre les doublons

Le verrou local, persisté avec la file, empêche deux envois simultanés de la même URL dans ce profil Chrome. Il ne couvre ni un autre navigateur, ni un autre profil, ni un autre utilisateur du classeur.

Après un échec, un timeout ou une expiration, l’insertion n’est jamais relancée directement.

1. Relire la colonne N de tous les onglets annuels.
2. URL présente une seule fois, avec les données attendues : l’opération est déjà faite. La marquer synchronisée, sans second insert.
3. URL absente, et la lecture est fiable : une nouvelle tentative est autorisée, après recalcul de la position.
4. Lecture impossible : laisser l’opération en attente. Ne pas choisir entre « déjà écrite » et « à écrire ».
5. URL présente plusieurs fois, ou présente avec des données contradictoires : `needs_review`. Ne pas supprimer une ligne automatiquement.

Deux instances peuvent toutes les deux lire l’absence de l’URL, puis toutes les deux insérer. Sheets acceptera les deux lignes. La vérification d’après écriture doit alors s’arrêter en `needs_review` plutôt que d’ajouter une troisième ligne ou d’en effacer une au hasard. L’unicité est donc une obligation de l’extension, pas une garantie du classeur.

## File d’attente persistante

`chrome.storage.local` conserve la file au-delà de la fermeture du navigateur et de l’arrêt du service worker Manifest V3. Le service worker peut être tué à chaque `await`.

Chaque opération contient :

- l’URL normalisée ;
- les informations de la candidature ;
- la date réelle de candidature ;
- le classeur cible ;
- le type `insert`, `reposition` ou `move_year` ;
- le statut de synchronisation ;
- le nombre de tentatives ;
- la date de dernière tentative.

Transitions :

- création en `pending` ;
- passage à `syncing` persisté avant l’appel réseau ;
- `synced` seulement après vérification, puis suppression autorisée ;
- erreur temporaire : retour à `pending`, tentatives incrémentées, prochain essai après le délai calculé ;
- erreur permanente : `failed`, sans relance automatique ;
- résultat ambigu : `needs_review`, sans réécriture automatique ;
- au démarrage, un statut resté `syncing` est une écriture incertaine : relire le classeur avant toute nouvelle écriture.

Une opération n’est supprimée qu’après confirmation de son écriture. Un `chrome.alarms` n’existe que s’il reste une opération `pending`, `syncing` ou temporairement reportée.

## Erreurs et reprises

| Situation | Classe | Reprise |
|---|---|---|
| Réseau coupé avant envoi | Temporaire, écriture certaine de ne pas avoir eu lieu | Nouvel essai après backoff |
| Timeout, ou réseau coupé après un envoi possible | Incertain | Relecture obligatoire avant toute insertion |
| `401` | Authentification | Invalider le jeton, rester en attente, demander une reconnexion. Pas de boucle |
| `403` | Accès refusé | `failed`. Pas de relance automatique |
| `429` | Quota | Respecter `Retry-After` s’il est présent, sinon backoff, puis relecture |
| `5xx` | Temporaire | Backoff, puis relecture avant insertion |
| Classeur supprimé ou inaccessible | Permanent | `failed`, le fichier doit être choisi de nouveau |
| Onglet annuel supprimé ou renommé | Intervention | `needs_review`. Pas de création d’onglet pendant la reprise |
| Modification concurrente | Ambigu si la relecture ne confirme pas l’opération | `needs_review` |

Le backoff est exponentiel, plafonné à cinq minutes, avec un jitter uniforme entre zéro et le délai calculé. Le premier délai vaut une seconde. Au-delà de cinq tentatives temporaires, l’opération passe en `needs_review` au lieu de réessayer indéfiniment. Les tests injectent l’horloge.

`RetryPendingSynchronizations` est le seul chemin de reprise. Il reprend au démarrage du service worker et sur l’alarme.

## Vérification après écriture

`VerifyApplicationWrite` relit le classeur après le lot, ou après une reprise incertaine.

1. Relire la colonne N et retrouver l’URL normalisée.
2. Vérifier qu’elle apparaît exactement une fois.
3. Vérifier l’onglet annuel attendu.
4. Vérifier la date en colonne H.
5. Vérifier les principales données enregistrées : société, poste, lien, statut.
6. Vérifier que la ligne se trouve dans l’ordre chronologique, y compris à l’intérieur du groupe de la même date.
7. Marquer `synced` seulement si ces contrôles passent.

Si la ligne est unique et correcte mais décalée par une insertion concurrente, et que l’ordre chronologique reste respecté, l’opération est acceptée. Si un contrôle échoue ou si la lecture est partielle, le statut devient `needs_review`. Aucune réécriture automatique ne suit un résultat ambigu.

Pour un `move_year`, la vérification de la cible précède la suppression de la source. La source n’est retirée que si la cible est confirmée.

## Respect du classeur existant

L’extension préserve les colonnes A–Q, les candidatures déjà présentes, les formules de G, les listes déroulantes, les formats de dates et de salaires, les mises en forme, les références de formules et les autres onglets.

Insérer ou déplacer une ligne entière laisse Sheets ajuster les références qui pointent vers les lignes décalées. Réordonner uniquement la colonne H casserait ces références et les associations de cellules. C’est exclu, y compris pour « réparer » un onglet.

Une écriture ne vise pas une plage entière de l’onglet. Elle vise la ligne nouvelle, ou les cellules explicitement modifiées d’une candidature déjà identifiée.

Aucune ligne n’est supprimée ou triée sans lecture préalable de son contenu. La réorganisation d’un onglet non trié attend une confirmation et déplace des lignes complètes.

## Vérification des autorisations

Un `batchUpdate` sans requête réussit sans rien modifier. Il ne distingue pas un fichier lisible d’un fichier modifiable. Il n’est pas utilisé.

Aucune ligne témoin n’est ajoutée au classeur réel pour sonder les droits.

La page Paramètres distingue :

| État | Signification |
|---|---|
| Accessible en lecture | `spreadsheets.get` ou la lecture des valeurs aboutit |
| Structure compatible | En-têtes A–Q, onglets annuels et validations conformes |
| Écriture non vérifiée | Lecture et structure sont bonnes, aucune écriture réelle n’a encore réussi |
| Écriture confirmée | Une mutation demandée par l’utilisateur a réussi puis a été vérifiée |
| Accès refusé | `403`, ou classeur introuvable |

Le scope `spreadsheets` autorise l’application à écrire les classeurs que le compte peut modifier. Un fichier partagé en lecture seule peut quand même être lu. Seule une vraie mutation, refusée ou acceptée, tranche le droit sur ce fichier. Tant qu’aucune candidature n’a été enregistrée, l’interface affiche l’écriture comme non vérifiée. Un `403` ultérieur ramène l’état à accès refusé. Cet état local est un affichage : chaque appel s’appuie sur la réponse Google, pas sur le souvenir du dernier succès.

## OAuth et permissions

Permissions : `storage`, `identity`, `alarms`, `activeTab`.

Hôtes : LinkedIn, Indeed (`indeed.com`, `indeed.fr`), HelloWork, Welcome to the Jungle, `https://sheets.googleapis.com/*`.

Pas de `<all_urls>`. Pas de permission sur Greenhouse, Lever, Workday ou un autre ATS.

Scope unique : `https://www.googleapis.com/auth/spreadsheets`.

Ce scope est nécessaire pour un classeur déjà existant, identifié par une URL collée. `drive.file` ne couvre qu’un fichier créé par l’application ou choisi via Google Picker, et le Picker charge un script distant incompatible avec la CSP de l’extension. Les scopes Drive généraux sont exclus.

Le consentement interactif part de la page Paramètres. Le service worker récupère ensuite le jeton en mode non interactif. Le jeton reste dans le cache Chrome. Un `401` l’invalide et renvoie vers la connexion. L’identifiant client OAuth est public dans le manifest. Il n’y a pas de secret client dans le dépôt.

La page Paramètres :

1. extrait l’identifiant depuis l’URL du classeur ;
2. lance la connexion Google ;
3. vérifie l’accès en lecture, les en-têtes A–Q, les onglets et les validations ;
4. enregistre l’écriture comme non vérifiée, sans `batchUpdate` vide et sans ligne témoin ;
5. permet de changer de fichier plus tard.

L’extension ne lit ni mot de passe, ni CV, ni message de candidature.

## Tests et CI

| Sujet | Niveau |
|---|---|
| Normalisation d’URL, dates, année, dédoublonnage | Vitest |
| `FindChronologicalInsertionPosition` | Vitest, port tableur en mémoire |
| Mapping Sheets, plan de lot, préservation de la formule G | Vitest |
| `PrepareApplicationWrite`, `SyncApplication`, `VerifyApplicationWrite` | Vitest, ports en mémoire |
| File, timeout, `429`, interruption du service worker | Intégration |
| Parseurs sur HTML figé | Vitest + jsdom |
| Popup, Paramètres, formulaire, confirmation si l’onglet n’est pas trié | Testing Library |
| Parcours d’extension | Playwright, API Google interceptée |

`FindChronologicalInsertionPosition` est couvert avant toute synchronisation réelle. Cas unitaires :

- insertion entre deux dates ;
- insertion sous les en-têtes lorsque la date est la plus ancienne ;
- insertion après la dernière candidature lorsque la date est la plus récente ;
- onglet sans candidature : ligne 2, sans `insertDimension` ;
- plusieurs candidatures le même jour : la nouvelle ligne suit le groupe, sans tri par société ou par poste ;
- dates affichées en `JJ/MM/AAAA` comparées par numéro de série, pas par texte ;
- date vide, illisible, ou trou au milieu du bloc : refus, aucune position d’insertion ;
- dates décroissantes : refus, aucune réorganisation implicite ;
- ligne exclue du calcul lors d’un repositionnement.

Cas d’écriture et de reprise, avec un `SpreadsheetGateway` en mémoire ou intercepté :

- URL déjà présente : aucun lot d’insertion, retour de la ligne existante ;
- timeout après un lot que la relecture retrouve : `synced`, pas de second insert ;
- interruption du service worker pendant `syncing` : l’opération survit, la reprise relit avant d’écrire ;
- erreur réseau avant envoi : nouvel essai autorisé une fois l’URL confirmée absente ;
- réponse `429` : délai respecté, pas d’insertion immédiate ;
- formule de G absente du `updateCells` et présente dans le `copyPaste` de formule ;
- modification concurrente qui laisse deux URL ou une position incohérente : `needs_review` ;
- date modifiée dans la même année : `moveDimension`, formule G intacte ;
- date déplacée vers une autre année : insert cible, pas de suppression source avant vérification ;
- classeur temporairement illisible : l’opération reste en attente, aucun insert.

Branches permanentes : `main`, `pre-prod`, `dev`.

Branches de travail : `feat/*`, `fix/*`, `refactor/*`, `chore/*`, `docs/*`.

Commits conventional. La CI exécute la vérification TypeScript, ESLint, Prettier, les tests et le build. Playwright tourne sur `pre-prod` et `main`.

## Plan d’implémentation

La position chronologique est livrée et testée avant la première synchronisation réelle.

| Phase | Livrable | Validation |
|---|---|---|
| 1 | WXT, TypeScript strict, lint, CI | L’extension vide se charge |
| 2 | URL, dates, dédoublonnage | Les fixtures d’URL passent |
| 3 | Messages, worker, storage, modèle de file | Une reprise ne perd pas la file |
| 4 | Paramètres, OAuth, structure du classeur | Connexion testée, écriture laissée non vérifiée, aucune ligne écrite |
| 5 | Lecture de la colonne N, bouton, popup | Le statut s’affiche, rien n’est ajouté |
| 6 | `FindChronologicalInsertionPosition` et ses tests | Début, milieu, fin, même jour, onglet non trié. Aucun appel d’écriture |
| 7 | Préparation, lot atomique, vérification, reprises | Formule G intacte, timeout sans doublon, `429` sans second insert |
| 8 | LinkedIn, puis Indeed, HelloWork, WTTJ | Fixtures HTML des quatre états |
| 9 | Création d’onglet et déplacement daté | Confirmation, ordre chronologique, suppression source après vérification |

## Dépendances prévues

Runtime : `react`, `react-dom`, `zod`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, et les paquets Radix réellement importés par les composants shadcn utilisés.

Build : `wxt`, `@wxt-dev/module-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`.

Qualité : `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`.

## Hors périmètre de cette cible

- backend, SGBD, Firebase, Supabase ;
- identifiant UUID ou colonne technique obligatoire ;
- suivi automatique des sites ATS externes ;
- déplacement d’une candidature au changement d’année civile ;
- store global ;
- contrainte d’unicité imposée par Sheets lui-même ;
- ligne témoin ou `batchUpdate` vide pour prouver le droit d’écriture.
