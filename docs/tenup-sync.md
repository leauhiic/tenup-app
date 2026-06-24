# Synchronisation TenUp avec Chrome

TenUp bloque les navigateurs automatises. La synchronisation passe donc par une extension Chrome locale, qui utilise ta session TenUp normale au lieu de stocker ton mot de passe.

## Principe

1. Tu te connectes a TenUp dans ton Chrome habituel.
2. L'extension recupere les IDs TenUp des comptes valides en base.
3. Elle ouvre chaque page classement TenUp depuis cette session, ID par ID.
4. Elle extrait les resultats detectables.
5. Elle envoie les resultats avec l'`ID TenUp` en cours ; l'API les rattache au compte valide correspondant. Les imports serveur peuvent aussi etre rattaches par `licence`.
6. Elle peut relancer une verification automatiquement le 7 du mois si Chrome est ouvert.

## Pre-requis

- L'API Vercel doit etre redeployee pour exposer `GET /api/sync/tenup-ids` et `POST /api/tournois/import/tenup`.
- Ton compte dashboard doit etre cree avec le meme `ID TenUp`, et si tu veux le lien avec Padel Manager, avec la meme licence FFT, puis valide par un admin. Pour un compte deja cree, renseigne la licence depuis `Mon profil`.
- Chrome doit etre installe.

## Installer l'extension

1. Ouvre `chrome://extensions`.
2. Active `Mode developpeur`.
3. Clique `Charger l'extension non empaquetee`.
4. Selectionne le dossier `extension` du repo.
5. Epingle l'extension `TenUp App Sync` dans la barre Chrome.

## Configurer

Dans le popup de l'extension :

- `Verifier automatiquement le 7 du mois` : actif si tu veux la verification mensuelle.
- Le nombre d'IDs TenUp trouves en base s'affiche automatiquement. Il correspond aux comptes valides qui ont un ID TenUp.

Clique ensuite `Enregistrer`.

## Tester aujourd'hui

1. Ouvre TenUp dans Chrome normal.
2. Connecte-toi.
3. Clique sur l'extension.
4. Clique `Ouvrir TenUp` pour ouvrir le premier ID disponible.
5. Connecte-toi si TenUp le demande.
6. Clique `Tester le premier ID`.
7. Si au moins un tournoi est detecte, clique `Synchroniser tous les IDs`.

Si l'import reussit, le popup affiche le nombre d'IDs synchronises, de tournois importes, remplaces et ignores.
`Tester le premier ID` ne lance pas d'import ; il sert uniquement a verifier que l'extension voit les donnees TenUp du premier classement.

## Synchro automatique le 7

L'extension programme une alarme locale le 7 du mois a 07:00, heure de ton Mac.

Limites importantes :

- Chrome doit etre ouvert.
- L'extension doit etre activee.
- Si TenUp demande une reconnexion ou un captcha, l'extension ouvrira la page mais tu devras te reconnecter manuellement.
- La synchro cloud 100% autonome n'est pas fiable tant que TenUp bloque les navigateurs automatises.

## API ajoutee

- `POST /api/tournois/import/tenup` : importe une liste de tournois sans doublons et rattache les lignes au compte valide qui porte le meme `ID TenUp`.
- `GET /api/sync/tenup-ids` : retourne les IDs TenUp des comptes valides a synchroniser.
- `POST /api/tournois/import` : route admin serveur a serveur, requiert `x-api-key` ou un jeton admin et peut rattacher par `tenupId` ou par `licence`.
- `GET /api/sync/status` : retourne la derniere synchronisation connue.

La route d'import accepte :

```json
{
  "source": "tenup-extension",
  "tenupId": "7146157482",
  "licence": "123456789",
  "tournois": [
    {
      "date": "2026-05-07",
      "nom": "Tournoi Padel",
      "categorie": "DM",
      "licence": "123456789",
      "partenaire": "Nom Partenaire",
      "classement": 12,
      "point": 250,
      "validite": "05/2027"
    }
  ]
}
```

## Diagnostic

Si l'extension affiche `Aucun tournoi detecte`, recharge la page TenUp puis relance la synchro. Le format exact des donnees TenUp peut changer ; dans ce cas il faudra ajuster le mapping dans `extension/content.js`.
