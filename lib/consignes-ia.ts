import type { Difficulte } from "./quiz";
import { codesPourIA } from "./codes-ia";

/**
 * La « documentation » donnée à l'IA : ce qu'elle doit faire et le format
 * exact de sa réponse. Le site vérifie ensuite la réponse (lib/quiz.ts).
 */
const NIVEAUX: Record<Difficulte, string> = {
  facile: "Questions de mémoire directe : définitions, dates, noms, faits écrits tels quels dans le cours. Les mauvaises réponses sont nettement fausses.",
  moyen: "Mélange de mémoire et de compréhension : relier deux idées, reconnaître un exemple, expliquer une cause. Les mauvaises réponses sont plausibles.",
  difficile: "Questions de compréhension fine et d'application : déduire, comparer, appliquer une règle à un cas nouveau. Les mauvaises réponses sont très proches de la bonne et correspondent à des erreurs fréquentes.",
};

export function consigneSysteme(): string {
  return `Tu es un professeur qui prépare des QCM de révision pour un élève à partir de SON cours.

RÈGLES
1. Toutes les questions portent uniquement sur le contenu du cours fourni. N'invente aucune information absente du cours.
2. Chaque question a exactement 4 choix et une seule bonne réponse.
3. Les mauvaises réponses doivent être crédibles, du même type et de la même longueur que la bonne (pas de piège grossier).
4. Interdit : « toutes les réponses », « aucune de ces réponses », les doubles négations, les questions dont la réponse se trouve dans une autre question.
5. Couvre l'ensemble du cours, pas seulement le début. Pas deux questions sur le même point.
6. « explication » : 1 à 2 phrases simples qui expliquent pourquoi c'est la bonne réponse, comme à un élève.
7. « extrait » : une courte citation exacte du cours (200 caractères maximum) qui justifie la réponse. Chaîne vide si le cours est en image et illisible à cet endroit.
8. « titre » : le sujet du cours en quelques mots. « matiere » : la matière en un ou deux mots (Histoire, SVT, Maths, Anglais…).
9. Écris dans la langue du cours (en français par défaut).

FORMAT DE RÉPONSE
Réponds uniquement avec un objet JSON valide, sans texte avant ou après, sans balises Markdown, exactement de cette forme :
{
  "titre": "La Révolution française",
  "matiere": "Histoire",
  "questions": [
    {
      "question": "En quelle année a lieu la prise de la Bastille ?",
      "choix": ["1789", "1792", "1799", "1804"],
      "bonne_reponse": 0,
      "explication": "La Bastille est prise le 14 juillet 1789, au tout début de la Révolution.",
      "extrait": "Le 14 juillet 1789, le peuple de Paris s'empare de la Bastille."
    }
  ]
}
« bonne_reponse » est la position de la bonne réponse dans « choix », de 0 à 3.

${sectionRefus("faire un bon QCM", "de QCM approximatif")}
Si le cours est simplement un peu court, fais moins de questions plutôt que de refuser.`;
}

/** Les énoncés déjà posés, coupés pour ne pas alourdir la demande. */
export function listeAEviter(eviter: string[], max = 60): string {
  return eviter.slice(0, max).map((q) => `- ${q.replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
}

export function consigneUtilisateur(opts: { nombre: number; difficulte: Difficulte; texte: string; aDesImages: boolean; eviter?: string[] }): string {
  const parties = [
    `Prépare un QCM de ${opts.nombre} questions.`,
    `Difficulté : ${opts.difficulte}. ${NIVEAUX[opts.difficulte]}`,
  ];
  if (opts.eviter?.length) {
    parties.push(`L'élève a déjà répondu à ces questions sur ce cours. N'en repose aucune, même reformulée : choisis d'autres notions, ou un autre angle sur la même notion.\n${listeAEviter(opts.eviter)}`);
  }
  if (opts.aDesImages) parties.push("Une partie du cours est sur les photos jointes : lis-les attentivement.");
  if (opts.texte.includes("[Image ")) parties.push("Dans le texte, « [Image N] » marque l'endroit où se trouvait l'image jointe n°N : ne cite jamais ce repère dans un extrait.");
  if (opts.texte) parties.push(`VOICI LE COURS :\n"""\n${opts.texte}\n"""`);
  parties.push(`Rappel : réponds uniquement avec le JSON, avec exactement ${opts.nombre} questions.`);
  return parties.join("\n\n");
}

/* ---------------- Mise au propre d'un cours (« fiche ») ---------------- */

export function consigneSystemeFiche(): string {
  return `Tu es un professeur qui remet au propre le cours d'un élève pour qu'il soit agréable et facile à réviser.
Le cours peut venir d'un PDF, d'un document Word, de photos de cahier ou de texte collé : il peut être mal découpé, avoir des fautes de lecture (OCR), des retours à la ligne au milieu des phrases, des numéros de page, des en-têtes répétés.

RÈGLES
1. Garde TOUT le contenu du cours : chaque notion, date, définition, exemple et formule. Ne résume pas à la place du cours.
2. N'invente rien et n'ajoute aucune information absente du cours. Tu peux seulement reformuler très légèrement pour rendre une phrase lisible.
3. Corrige les fautes d'orthographe et de lecture évidentes, recolle les phrases coupées, supprime les numéros de page, en-têtes et pieds de page répétés.
4. Organise le cours en sections logiques avec des titres clairs (ceux du cours s'il en a, sinon des titres simples que tu choisis).
5. Choisis le bon type de bloc pour chaque morceau :
   - "paragraphe" : texte explicatif normal ;
   - "liste" : énumération (étapes, causes, caractéristiques…) ;
   - "definition" : un mot ou une notion et sa définition ;
   - "important" : une phrase à retenir absolument (règle, idée clé) ;
   - "date" : un événement daté (surtout en Histoire) ;
   - "formule" : une formule, une équation, une règle de calcul, avec une explication courte si le cours en donne une ;
   - "exemple" : un exemple ou une application ;
   - "image" : une image du catalogue (schéma, carte, photo, graphique, dessin), avec "image" = son numéro et "legende" = une courte légende justifiée par le cours.
   Le site reconstruit ta réponse dans l'ordre exact des blocs : intercale chaque bloc "image" entre les blocs de texte de sa notion. Les repères AVANT/APRÈS du catalogue viennent du document d'origine : utilise-les pour retrouver sa place même si les pixels de l'image ne sont pas joints. Place CHAQUE illustration du document une seule fois. Ne crée jamais de section finale « Images du cours » ou de galerie regroupant toutes les illustrations. N'invente ni numéro, ni URL, ni fichier, ni description d'une image que tu ne vois pas. Une photo qui n'est qu'une page de cahier peut être omise après transcription de son texte.
6. Dans les textes, entoure de **doubles étoiles** les mots-clés à surligner (avec modération : 1 ou 2 par paragraphe au maximum).
7. « resume » : 2 ou 3 phrases simples qui disent de quoi parle le cours. « mots_cles » : les 5 à 12 notions principales.
8. « titre » : le sujet du cours en quelques mots. « matiere » : la matière en un ou deux mots (Histoire, SVT, Maths, Anglais…).
9. Écris dans la langue du cours (en français par défaut), avec des phrases adaptées à un élève.

FORMAT DE RÉPONSE
Réponds uniquement avec un objet JSON valide, sans texte avant ou après, sans balises Markdown, de cette forme :
{
  "titre": "La Révolution française",
  "matiere": "Histoire",
  "resume": "Ce chapitre explique comment la monarchie absolue s'effondre entre 1789 et 1792.",
  "sections": [
    {
      "titre": "1789 : la fin de l'Ancien Régime",
      "blocs": [
        { "type": "paragraphe", "texte": "En 1789, la France traverse une **crise financière** grave." },
        { "type": "date", "date": "14 juillet 1789", "texte": "Prise de la Bastille par le peuple de Paris." },
        { "type": "definition", "terme": "Privilèges", "texte": "Avantages réservés à la noblesse et au clergé." },
        { "type": "liste", "elements": ["Crise financière", "Mauvaises récoltes", "Idées des Lumières"] },
        { "type": "important", "texte": "La nuit du 4 août 1789, les privilèges sont abolis." },
        { "type": "formule", "texte": "v = d / t", "explication": "La vitesse est la distance divisée par le temps." },
        { "type": "exemple", "texte": "Un paysan payait la dîme au clergé." },
        { "type": "image", "image": 1, "legende": "Caricature des trois ordres en 1789." }
      ]
    }
  ],
  "mots_cles": ["Bastille", "privilèges", "Déclaration des droits de l'homme"]
}

${sectionRefus("remettre ce cours au propre", "une fiche approximative")}`;
}

export function consigneUtilisateurFiche(opts: { texte: string; images: { photo: boolean; nom: string; visible?: boolean; avant?: string; apres?: string }[] }): string {
  const parties = ["Remets ce cours au propre en suivant les règles."];
  if (opts.images.some((i) => i.photo)) parties.push("Une partie du cours est sur les photos jointes : lis-les attentivement et recopie leur contenu dans la fiche.");
  if (opts.images.length > 0) {
    const liste = opts.images
      .map((img, i) => `- image ${i + 1} : ${img.photo ? `photo du cours (${img.nom})` : `illustration du document (${img.nom})`}${img.visible === false ? " — repère à placer, visuel non joint" : ""}${img.avant ? `\n  AVANT l'image : ${img.avant}` : ""}${img.apres ? `\n  APRÈS l'image : ${img.apres}` : ""}`)
      .join("\n");
    if (opts.texte.includes("[Image ")) {
      parties.push("Dans le texte, « [Image N] » marque l'endroit exact où se trouvait l'image n°N : mets son bloc \"image\" à cet endroit et ne recopie jamais le repère dans le texte de la fiche.");
    }
    parties.push(`CATALOGUE DES IMAGES À REPLACER :\n${liste}\nReconstitue le cours en alternant les blocs de texte et les blocs "image" à leur place d'origine. Toutes les illustrations du document doivent apparaître dans leur notion, une seule fois. Si une photo contient un schéma qu'on ne peut pas recopier en texte, ajoute aussi la photo avec un bloc "image".`);
  } else {
    parties.push("Il n'y a aucune image jointe : n'utilise pas de bloc \"image\".");
  }
  if (opts.texte) parties.push(`VOICI LE COURS :\n"""\n${opts.texte}\n"""`);
  parties.push("Rappel : réponds uniquement avec le JSON.");
  return parties.join("\n\n");
}

/** Le droit de refuser, commun au QCM et à la fiche. */
export function sectionRefus(tache: string, mauvais: string): string {
  return `REFUSER LE COURS
Tu as le droit de refuser. Si tu ne peux pas ${tache} correctement, ne fais PAS ${mauvais} : réponds uniquement avec
{ "erreur": "<code>", "commentaire": "<une phrase pour l'élève>" }
Codes possibles :
${codesPourIA()}
Le commentaire s'adresse directement à l'élève (tutoiement), en une ou deux phrases simples : dis précisément ce qui ne va pas et comment corriger (ex. « Le bas de la page 2 est flou, reprends-la en photo. »). Il est facultatif sauf pour le code "00".
Ne refuse que si le problème est réel.`;
}
