# Synchronisation TenUp avec Chrome

TenUp bloque les navigateurs automatises. La synchronisation passe donc par une extension Chrome locale, qui utilise ta session TenUp normale au lieu de stocker ton mot de passe.

## Principe

1. Tu te connectes a TenUp dans ton Chrome habituel.
2. L'extension lit la page classement TenUp depuis cette session.
3. Elle extrait les resultats detectables.
4. Elle envoie les resultats avec ton `ID TenUp`; l'API les rattache au compte valide correspondant.
5. Elle peut relancer une verification automatiquement le 7 du mois si Chrome est ouvert.

## Pre-requis

- L'API doit etre redeployee pour exposer `POST /tournois/import/tenup`.
- Ton compte dashboard doit etre cree avec le meme `ID TenUp` puis valide par un admin.
- Chrome doit etre installe.

## Installer l'extension

1. Ouvre `chrome://extensions`.
2. Active `Mode developpeur`.
3. Clique `Charger l'extension non empaquetee`.
4. Selectionne le dossier `extension` du repo.
5. Epingle l'extension `TenUp App Sync` dans la barre Chrome.

## Configurer

Dans le popup de l'extension :

- `ID TenUp` : l'identifiant numerique de ton profil TenUp
- `Verifier automatiquement le 7 du mois` : actif si tu veux la verification mensuelle

Clique ensuite `Enregistrer`.

## Tester aujourd'hui

1. Ouvre TenUp dans Chrome normal.
2. Connecte-toi.
3. Va sur la page classement padel.
4. Recharge la page pour que l'extension capture les donnees reseau.
5. Clique sur l'extension.
6. Clique `Tester la lecture`.
7. Si au moins un tournoi est detecte, clique `Synchroniser maintenant`.

Si l'import reussit, le popup affiche le nombre de tournois importes, remplaces et ignores.
`Tester la lecture` ne contacte pas l'API ; il sert uniquement a verifier que l'extension voit les donnees TenUp de ta page connectee.

## Synchro automatique le 7

L'extension programme une alarme locale le 7 du mois a 07:00, heure de ton Mac.

Limites importantes :

- Chrome doit etre ouvert.
- L'extension doit etre activee.
- Si TenUp demande une reconnexion ou un captcha, l'extension ouvrira la page mais tu devras te reconnecter manuellement.
- La synchro cloud 100% autonome n'est pas fiable tant que TenUp bloque les navigateurs automatises.

## API ajoutee

- `POST /tournois/import/tenup` : importe une liste de tournois sans doublons et rattache les lignes au compte valide qui porte le meme `ID TenUp`.
- `POST /tournois/import` : route admin legacy, requiert `x-api-key` ou un jeton admin.
- `GET /sync/status` : retourne la derniere synchronisation connue.

La route d'import accepte :

```json
{
  "source": "tenup-extension",
  "tenupId": "7146157482",
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

## Diagnostic

Si l'extension affiche `Aucun tournoi detecte`, recharge la page TenUp puis relance la synchro. Le format exact des donnees TenUp peut changer ; dans ce cas il faudra ajuster le mapping dans `extension/content.js`.
