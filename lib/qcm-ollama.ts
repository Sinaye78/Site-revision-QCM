import { createHash } from "node:crypto";
import { z } from "zod";
import { repondreOllama } from "./ollama";
import { QuestionSchema, QuizSchema, type Difficulte, type Question, type Quiz } from "./quiz";
import type { ExecutionIA } from "./taches-types";

const PropositionSchema = QuestionSchema.omit({ explication: true });
const FORMAT_QUESTION = {
  type: "object", properties: {
    question: { type: "string" },
    choix: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
  }, required: ["question", "choix"], additionalProperties: false,
};
export function normaliserCitation(s: string): string {
  return s.replace(/(?<!\d)[−–-](?=\s*\d)/g, " moins ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function contientReponse(citation: string, reponse: string): boolean {
  const source = citation.split(" "), cible = reponse.split(" ");
  return source.some((_, i) => !(source[i - 1] === "moins" && /^\d/.test(cible[0])) && cible.every((m, j) => source[i + j] === m));
}
const MOTS_QUESTION = new Set("qui quel quelle quels quelles quand comment pourquoi combien quoi est sont etait etaient ete etant serait seraient avoir avait avaient faire fait faire font faite faites dans pour avec entre apres avant selon cours texte extrait phrase indique indiquee cite citee mentionne mentionnee designe designee correspond correspondant signifie definition definir terme termes notion notions concept concepts nom noms date dates annee annees periode periodes lieu lieux pays continent espece exemple exemples fonction role caracterise caracteristique acte signifie propos sujet concerne concernant permet permis rapporte explique decrit decrite citees citer identifier identifie information informations retrouve retrouver expression expressions appelle appele appelee sens correspondre representer represente representee parle parler suivant suivante suivants suivantes proposition propositions reponse reponses manque manquant associe associer associee partir trouve trouver trouvee voit voir".split(" "));
class EnonceHorsSource extends Error {}
function verifierEnonce(question: string, passage: string) {
  const grammaire = new Set("elle elles nous vous eux ceux celles celle celui cela ceci cette ces leur leurs notre nos votre vos avec dans sous depuis durant pendant lorsque lesquels lesquelles auquel laquelle dont ainsi afin aussi parmi forme formes facon maniere type types fois pour que donc mais car comme parce etait etaient etre peut peuvent doit doivent correspondrait peuvent pourrait pourraient fait font faisaient avoir avait avaient avait auront aurait seraient estce existe existent existait existante exister identifie identifient utilise utilisee utilisees utilises utiliser se nomme nommee nommes nommer donne donnee donnees donnes donner".split(" "));
  const mots = normaliserCitation(question).split(" "), source = new Set(normaliserCitation(passage).split(" "));
  const ajouts = mots.filter(m => /^(pas|sans|jamais|aucun|aucune|uniquement|seulement|toujours|tous|toutes|chaque|exclusivement|necessairement)$/.test(m) && !source.has(m));
  const horsSource = mots.filter(m => m.length >= 4 && !MOTS_QUESTION.has(m) && !grammaire.has(m) && !/^(capacite|aptitude|action|processus|phenomene|pratique|technique|complete|mots|exacts|exacte|exactement)$/.test(m) && ![...source].some(s => s === m || (s.length >= 5 && m.length >= 5 && s.slice(0, 5) === m.slice(0, 5))));
  if (ajouts.length || horsSource.length) throw new EnonceHorsSource(`L’énoncé ajoute des mots absents du fait : ${[...new Set([...ajouts, ...horsSource])].slice(0, 5).join(", ")}. Reprends uniquement les mots du fait et une formule interrogative simple.`);
}
function estConsigne(s: string): boolean {
  const texte = normaliserCitation(s);
  if (/\b(?:cahier|brouillon|enseignant|enseignante|questionnaire|vous|votre|vos|nous|notre|nos)\b|\b(?:page de garde|prendre la correction|chaque affiche|affiche devra contenir|titre visible de loin)\b/.test(texte)) return true;
  return /^(?:(?:nous|vous|je|tu|notre|nos|votre|vos|activite)\b|(?:ne |n )?(?:les |le |la )?(?:recopi\w*|copi\w*|ecri\w*|soulig\w*|encadr\w*|colori\w*|redige\w*|realise\w*|lire|lis\w*|regard\w*|trace\w*|entour\w*|utilis\w*|oubli\w*|observe\w*|analyse\w*|complete\w*|compare\w*|justifie\w*|repond\w*|decri\w*|saute\w*|munis\w*|present\w*|choisis\w*|colle\w*)\b|a ton avis|selon vous|quoi qu il en soit)/.test(texte);
}
const ETIQUETTES_PLAN = new Set("principe application solution correction conclusion remarque source sources lexique savoirs questions activite attention note mission dossier session".split(" "));
function termeDefinition(s: string): string {
  const terme = s.split("/")[0].trim().replace(/^[\s•*-]+/, "").replace(/^(?:le|la|les|un|une)\s+/i, "");
  const n = normaliserCitation(terme), mots = n.split(" ").filter(m => !/^(?:de|du|des|d|l|en|a|au|aux|le|la|les)$/.test(m));
  return n.length >= 3 && mots.length <= 3 && /[a-z]/.test(n) && !estConsigne(terme) && !ETIQUETTES_PLAN.has(n) && !/^(?:application au cas|en principe|en droit|en fait)$/.test(n) && !/\b(?:est|sont|doit|devra|peut|contient|sera|seront|explicitant)\b/.test(n) && !/^(?:doc|document|seance)\s*\d/.test(n) ? terme : "";
}

/** Masquer des mots attestés conserve exactement le sens du fait, même avec les retours de ligne du PDF. */
export function questionATrou(passage: string, reponse: string): string {
  const tokens: { mot: string; debut: number; fin: number }[] = [];
  for (const m of passage.matchAll(/[\p{L}\p{N}]+/gu)) {
    const avant = passage.slice(0, m.index!); const signe = /^\d/.test(m[0]) ? avant.match(/(?<!\d)[−–-]\s*$/) : null;
    if (signe) tokens.push({ mot: "moins", debut: signe.index!, fin: m.index! + m[0].length });
    tokens.push({ mot: normaliserCitation(m[0]), debut: m.index!, fin: m.index! + m[0].length });
  }
  const cible = normaliserCitation(reponse).split(" "); const plages: [number, number][] = [];
  for (let i = 0; i <= tokens.length - cible.length; i++) {
    if (!(tokens[i - 1]?.mot === "moins" && /^\d/.test(cible[0])) && cible.every((m, j) => tokens[i + j].mot === m)) {
      const dernier = tokens[i + cible.length - 1]; plages.push([tokens[i].debut, dernier.fin]); i += cible.length - 1;
    }
  }
  if (!plages.length || cible.length > tokens.length * 0.8) throw new Error("Choisis une bonne proposition courte, copiée du fait.");
  let trou = passage;
  for (const [debut, fin] of plages.reverse()) trou = trou.slice(0, debut) + "[…]" + trou.slice(fin);
  return `Complète cet extrait du cours avec les mots exacts : « ${trou} »`;
}

/** Faits courts, répartis sur tout le cours ; les consignes de présentation sont écartées. */
export function planifierQuestions(texte: string, nombre: number): string[] {
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 30) throw new Error("Nombre de questions invalide.");
  const parties: string[] = [];
  const corrige = /\bcorrige\b/.test(normaliserCitation(texte.slice(0, 500)));
  let contenu = texte;
  if (/^(bonjour|bienvenue|salut)\b/i.test(texte.trim())) { const debut = texte.search(/^\s*\d+\s*[-–]/m); if (debut >= 0) contenu = texte.slice(debut); }
  for (const phrase of contenu.split(/(?<=[.!?])\s+|\n(?=(?:Doc(?:ument)?\.?\s*\d+|Séance\s*\d+|\d+\)|(?:En principe|En droit|En l[’']espèce)\b|(?:Principe|Application|Solution|Conclusion|Remarque)\s*:|[^\n]{0,160}\bPage\s+\d+\s*\/\s*\d+))/iu)) {
    const lignes = phrase.trim().split("\n");
    while (lignes.length && (/\bpage\s+\d+\s*\/\s*\d+\s*$/i.test(lignes[0]) || /^(?:diplome\b|ue\s*\d|session\b|elements indicatifs de corrige|dossier\s*\d|\d+(?:ere|eme|re|e)? mission\b)/.test(normaliserCitation(lignes[0])) || (lignes[0].length > 12 && lignes[0] === lignes[0].toUpperCase() && !/[=+×÷]/.test(lignes[0])))) lignes.shift();
    if (/^sur la premiere ligne|^(?:ecris|encadre|souligne).*(?:titre|cahier)/.test(normaliserCitation(lignes[0] || ""))) {
      lignes.shift(); lignes.shift();
    }
    while (lignes.length && /^(?:la frise chronologique|le lexique|savoirs|savoir faire|la planche de documents|extraits du site internet)$/.test(normaliserCitation(lignes[0]))) lignes.shift();
    let reste = lignes.join("\n").trim().replace(/^(?:(?:Doc(?:ument)?\.?\s*\d+|Séance\s*\d+)[\s:–-]*)+/iu, "").replace(/^\d{1,2}\s*\n/, "").replace(/^(?:(?:En )?(?:principe|droit|fait)|Application(?: au cas)?|Solution|Correction|Conclusion|Remarque|Attention)\s*:\s*/iu, "").replace(/^Accepter\s*/i, "");
    const finDefinition = reste.search(/\n(?:Savoirs|Savoir-faire|La planche de documents|Extraits du site|Séance\s*\d)/i);
    if (reste.includes(":") && finDefinition >= 0) reste = reste.slice(0, finDefinition).trim();
    while (reste) {
      let fin = Math.min(600, reste.length);
      if (fin < reste.length) { const espace = reste.lastIndexOf(" ", fin); if (espace > 300) fin = espace; }
      const extrait = reste.slice(0, fin).trim();
      const mots = normaliserCitation(extrait);
      const tableAmbigue = ((extrait.match(/\d+(?:[.,]\d+)?/g) || []).length >= 3 && /\d\s*\/\s*\d/.test(extrait) && !/\b(?:est|vaut|egal|represente)\b|=/.test(mots)) || /\b(?:[A-Z]{2,4}\s+){2,}[A-Z]{2,4}\b/.test(extrait);
      const assertion = /\b(?:est|sont|ete|etait|etaient|sera|seront|soit|doit|doivent|peut|peuvent|pourra|pourront|ont|convient|utilis\w*|permet\w*|rend\w*|signif\w*|prouv\w*|annonc\w*|decouv\w*|debut\w*|sedentari\w*|viv\w*|represent\w*|relev\w*|depend\w*|acquier\w*|attei\w*|pes\w*)\b|=/.test(mots) || Boolean(termeDefinition(extrait.match(/^([^\n:]{2,80})\s*:/)?.[1] || ""));
      const instructionCorrige = corrige && (!assertion || /\b(?:faux|apporter|explicitant)\b|ne pas penaliser|^euros\b/.test(mots));
      if (mots.length >= 25 && !tableAmbigue && !instructionCorrige && !estConsigne(extrait) && !/^illustration\b/.test(mots) && !extrait.endsWith("?") && !/https?:\/\/|www\./i.test(extrait)) parties.push(extrait);
      reste = reste.slice(fin).trim();
    }
  }
  if (!parties.length) throw new ErreurQcmLocal("Le texte contient trop peu de phrases exploitables pour créer un QCM local.");
  return Array.from({ length: nombre }, (_, i) => parties[nombre === 1 ? Math.floor(parties.length / 2) : Math.round(i * (parties.length - 1) / (nombre - 1))]);
}

/** Valider le fond vérifiable sans faire corriger ou inventer une réponse par le site. */
export function verifierQuestionLocale(brut: unknown, passage: string, precedentes: Question[], dejaPosees: string[] = []): Question {
  const q = PropositionSchema.parse(brut);
  if (estConsigne(q.extrait)) throw new Error("Le passage est une consigne d’exercice, pas une connaissance du cours.");
  const enonceType = normaliserCitation(q.question), reponseType = normaliserCitation(q.choix[q.bonne_reponse]);
  if (/\d/.test(reponseType) && /^(qui\b)|\b(?:quel (?:nom|terme|metier|pays|objet|outil)|quelle (?:espece|notion|matiere|personne|technique))\b/.test(enonceType)) throw new EnonceHorsSource("La question demande une notion ou un nom, mais la réponse est un nombre.");
  if (!/\d|\b(?:zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|cent|mille)\b/.test(reponseType) && /\b(?:quelle annee|quelle date|combien)\b/.test(enonceType)) throw new EnonceHorsSource("La question demande un nombre ou une date, mais la réponse est un terme.");
  verifierEnonce(q.question, passage);
  const citation = normaliserCitation(q.extrait), source = normaliserCitation(passage);
  const choix = q.choix.map(normaliserCitation);
  if (normaliserCitation(q.question).length < 10) throw new Error("Formule une vraie question sur le cours.");
  if (choix.some(c => !c || /^[abcd]$/.test(c)) || new Set(choix).size !== 4) throw new Error("Les quatre propositions doivent être réelles et différentes, pas A, B, C, D.");
  for (let a = 0; a < choix.length; a++) for (let b = a + 1; b < choix.length; b++) {
    if (/\d/.test(choix[a]) && /\d/.test(choix[b])) continue; // Dates et quantités peuvent légitimement différer d'un chiffre.
    const motsUtiles = (s: string) => s.split(" ").filter(m => !/^(le|la|les|un|une|des|du|de|d|l|a|au|aux|sur|ses|son|sa|se|s|et)$/.test(m));
    const x = new Set(motsUtiles(choix[a])), y = new Set(motsUtiles(choix[b]));
    const communs = [...x].filter(m => y.has(m)).length;
    const union = new Set([...x, ...y]).size;
    if (union > 0 && communs * 2 >= union) throw new Error("Deux propositions sont trop proches et risquent d’être équivalentes. Crée des réponses nettement distinctes, sans synonymes de la bonne réponse.");
  }
  if (citation.length < 15 || citation.length > 700 || !source.includes(citation)) throw new Error("extrait doit citer mot pour mot une phrase du passage, sans ajouter de fait (700 caractères maximum).");
  if (!contientReponse(citation, choix[q.bonne_reponse])) throw new Error("La bonne proposition doit reprendre des mots présents dans extrait, en conservant le signe des nombres.");
  if (/[=×÷+*/]/.test(q.choix[q.bonne_reponse]) && !q.extrait.replace(/\s/g, "").includes(q.choix[q.bonne_reponse].replace(/\s/g, ""))) throw new Error("La formule doit être copiée avec les mêmes opérateurs que le cours.");
  if (/\b(environ|vers|approximativement)\b/.test(citation)) {
    const valeur = (s: string) => { const n = s.match(/^(?:[-−–]\s*)?(?:\d{1,3}(?:\s\d{3})+|\d+)(?:[.,]\d+)?/); return n ? Number(n[0].replace(/\s/g, "").replace(/[−–]/g, "-").replace(",", ".")) : NaN; };
    const bonne = valeur(q.choix[q.bonne_reponse]);
    if (Math.abs(bonne) >= 1000 && q.choix.some((c, index) => index !== q.bonne_reponse && Math.abs(valeur(c) - bonne) < Math.abs(bonne) * 0.05)) throw new Error("Les dates ou quantités approximatives proposées sont trop proches. Utilise des valeurs nettement distinctes.");
  }
  const enonce = normaliserCitation(q.question);
  if (precedentes.some(p => normaliserCitation(p.question) === enonce) || dejaPosees.some(d => normaliserCitation(d) === enonce)) throw new Error("Cette question existe déjà. Choisis une autre information du passage.");
  // Le justificatif cite le cours : le modèle ne peut pas y mélanger deux faits distincts.
  return QuestionSchema.parse({ ...q, explication: `Le cours indique : « ${q.extrait} ».` });
}

export class ErreurQcmLocal extends Error {}
function renouvelerChoix(choix: string[], citation: string, vocabulaire: string[], index: number): string[] {
  const bonne = choix[0];
  const notion = vocabulaire.find(t => normaliserCitation(t) === normaliserCitation(bonne).replace(/^(?:le|la|les|un|une) /, ""));
  if (notion && vocabulaire.length >= 4) {
    const autres = vocabulaire.filter(t => normaliserCitation(t) !== normaliserCitation(notion));
    return [bonne, ...Array.from({ length: 3 }, (_, j) => autres[(index + j) % autres.length])];
  }
  const chiffre = bonne.match(/^(?:[-−–]\s*)?(?:\d{1,3}(?:\s\d{3})+|\d+)(?:[.,]\d+)?/)?.[0];
  if (!chiffre) return choix;
  const n = Number(chiffre.replace(",", ".").replace(/[−–]/g, "-").replace(/\s/g, ""));
  const absolu = Math.abs(n), approximatif = /\b(environ|vers|approximativement)\b/.test(normaliserCitation(citation));
  const pas = absolu < 10 ? 1 : absolu < 100 ? 5 : absolu >= 10000 || (approximatif && absolu >= 1000) ? Math.max(10, Math.round(absolu / 2)) : n < 0 && absolu >= 1000 ? Math.round(absolu / 5) : 10;
  const nombres = [n + pas, n + pas * 2, n < 0 || n >= pas ? n - pas : n + pas * 3];
  return [bonne, ...nombres.map(v => (/\d\s\d/.test(chiffre) ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v) : String(Math.round(v * 100) / 100).replace(".", chiffre.includes(",") ? "," : ".")) + bonne.slice(chiffre.length))];
}
export async function genererQcmOllama(url: string, modele: string, opts: {
  texte: string; nombre: number; difficulte: Difficulte; titre?: string; matiere?: string; eviter?: string[]; _secours?: boolean;
} & ExecutionIA): Promise<Quiz> {
  const eviter = (opts.eviter ?? []).slice(0, 40);
  const vocabulaire = [...new Map([...opts.texte.matchAll(/^([^\n:]{2,80})[ \t]*:[ \t]*.{8,}/gm)].map(m => {
    const terme = termeDefinition(m[1]); return [normaliserCitation(terme), terme] as const;
  })).values()].filter(Boolean);
  const empreinteSource = createHash("sha256").update(opts.texte).digest("hex");
  const passages = planifierQuestions(opts.texte, opts.nombre);
  const questions: Question[] = [];
  const systeme = "Tu es un professeur français. Crée UNE question précise sur le FAIT fourni. choix[0] est la bonne réponse : une courte expression copiée exactement du fait. Les trois autres propositions doivent répondre à la même question, mais être nettement fausses et parler de notions différentes. Utilise quatre dates, quatre noms, quatre lieux ou quatre notions selon la question. Pour une définition, donne la définition dans la question et fais retrouver son terme. Les quatre propositions doivent être distinctes et incompatibles. Le texte de la question ne doit pas révéler la bonne réponse. Réponds uniquement avec le JSON contenant question et choix.";
  for (let i = 0; i < passages.length; i++) {
    const passage = passages[i];
    const definition = passage.match(/^([^\n:]{2,80})\s*:\s*.{8,}/s);
    const terme = definition ? termeDefinition(definition[1]) : "";
    let nombreSource = passage.match(/(?<![\p{L}\p{N}])(?:[-−–]\s*)?(?:\d{1,3}(?:\s\d{3})+|\d+)(?:[.,]\d+)?(?:\s*(?:millions?|milliards?)\s*d[’']années)?/iu)?.[0] || "";
    if (/\b(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/.test(normaliserCitation(passage))) nombreSource = passage.match(/(?<!\d)(?:[-−–]\s*)?\d{4}(?!\d)/)?.[0] || nombreSource;
    if (/\d\s*\/\s*\d/.test(passage)) nombreSource = ""; // Ne pas transformer un coefficient ou une date complète en simple numérateur.
    const noms = [...passage.matchAll(/[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}){0,5}/g)].map(m => m[0]).filter(n => !/^(les|des|une|dans|pour|cette|ces|vieux|decouvert|decouverte|extraits|ensuite|puis|certains|leurs|leur|elles|nous|vous|eux|ceux|cela|ceci|document|documents|question|questions|source|sources|sur|avec|sans|selon|alors|lorsque|comme)$/i.test(normaliserCitation(n)));
    const cible = (terme || nombreSource || noms.find(n => !/ment$/i.test(normaliserCitation(n))) || "").replace(/\s+/g, " ");
    // Le passage précède les éléments variables pour permettre la réutilisation du cache de prompt natif.
    const consigne = `FAIT DU COURS :\n${passage}\nFIN DU FAIT.\nQuestion ${i + 1}/${opts.nombre}, difficulté ${opts.difficulte}.${cible ? `\nFais retrouver ${terme ? "le terme" : "l’information"} « ${cible} » à partir du fait. choix[0] doit être exactement « ${cible} ». Ne donne pas cette réponse dans la question.` : "\nLa bonne proposition doit être courte (huit mots maximum)."}\nQuestions déjà créées à éviter : ${[...eviter, ...questions.map(q => q.question)].map(q => q.slice(0, 96)).join(" | ")}\nStructure : {"question":"Question précise sur le fait ?","choix":["Courte expression EXACTE du fait","Réponse fausse plausible","Réponse fausse plausible","Réponse fausse plausible"]}`;
    const hash = createHash("sha256").update(`qcm-local-v10:${empreinteSource}:${modele}:${systeme}:${consigne}`).digest("hex");
    const execution: ExecutionIA = { ...opts, suivi: a => opts.suivi?.({ ...a, unite: "question", partiesFaites: i, partiesTotal: opts.nombre }) };
    opts.signal?.throwIfAborted();
    opts.suivi?.({ fournisseur: "Ollama", phase: "lecture", unite: "question", partiesFaites: i, partiesTotal: opts.nombre });
    let question: Question | undefined;
    const sauvegarde = opts.reprise?.lire(i, hash);
    if (sauvegarde) {
      try {
        const precedente = QuestionSchema.parse(sauvegarde);
        question = verifierQuestionLocale({ ...precedente, choix: renouvelerChoix(precedente.choix, precedente.extrait, vocabulaire, i) }, opts.texte, questions, eviter);
      } catch { /* Reprendre seulement les réponses encore valides. */ }
    }
    let probleme = "";
    let cibleImposee = cible;
    const autresTermes = vocabulaire.filter(t => normaliserCitation(t) !== normaliserCitation(terme));
    if (!question && terme && autresTermes.length >= 3) {
      const definition = passage.slice(passage.indexOf(":") + 1).trim();
      if (!normaliserCitation(definition).includes(normaliserCitation(terme))) {
        for (let decalage = 0; !question && decalage < autresTermes.length; decalage++) {
          try { question = verifierQuestionLocale({ question: `Quelle notion correspond à cette définition du cours : « ${definition} » ?`, choix: [terme, ...Array.from({ length: 3 }, (_, j) => autresTermes[(i + decalage + j) % autresTermes.length])], bonne_reponse: 0, extrait: passage }, passage, questions, eviter); }
          catch { /* Essayer un autre trio de termes réels avant de demander au modèle. */ }
        }
      }
    }
    for (let essai = 0; !question && essai < 3; essai++) {
      try {
        const choixConnus = cibleImposee ? renouvelerChoix([cibleImposee, "", "", ""], passage, vocabulaire, i) : [];
        const questionSeule = choixConnus.length === 4 && choixConnus.every(c => c.trim()) && new Set(choixConnus).size === 4;
        // Le préfixe grandit à la fin : Ollama peut réutiliser l'historique déjà évalué.
        const demande = `Questions déjà posées à éviter : ${[...eviter, ...questions.map(q => q.question)].map(q => q.slice(0, 96)).join(" | ")}\nFAIT :\n${passage}\nRÉPONSE À FAIRE TROUVER : ${cibleImposee || "une courte expression exacte du fait"}\nÉcris une question en français, de difficulté ${opts.difficulte}, dont la réponse est exactement celle indiquée. Ne donne pas la réponse dans la question.\n` + (questionSeule ? 'JSON : {"question":"Question sur le fait ?"}' : 'JSON : {"question":"Question sur le fait ?","choix":["Réponse indiquée","Réponse fausse plausible","Réponse fausse plausible","Réponse fausse plausible"]}');
        const brut = await repondreOllama(url, modele, [{ role: "system", content: questionSeule ? "Tu formules une seule question sur le fait reçu pour faire retrouver la réponse imposée. Utilise les informations du fait, sans les modifier. Réponds uniquement en JSON avec le champ question." : systeme }, { role: "user", content: demande + (probleme ? `\nLa tentative précédente a échoué : ${probleme}. Refais une question complète sur un fait simple de ce passage.` : "") }], execution,
          { format: questionSeule ? { type: "object", properties: { question: { type: "string" } }, required: ["question"], additionalProperties: false } : FORMAT_QUESTION, contexte: 4096, maximumTokens: questionSeule ? 180 : 450, temperature: 0, graine: 42 + i * 3 + essai, ...(/^qwen3(?::|$)/.test(modele) ? { reflexion: false } : {}) });
        const proposition = JSON.parse(brut);
        if (questionSeule && proposition && typeof proposition === "object") proposition.choix = choixConnus;
        if (cibleImposee && normaliserCitation(proposition?.choix?.[0] || "") !== normaliserCitation(cibleImposee)) throw new Error(`La première proposition doit être exactement « ${cibleImposee} ».`);
        proposition.choix = renouvelerChoix(z.array(z.string()).length(4).parse(proposition.choix), passage, vocabulaire, i);
        const candidat = { ...proposition, extrait: passage, bonne_reponse: 0 };
        if (!terme && /\p{L}\/\p{L}/u.test(passage)) candidat.question = questionATrou(passage, candidat.choix[0]);
        if (typeof candidat.choix?.[0] === "string" && normaliserCitation(candidat.choix[0]).length >= 4 && normaliserCitation(candidat.question || "").includes(normaliserCitation(candidat.choix[0]))) candidat.question = questionATrou(passage, candidat.choix[0]);
        try { question = verifierQuestionLocale(candidat, passage, questions, eviter); }
        catch (e) {
          if (!(e instanceof EnonceHorsSource)) throw e;
          // Transformer l'exercice, sans conserver l'information inventée par le modèle.
          question = verifierQuestionLocale({ ...candidat, question: questionATrou(passage, candidat.choix[0]) }, passage, questions, eviter);
        }
      }
      catch (e) {
        opts.signal?.throwIfAborted();
        probleme = e instanceof z.ZodError ? e.issues.slice(0, 3).map(x => `${x.path.join(".")} : ${x.message}`).join(" ; ") : e instanceof Error ? e.message : "Réponse invalide";
        if (!cibleImposee && probleme.includes("proposition courte")) {
          cibleImposee = [...passage.matchAll(/[\p{L}]{7,}/gu)].map(m => m[0]).sort((a, b) => b.length - a.length)[0] || "";
          if (cibleImposee) probleme += ` La première proposition doit être exactement « ${cibleImposee} » ; pose une question pour retrouver ce mot.`;
        }
        console.warn("[ollama-qcm]", `question ${i + 1}, essai ${essai + 1}`, probleme);
        execution.suivi?.({ fournisseur: "Ollama", phase: "correction" });
      }
    }
    if (!question && !opts._secours) {
      // Une formulation difficile ne doit pas bloquer toutes les autres connaissances d'un long cours.
      const utilisees = new Set([passage, ...questions.map(q => q.extrait)].map(normaliserCitation));
      const alternatives = [...new Set(planifierQuestions(opts.texte, Math.min(30, opts.nombre + 10)))].filter(f => !utilisees.has(normaliserCitation(f)) && /\d/.test(f)).slice(0, 2);
      for (const autre of alternatives) {
        opts.signal?.throwIfAborted();
        try {
          const secours = await genererQcmOllama(url, modele, { ...opts, texte: autre, nombre: 1, eviter: [...eviter, ...questions.map(q => q.question)], reprise: undefined, suivi: execution.suivi, _secours: true });
          question = verifierQuestionLocale(secours.questions[0], opts.texte, questions, eviter); break;
        } catch (e) { opts.signal?.throwIfAborted(); console.warn("[ollama-qcm]", `autre fait pour la question ${i + 1}`, e instanceof Error ? e.message : "échec"); }
      }
    }
    if (!question) throw new ErreurQcmLocal(`L’IA locale n’a pas réussi à valider la question ${i + 1} sur ${opts.nombre}. Les questions déjà validées sont conservées pour la relance.`);
    opts.reprise?.ecrire(i, hash, question); questions.push(question);
    opts.suivi?.({ fournisseur: "Ollama", phase: "generation", unite: "question", partiesFaites: questions.length, partiesTotal: opts.nombre });
  }
  return QuizSchema.parse({ titre: (opts.titre || "QCM du cours").slice(0, 120), matiere: (opts.matiere || "").slice(0, 40), questions });
}
