# Installation et dépannage

## Prérequis et démarrage

Utiliser **Node.js 24**, qui fournit SQLite intégré, et npm. Git est facultatif : on peut télécharger et extraire les sources en ZIP.

Depuis le dossier contenant `package.json` :

```sh
npm ci
npm run setup
npm run dev
```

Ouvrir <http://localhost:3000>, puis **Continuer sans compte**. Sous PowerShell, si `npm.ps1` est bloqué, utiliser `npm.cmd` à la place de `npm`.

Le script setup lit `.env.example` et crée `.env.local` avec un secret unique et la démo activée. Ce fichier a priorité sur `.env`, fourni vide dans le dossier local. Le script ne remplace jamais `.env.local` s’il existe. Pour une vraie génération, suivre [CONFIGURATION-IA.md](CONFIGURATION-IA.md) et mettre `IA_DEMO=0`.

Garder le secret de connexion privé et stable : le changer invalide les sessions. `SITE_URL` doit correspondre à l’adresse utilisée dans le navigateur. `BASE_PATH` est vide pour une application à la racine.

## Données et traitements

`data/` contient les bases SQLite, les fichiers importés et les résultats. Ne pas le publier. Pour une sauvegarde simple, arrêter le site et le service de traitement, puis copier **tout** ce dossier, y compris les éventuels fichiers SQLite `-wal` et `-shm`. Ne pas copier une base seule pendant qu’elle est ouverte.

L’accès sans compte est lié au cookie du navigateur, même si les cours sont stockés sur l’ordinateur qui exécute l’application. Effacer les cookies peut faire perdre cet accès. Une connexion externe depuis le même navigateur permet de transférer cet espace au compte.

`npm run dev` lance le site et le service de traitement ensemble. Fermer une page n’interrompt pas le traitement ; le terminal et l’ordinateur doivent rester actifs. Les parties validées sont sauvegardées pour une reprise après interruption.

## Exécution après compilation

```sh
npm run build
npm start
```

Dans un second terminal, depuis le même dossier :

```sh
node --env-file=.env.local --import tsx scripts/traiter-taches.ts
```

Le second processus est nécessaire aux générations. Cette commande charge explicitement la même configuration. Redémarrer les deux processus après une modification de configuration. Une modification de `BASE_PATH` nécessite une nouvelle compilation.

## Dépannage

| Symptôme | À vérifier |
| --- | --- |
| Erreur `node:sqlite` | Utiliser Node.js 24 : `node --version` |
| Traitement en attente | Le service de traitement doit tourner ; lire son terminal |
| Résultats factices | Mettre `IA_DEMO=0` et configurer une IA réelle |
| Ollama indisponible | Vérifier le service, son adresse et les modèles installés |
| Connexion externe refusée | Vérifier les identifiants, le retour OAuth et `COMPTES_AUTORISES` |
| Port 3000 occupé | Libérer le port, ou vérifier l’adresse annoncée et adapter `SITE_URL` |
| Photo refusée en mode local | Utiliser du texte extrait ou un fournisseur et un modèle compatibles avec les images |
