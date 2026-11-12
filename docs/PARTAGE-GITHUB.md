# Partager le projet sur GitHub

## Fichiers à envoyer

Partager le code, les tests, les illustrations publiques, les fichiers Markdown, `package.json`, `package-lock.json` et **`.env.example` avec ses secrets vides**.

Le `.env` demandé est fourni vide dans le dossier local. Git l’ignore volontairement : lorsqu’il sera rempli, ses clés doivent rester privées. `.env.example` transmet les mêmes noms de variables aux personnes qui téléchargent les sources ; `npm run setup` crée leur configuration locale.

## Premier envoi

```sh
npm run check:share
git init
git add .
git status --short
git diff --cached --stat
```

Examiner les fichiers sélectionnés. Il ne doit pas y avoir de configuration remplie, clé privée, base SQLite, cours personnel, sauvegarde ni journal de génération. Ne pas forcer l’ajout de fichiers ignorés avec `git add -f`.

Quand la sélection est correcte :

```sh
git commit -m "Prépare l’application de révision"
```

Créer un dépôt vide sur GitHub et suivre les commandes affichées pour ajouter son adresse et pousser ce commit. Aucun script du projet ne publie automatiquement sur GitHub.

Un dépôt public peut être téléchargé par tous ; un dépôt privé nécessite de donner accès au destinataire. Il peut ensuite utiliser **Code → Download ZIP** ou `git clone` et suivre le README.

## Contrôle automatique

`npm run check:share` cherche certains formats de secrets, vérifie les valeurs sensibles de l’exemple et inspecte les fichiers partageables. Dans un dépôt Git, il signale aussi les fichiers privés déjà suivis : `.gitignore` ne retire pas les anciens commits.

Ce contrôle ne garantit pas l’absence absolue de secret. Si une clé a déjà été publiée, la révoquer chez son fournisseur et la remplacer ; supprimer le dernier fichier ne suffit pas.

## Archive facultative

```sh
npm run pack:share
```

Le script vérifie les fichiers puis crée `revision-qcm-sources.zip` **à côté** du dossier du projet. Il inclut les sources, tests, documentation et fichiers publics autorisés, sans dépendances installées, données ni fichiers compilés. Le `.env` est inclus uniquement si toutes ses valeurs sont vides ; `.env.example` est toujours inclus. Le destinataire extrait l’archive puis suit le README.
