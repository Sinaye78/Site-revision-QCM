# Connexions Google et Discord

L’accès **Continuer sans compte** fonctionne sans OAuth. Pour activer les connexions externes, chacun configure sa propre application et ses propres identifiants.

## Adresses de retour

Le code utilise `SITE_URL`, sans barre finale, suivi de `/api/auth/`, du fournisseur, puis de `/retour`. En local, par défaut :

- Google : `http://localhost:3000/api/auth/google/retour`
- Discord : `http://localhost:3000/api/auth/discord/retour`

Enregistrer exactement la même adresse chez le fournisseur : protocole, port et éventuel sous-dossier compris.

## Discord

Créer une application dans le [portail développeur Discord](https://discord.com/developers/applications). Enregistrer l’adresse de retour dans sa configuration OAuth2, puis renseigner `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` dans `.env.local`. La connexion utilise l’identité et l’adresse e-mail ; aucun bot n’est nécessaire.

## Google

Configurer OAuth dans la [console Google Cloud](https://console.cloud.google.com/), avec un client de type application web. Enregistrer l’adresse de retour et autoriser les utilisateurs nécessaires selon le statut de son application. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`.

## Comptes autorisés

`COMPTES_AUTORISES` accepte une liste d’adresses e-mail séparées par des virgules. `*` autorise tous les comptes avec une adresse vérifiée ; une valeur vide n’autorise aucun compte externe. `SANS_COMPTE` contrôle séparément le bouton d’accès sans compte.

Redémarrer le site et le service de traitement après modification. Ne pas publier les secrets OAuth ni la configuration remplie.
