# Contribuer

Installer avec `npm ci`, configurer avec `npm run setup`, puis lancer `npm run dev`. Utiliser des cours fictifs pour les exemples partagés.

Avant de proposer une modification :

```sh
npm test
npm run build
npm run typecheck
npm run check:share
```

Les tests doivent utiliser une base temporaire et des réponses simulées pour les API. Les essais réels d’Ollama restent explicites et séparés. Ne pas partager les données d’une installation comme fixtures.

Les consignes de génération sont dans `lib/consignes-ia.ts`. Les formats sont vérifiés dans `lib/quiz.ts`, `lib/fiche.ts` et `lib/controle.ts`. Le service est lancé par `scripts/traiter-taches.ts` ; sa logique métier est dans `lib/traiter-taches.ts`.

Ne pas ajouter de domaine privé, chemin personnel, clé ou réglage propre à une machine au code partagé. Utiliser les variables d’environnement et documenter leurs noms dans `.env.example`, sans secret.
