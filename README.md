# tenup-app

Dashboard personnel pour suivre des resultats de padel TenUp/FFT, calculer le top 12 et visualiser une projection de classement.

## Stack

- Backend : Node.js, Express, PostgreSQL
- Frontend : React, Recharts, date-fns
- Deploiement prevu : API sur Railway, frontend statique sur Vercel

## Securite

Ne commit jamais de fichier `.env`. Le depot contenait auparavant des secrets en clair : ils doivent etre revoques et remplaces cote TenUp/Railway avant de redeployer.

L'administration passe maintenant par un mot de passe serveur (`ADMIN_PASSWORD`). Le frontend appelle `POST /auth/login`, recoit un jeton court en `sessionStorage`, puis utilise `Authorization: Bearer` pour ajouter, modifier ou supprimer un tournoi.

`ADMIN_API_KEY` reste accepte pour les scripts et les appels API directs via `x-api-key`. Garde `ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET` et `ADMIN_API_KEY` differents de valeurs publiques.

## Backend

Creer un fichier `.env` a partir de `.env.example`.

```bash
npm install
npm start
```

Variables :

- `DATABASE_URL` : URL PostgreSQL.
- `ADMIN_PASSWORD` : mot de passe saisi dans l'interface admin.
- `ADMIN_TOKEN_SECRET` : secret de signature des jetons admin.
- `ADMIN_API_KEY` : cle legacy pour scripts/admin API directs.
- `CORS_ORIGINS` : origines autorisees separees par des virgules, par exemple `http://localhost:3001,https://app.example`.
- `PORT` : port HTTP, `3000` par defaut.

Routes :

- `GET /` : healthcheck.
- `GET /healthz` : healthcheck detaille.
- `POST /auth/login` : ouvre une session admin avec `ADMIN_PASSWORD`.
- `GET /auth/me` : verifie une session admin.
- `GET /tournois` : liste publique des tournois.
- `POST /tournois` : ajoute un tournoi, requiert `Authorization: Bearer` ou `x-api-key`.
- `PUT /tournois/:id` : modifie un tournoi, requiert admin.
- `DELETE /tournois/:id` : supprime un tournoi, requiert admin.
- `POST /init-db` : cree/migre la table, requiert admin.
- `POST /tournois/import` : importe une liste de tournois sans doublons, requiert admin.
- `GET /sync/status` : retourne la derniere synchronisation connue.
- `POST /import-from-2026mai` : importe `tournois-202605.json` sans dupliquer les lignes deja presentes, requiert admin.
- `POST /import-from-2026mai?replace=true` : vide la table puis importe le seed.

Exemple :

```bash
curl -X POST http://localhost:3000/init-db \
  -H "x-api-key: $ADMIN_API_KEY"
```

## Frontend

Creer `frontend/.env` a partir de `frontend/.env.example`.

```bash
cd frontend
npm install
npm start
```

Variables :

- `REACT_APP_API_URL` : URL de l'API, par defaut l'API Railway historique.

L'interface affiche un etat de chargement, un bouton de rafraichissement, la derniere synchronisation reussie, les actions admin modifier/supprimer et des badges de statut : top 12, hors top 12, mois courant, expire ce mois et historique.

## Extension Chrome

Le dossier `extension` contient une extension Chrome locale pour synchroniser TenUp depuis une session utilisateur normale. Elle ajoute une synchro manuelle et une verification locale le 7 du mois quand Chrome est ouvert.

La configuration et le test sont documentes dans `docs/tenup-sync.md`.

## Tests

Les premiers tests couvrent la logique FFT extraite dans `frontend/src/fft.js`.

```bash
cd frontend
npm test -- --watchAll=false
```

## Notes de maintenance

- Les dates sont normalisees cote API et stockees comme `DATE`.
- Le backend refuse les categories hors `DM`, `DD`, `DX`.
- Le Dockerfile installe seulement les dependances runtime de l'API. Le script Playwright `login-once.js` reste disponible en local via `npm run login:tenup`.
- La synchro TenUp via Chrome est documentee dans `docs/tenup-sync.md`.
