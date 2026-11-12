# Révision QCM

Une application de révision au style cahier à carreaux : importer ses cours, créer des fiches et des QCM, réviser avec des cartes mémoire et préparer des contrôles.

Les données sont enregistrées sur l’ordinateur qui lance l’application, dans `data/`. Les sources partagées ne contiennent ni cours personnels, ni clés d’API, ni configuration d’un serveur existant.

## Démarrage rapide

Installer **Node.js 24** et npm, télécharger le projet ou cloner le dépôt, puis ouvrir un terminal dans son dossier :

```sh
npm ci
npm run setup
npm run dev
```

Ouvrir <http://localhost:3000> et choisir **Continuer sans compte**. Garder le terminal ouvert : il lance le site et le service de traitement.

Le démarrage utilise le **mode démo**, sans compte externe ni clé d’API. Les réponses sont factices et servent à découvrir l’interface. Pour une vraie analyse de ses cours, configurer Ollama ou une API, puis mettre `IA_DEMO=0`.

`npm run setup` crée `.env.local` avec un secret de connexion aléatoire propre à l’installation. Il ne remplace pas ce fichier s’il existe. Un `.env` vide est fourni dans le dossier local ; `.env.example` est le modèle destiné à GitHub. Ne jamais publier un fichier de configuration rempli.

## Fonctionnalités

- Import de PDF, Word, PowerPoint, LibreOffice, RTF, texte, images et pages web.
- Fiches avec illustrations, historique, retouches et exports Word ou Markdown.
- QCM avec correction, explications, extraits et signalement des questions.
- Cartes mémoire et révisions espacées.
- Contrôles avec plusieurs types de questions, correction et impression.
- Traitements persistants, progression et reprise des parties validées.
- Accès sans compte ; connexions Google et Discord facultatives.

## Documentation

- [Installation et dépannage](docs/INSTALLATION.md)
- [Configuration des IA et Ollama](docs/CONFIGURATION-IA.md)
- [Connexions Google et Discord](docs/CONNEXIONS.md)
- [Préparer le partage GitHub](docs/PARTAGE-GITHUB.md)
- [Contribuer](docs/CONTRIBUER.md)

## Vérifications

```sh
npm test
npm run build
npm run typecheck
npm run check:share
```

La compilation génère les types Next.js nécessaires à une vérification TypeScript sur une installation neuve. Les tests automatisés ne consomment pas de quota d’API.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `app/` | Pages et routes API Next.js |
| `components/` | Interface et formulaires |
| `lib/` | SQLite, formats, IA, comptes et traitements |
| `scripts/` | Configuration locale, lancement, benchmark et contrôle du partage |
| `tests/` | Tests automatisés |
| `public/` | Illustrations publiques |
| `docs/` | Guides d’installation et de contribution |

Le projet utilise Next.js, React, TypeScript et SQLite intégré à Node.js. Fermer une page n’arrête pas une génération ; fermer le service de traitement ou éteindre l’ordinateur l’interrompt jusqu’à la reprise.
