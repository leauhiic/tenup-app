# tenup-app

Dashboard personnel pour suivre des resultats de padel TenUp/FFT, calculer le top 12 et visualiser un classement simule.

## Stack

- Backend : Node.js, Express, PostgreSQL
- Frontend : React, Recharts, date-fns
- Deploiement : frontend et API Express sur Vercel, base PostgreSQL sur Supabase

## Securite

Ne commit jamais de fichier `.env`. Les secrets Railway doivent etre remplaces par les secrets Supabase/Vercel avant de redeployer.

L'acces passe par des comptes utilisateur. Un compte cree depuis le frontend doit renseigner son `ID TenUp` et etre valide par un admin avant de pouvoir acceder a l'application.

Le compte admin est cree automatiquement depuis `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_TENUP_ID`. `ADMIN_API_KEY` reste accepte uniquement pour les scripts legacy et les appels API directs via `x-api-key`; il n'est plus utilise par l'extension Chrome.

## Backend

Creer un fichier `.env` a partir de `.env.example`.

```bash
npm install
npm start
```

Variables :

- `SUPABASE_DATABASE_URL` : URL PostgreSQL Supabase, prioritaire sur `DATABASE_URL`.
- `RAILWAY_DATABASE_URL` : URL PostgreSQL Railway, seulement pour le script de migration de donnees.
- `DATABASE_URL` : URL PostgreSQL legacy.
- `ADMIN_EMAIL` : email du compte admin, `admin@tenup.local` par defaut.
- `ADMIN_NAME` : nom du compte admin, `Loic Vossier` par defaut.
- `ADMIN_TENUP_ID` : ID TenUp rattache au compte admin, `7146157482` par defaut.
- `ADMIN_PASSWORD` : mot de passe du compte admin.
- `ADMIN_TOKEN_SECRET` : secret de signature des jetons.
- `ADMIN_API_KEY` : cle legacy pour scripts/admin API directs.
- `CORS_ORIGINS` : origines autorisees separees par des virgules, par exemple `http://localhost:3001,https://app.example`.
- `PORT` : port HTTP, `3000` par defaut.

## Migration Railway vers Supabase

Le schema Supabase est versionne dans `supabase/migrations/20260623000000_tenup_app_initial_schema.sql`.

La migration appliquee cree :

- `public.users`
- `public.tournois`
- `public.sync_runs`

La synchronisation Chrome lit les comptes dans `public."User"` et utilise `User.tenupProfileUrl` comme ID TenUp source. `public.users` reste la table technique interne utilisee par cette API pour rattacher les tournois.

Les tables ont RLS active et ne sont pas exposees aux roles `anon`/`authenticated`; l'application y accede via l'API serveur.

Pour copier les donnees Railway vers Supabase :

```bash
RAILWAY_DATABASE_URL="postgres://..." \
SUPABASE_DATABASE_URL="postgres://postgres.zczchnkayfyksmtkugxn:...@aws-0-eu-north-1.pooler.supabase.com:6543/postgres" \
npm run migrate:railway-to-supabase
```

La base cible est tronquee table par table avant copie. Lance ce script seulement quand l'URL Railway source est certaine.

Routes :

- `GET /` : healthcheck.
- `GET /healthz` : healthcheck detaille.
- `POST /auth/register` : cree un compte en attente de validation admin.
- `POST /auth/login` : ouvre une session utilisateur validee.
- `GET /auth/me` : verifie une session utilisateur.
- `GET /admin/users?status=pending` : liste les comptes a valider, requiert admin.
- `POST /admin/users/:id/approve` : valide un compte, requiert admin.
- `GET /tournois` : liste les tournois du compte connecte.
- `POST /tournois` : ajoute un tournoi manuel au compte connecte.
- `PUT /tournois/:id` : modifie un tournoi du compte connecte.
- `DELETE /tournois/:id` : supprime un tournoi du compte connecte.
- `POST /init-db` : cree/migre la table, requiert admin.
- `GET /sync/tenup-ids` : liste les IDs TenUp des comptes valides de `User` a synchroniser.
- `POST /tournois/import/tenup` : importe une liste de tournois et la rattache au compte valide qui porte le meme `ID TenUp`.
- `POST /tournois/import` : importe une liste de tournois sans doublons, route admin legacy.
- `GET /sync/status` : retourne la derniere synchronisation connue.
- `POST /import-from-2026mai` : importe `tournois-202605.json` sans dupliquer les lignes deja presentes, requiert admin.
- `POST /import-from-2026mai?replace=true` : vide la table puis importe le seed.

Exemple :

```bash
curl -X POST http://localhost:3000/init-db \
  -H "x-api-key: $ADMIN_API_KEY"
```

## Vercel

Le projet Vercel doit etre deploye depuis la racine du repo, pas depuis `frontend`.

Variables Vercel a definir en production :

- `SUPABASE_DATABASE_URL`
- `ADMIN_PASSWORD`
- `ADMIN_TOKEN_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_TENUP_ID`
- `CORS_ORIGINS=https://tenup-app.vercel.app`

```bash
npm install
cd frontend
npm install
npm run build
```

Le frontend appelle `/api` par defaut. En local, `frontend/.env` peut definir `REACT_APP_API_URL=http://localhost:3000`.

L'interface affiche un etat de chargement, un bouton de rafraichissement, la derniere synchronisation reussie, les actions admin modifier/supprimer et des badges de statut : top 12, hors top 12, mois courant, expire ce mois et historique.

## Extension Chrome

Le dossier `extension` contient une extension Chrome locale pour synchroniser TenUp depuis une session utilisateur normale. Elle lit les IDs TenUp des comptes valides en base, ouvre chaque page classement a la suite et importe les lignes sur le compte correspondant.

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
- Le script Playwright `login-once.js` reste disponible en local via `npm run login:tenup`.
- La synchro TenUp via Chrome est documentee dans `docs/tenup-sync.md`.
