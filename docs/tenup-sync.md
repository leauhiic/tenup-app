# Synchronisation mensuelle TenUp

Le depot contient un job GitHub Actions qui peut verifier TenUp le 7 de chaque mois et importer les nouveaux tournois dans l'API Railway.

## Principe

TenUp protege la page classement avec Queue-it et une session utilisateur. Le job ne stocke pas le mot de passe TenUp : il reutilise un `storageState.json` Playwright genere localement apres une connexion manuelle.

Le flux est le suivant :

1. Connexion manuelle locale a TenUp avec `npm run login:tenup`.
2. Sauvegarde de la session dans `storageState.json`.
3. Copie du contenu minifie de ce fichier dans un secret GitHub.
4. Le 7 de chaque mois, GitHub Actions lance `npm run sync:tenup`.
5. Le script ouvre la page TenUp avec la session, extrait les tournois detectables, puis appelle `POST /tournois/import`.

## Secrets GitHub a creer

Dans GitHub : `Settings` > `Secrets and variables` > `Actions` > `New repository secret`.

- `TENUP_PERSON_ID` : identifiant TenUp, par exemple `7146157482`.
- `TENUP_CLASSEMENT_URL` : optionnel, par exemple `https://tenup.fft.fr/classement/7146157482/padel`.
- `TENUP_API_URL` : URL Railway, par exemple `https://tenup-app-production.up.railway.app`.
- `TENUP_ADMIN_API_KEY` : meme valeur que `ADMIN_API_KEY` cote Railway.
- `TENUP_STORAGE_STATE_JSON` : contenu minifie de `storageState.json`.

Pour generer `TENUP_STORAGE_STATE_JSON` :

```bash
npm install
npm run login:tenup
node -e "const fs=require('fs'); console.log(JSON.stringify(JSON.parse(fs.readFileSync('storageState.json','utf8'))))"
```

Si TenUp change son point d'entree de connexion, il est possible de forcer l'URL de login :

```bash
TENUP_LOGIN_URL="https://login.fft.fr/realms/connect/protocol/openid-connect/auth?..." npm run login:tenup
```

La valeur affichee par la derniere commande est sensible : elle contient les cookies de session TenUp. Ne pas la committer.

## Lancer manuellement

Le workflow `Monthly TenUp sync` peut etre lance depuis l'onglet `Actions` avec `Run workflow`.

En local :

```bash
TENUP_PERSON_ID=7146157482 \
TENUP_API_URL=https://tenup-app-production.up.railway.app \
TENUP_ADMIN_API_KEY=... \
npm run sync:tenup
```

Pour verifier l'extraction sans modifier la base :

```bash
TENUP_SYNC_DRY_RUN=true TENUP_PERSON_ID=7146157482 npm run sync:tenup
```

## Diagnostic

Le format exact des donnees TenUp peut changer. Si aucun tournoi n'est extrait, le script echoue et ecrit un resume dans `tenup-sync-output.json`.

Pour capturer les payloads bruts localement :

```bash
TENUP_SYNC_DEBUG=true TENUP_SYNC_DRY_RUN=true TENUP_PERSON_ID=7146157482 npm run sync:tenup
```

Ne pas publier ce fichier s'il contient des donnees personnelles.

## API ajoutee

- `POST /tournois/import` : importe une liste de tournois sans doublons, requiert admin.
- `GET /sync/status` : retourne la derniere synchronisation connue.

La route d'import accepte :

```json
{
  "source": "tenup",
  "tournois": [
    {
      "date": "2026-05-07",
      "nom": "Tournoi Padel",
      "categorie": "DM",
      "partenaire": "Nom Partenaire",
      "classement": 12,
      "point": 250,
      "validite": "05/2027"
    }
  ]
}
```

## Limite connue

Le premier run authentifie peut necessiter un ajustement du mapping si TenUp renvoie les tournois avec des noms de champs differents. Dans ce cas, utiliser le mode diagnostic local, puis adapter `scripts/sync-tenup.js`.
