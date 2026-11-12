# Configuration des IA

Aucune clé n’est fournie. Chaque personne utilise sa propre installation Ollama ou ses propres comptes de fournisseurs. Les vraies clés restent dans `.env.local` ou `.env`, jamais dans le code ou la documentation.

## Ollama : mode Sans quota

Installer Ollama depuis son [site officiel](https://ollama.com/), démarrer son service et télécharger les modèles de l’exemple :

```sh
ollama pull qwen2.5:3b
ollama pull qwen3:4b
ollama list
```

Dans `.env.local` :

```dotenv
IA_DEMO=0
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_QCM_MODEL=qwen3:4b
```

Choisir **Sans quota** dans le site. Les modèles occupent plusieurs gigaoctets ; la durée dépend de l’ordinateur et du document. La génération n’utilise pas de quota d’API, mais utilise les ressources de la machine. Ces modèles sont configurés pour du texte, pas pour lire directement des photos.

Les QCM sont générés et sauvegardés question par question. Le pourcentage correspond aux questions validées, pas à un temps restant estimé. Les contrôles comparent les réponses aux extraits ; un énoncé peut devenir un passage exact à compléter. Une relecture pédagogique reste utile, notamment pour des questions de raisonnement avancé.

## API externes : mode Rapide

Mettre `IA_DEMO=0` et renseigner uniquement les fournisseurs souhaités. Les variables sont présentes, vides, dans `.env.example` :

| Fournisseur | Variables |
| --- | --- |
| Gemini | `GEMINI_API_KEY` |
| Grok | `GROK_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN` |
| Serveur compatible OpenAI | `IA_COMPAT_URL`, `IA_COMPAT_MODEL`, éventuellement `IA_COMPAT_KEY` |

`IA_ORDRE` définit l’ordre d’essai, par exemple `gemini,ollama`. Ajouter `compat` pour le serveur compatible. Les fournisseurs sans clé sont ignorés. Les modèles peuvent être personnalisés avec les variables correspondantes de l’exemple ; une valeur vide utilise le défaut du code. Vérifier leur disponibilité et les conditions d’utilisation dans son propre compte fournisseur. Aucun crédit ni accès n’est inclus.

Le mode Rapide transmet les données nécessaires au fournisseur utilisé et peut se rabattre sur Ollama. Le mode Sans quota ne se rabat pas sur une API externe. Si `IA_DEMO=1`, les résultats restent factices quel que soit le mode choisi.

## Essais réels sur de longs cours

Le benchmark appelle réellement Ollama et conserve des extraits. Utiliser un dossier de sortie privé hors du dépôt :

```sh
node --import tsx scripts/bench-ollama.ts /chemin/cours.txt /dossier-prive/resultat.json 20 qwen3:4b
```

Adapter les chemins à son ordinateur. Le script accepte au maximum 30 questions et conserve les points de reprise près du résultat. Utiliser un nouveau chemin de résultat pour mesurer une génération neuve. Ne pas publier les résultats ni les réponses brutes des cours personnels.
