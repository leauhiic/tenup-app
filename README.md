# tenup-app

Dashboard personnel pour suivre des resultats de padel TenUp/FFT, calculer le top 12 et visualiser une projection de classement.

## Stack

- Backend : Node.js, Express, PostgreSQL
- Frontend : React, Recharts, date-fns
- Deploiement prevu : API sur Railway, frontend statique sur Vercel

## Securite

Ne commit jamais de fichier `.env`. Le depot contenait auparavant des secrets en clair : ils doivent etre revoques et remplaces cote TenUp/Railway avant de redeployer.

Les mutations de donnees sont protegees par `ADMIN_API_KEY`. Le frontend demande cette cle au moment de l'ajout d'un tournoi et la garde en `sessionStorage` pour la session courante.

Pour une app partagee publiquement, remplace cette cle simple par une vraie authentification serveur.

## Backend

Creer un fichier `.env` a partir de `.env.example`.

```bash
npm install
npm start
```

Variables :

- `DATABASE_URL` : URL PostgreSQL.
- `ADMIN_API_KEY` : cle obligatoire pour les routes admin et d'ecriture.
- `CORS_ORIGINS` : origines autorisees separees par des virgules, par exemple `http://localhost:3001,https://app.example`.
- `PORT` : port HTTP, `3000` par defaut.

Routes :

- `GET /` : healthcheck.
- `GET /tournois` : liste publique des tournois.
- `POST /tournois` : ajoute un tournoi, requiert `x-api-key` ou `Authorization: Bearer`.
- `POST /init-db` : cree/migre la table, requiert la cle admin.
- `POST /import-from-2026mai` : importe `tournois-202605.json` sans dupliquer les lignes deja presentes, requiert la cle admin.
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
