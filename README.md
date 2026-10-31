# Job Tracker

Extension Chrome pour suivre des candidatures. Le classeur Google Sheets est la source de vérité : il n'y a pas de backend ni de base de données.

Le détail de la cible est dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Présentation

### Général

Job Tracker s'utilise sur l'offre ouverte dans le navigateur. L'extension lit l'onglet actif, puis enregistre la candidature dans l'onglet annuel du classeur (`2025`, `2026`, etc.).

`chrome.storage.local` ne garde que les paramètres et les opérations en attente. Les candidatures affichées sont relues depuis Google Sheets.

La fenêtre de l'extension fait 580 px de large et 400 px de haut au minimum. Elle contient deux onglets, **Candidature** et **Paramètres**, sans ouvrir une autre page.

### Fonctionnalités

Cible du produit :

- détection des offres sur LinkedIn, Indeed, HelloWork et Welcome to the Jungle ;
- confirmation de la candidature depuis le popup ;
- dédoublonnage par l'URL normalisée, comparée à la colonne N de tous les onglets annuels ;
- insertion dans l'ordre chronologique de la colonne H (`Postulé le`) ;
- file d'attente locale si l'écriture Google est interrompue ;
- paramètres Google dans l'onglet **Paramètres**.

Version actuelle : l'extension se charge, affiche le titre et le site de l'onglet actif, et vérifie le classeur collé dans **Paramètres**. La lecture des offres et l'enregistrement d'une candidature ne sont pas encore branchés.

### Stack

| Domaine        | Choix                                       |
| -------------- | ------------------------------------------- |
| Extension      | Chrome, Manifest V3, [WXT](https://wxt.dev) |
| Langage        | TypeScript strict                           |
| Interface      | React, Tailwind CSS                         |
| Formulaires    | React Hook Form, Zod                        |
| Données        | Google Sheets API v4                        |
| Auth           | OAuth 2.0 via `chrome.identity`             |
| Stockage local | `chrome.storage.local`                      |
| Tests          | Vitest, Testing Library, Playwright         |
| Qualité        | ESLint, Prettier, GitHub Actions            |

Node.js 24 est utilisé en local et dans la CI.

## Utilisation en développement

Prérequis : Chrome et Node.js 24.

```powershell
npm install
npm run dev
```

WXT sert l'extension et écrit le build dans `.output/chrome-mv3-dev`.

1. Ouvre `chrome://extensions`.
2. Active le mode développeur.
3. Choisis **Charger l'extension non empaquetée**.
4. Sélectionne le dossier `.output/chrome-mv3-dev`.

Épingle Job Tracker, puis clique sur l'icône. **Candidature** montre l'onglet actif. **Paramètres** reste dans la même fenêtre.

Pour vérifier un classeur, crée un client OAuth de type extension Chrome dans Google Cloud, avec le scope `https://www.googleapis.com/auth/spreadsheets`, puis un fichier `.env` à la racine :

```text
WXT_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

Relance `npm run dev` et recharge l'extension. L'identifiant de l'extension dans `chrome://extensions` doit être autorisé sur ce client. Le `.env` n'est pas versionné.

Après un changement, recharge l'extension depuis `chrome://extensions`. En développement, `Alt+R` recharge aussi l'extension.

Commandes utiles :

| Commande           | Rôle                            |
| ------------------ | ------------------------------- |
| `npm run dev`      | Extension rechargée à chaud     |
| `npm test`         | Tests unitaires                 |
| `npm run test:e2e` | Build, puis parcours Playwright |
| `npm run lint`     | ESLint                          |
| `npm run format`   | Prettier                        |
| `npm run compile`  | Vérification TypeScript         |

## Utilisation en production

Le paquet de production ne contient pas le serveur de rechargement.

```powershell
npm ci
npm run build
```

Le dossier à charger est `.output/chrome-mv3`. Les étapes dans `chrome://extensions` sont les mêmes que en développement : mode développeur, puis **Charger l'extension non empaquetée**.

Pour obtenir une archive :

```powershell
npm run zip
```

L'archive est écrite dans `.output`. On peut la charger telle quelle, ou l'envoyer vers le Chrome Web Store quand la publication sera prête.

Une fois l'extension installée, l'usage quotidien est le clic sur l'icône. L'onglet **Candidature** concerne l'offre ouverte. L'onglet **Paramètres** vérifie l'URL du classeur : accès en lecture, en-têtes A–Q, onglets annuels et listes. L'écriture reste non vérifiée tant qu'aucune candidature n'a été enregistrée. Le même `WXT_GOOGLE_CLIENT_ID` est nécessaire au moment du build.
