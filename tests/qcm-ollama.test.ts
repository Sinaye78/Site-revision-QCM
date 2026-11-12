import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { genererQcmOllama, planifierQuestions, verifierQuestionLocale, questionATrou } from "../lib/qcm-ollama";
import { QuizSchema } from "../lib/quiz";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-local-"));
const passage = "En 2001, Michel Brunet et son équipe annoncent la découverte de Toumaï au Tchad.\nLucy a été découverte en Éthiopie en 1974.";
const valide = { question: "Qui annonce la découverte de Toumaï en 2001 ?", choix: ["Michel Brunet et son équipe", "Charles Darwin", "Louis Pasteur", "Marie Curie"], bonne_reponse: 0, extrait: "En 2001, Michel Brunet et son équipe annoncent la découverte de Toumaï au Tchad." };
const dateValide = { question: "En quelle année Michel Brunet annonce-t-il la découverte de Toumaï ?", choix: ["2001", "1991", "2011", "2021"] };
function flux(q: unknown) {
  return new Response(JSON.stringify({ message: { content: JSON.stringify(q) }, done: true, done_reason: "stop" }) + "\n");
}
test("un cours de 80 000 caractères garde des fenêtres bornées et couvre son début, milieu et fin", () => {
  const cours = Array.from({ length: 50 }, (_, i) => `CHAPITRE ${i}. ` + (`La notion ${i} est expliquée dans ce paragraphe avec ses exemples. `).repeat(30)).join("\n\n").slice(0, 80000);
  const plan = planifierQuestions(cours, 20);
  assert.equal(plan.length, 20); assert.ok(plan.every(s => s.length <= 600 && cours.includes(s)));
  assert.ok(cours.indexOf(plan[0]) < 100); assert.ok(cours.indexOf(plan.at(-1)!) > cours.length * 0.9);
  assert.ok(cours.indexOf(plan[10]) > cours.length * 0.4 && cours.indexOf(plan[10]) < cours.length * 0.65);
  assert.throws(() => planifierQuestions(cours, 0));
});
test("les consignes du cahier ne deviennent pas des questions de connaissances", () => {
  const texte = "Nous observons, nous lisons et nous répondons.\n→ Ne recopie pas les questions.\nLa bipédie consiste à marcher sur ses deux pieds.\nLes plantes utilisent la lumière pour produire de la matière organique.";
  const faits = planifierQuestions(texte, 2);
  assert.ok(faits.every(f => !f.includes("Ne recopie") && !f.includes("Nous observons")));
  assert.throws(() => verifierQuestionLocale({ ...valide, extrait: "→ Ne recopie pas les questions." }, texte, []), /consigne/);
});
test("un corrigé conserve ses explications, sans prendre les pages et les intitulés pour des définitions", () => {
  const texte = "DCG 2022 UE4 - Corrigé Page 1 / 2\nDIPLÔME DE COMPTABILITÉ\nDOSSIER 1\n1.1. Justifier la procédure.\nPrincipe : Une proportion est comprise entre zéro et un.\nApplication au cas : Le système utilise un coefficient égal à 0,8.\nCAS CTA CAD CDE\n0 / 1 0";
  const faits = planifierQuestions(texte, 2);
  assert.ok(faits[0].startsWith("Une proportion")); assert.ok(faits[1].startsWith("Le système"));
  assert.ok(faits.every(f => !/Page|DOSSIER|Justifier|Principe|Application/.test(f)));
});
test("la validation refuse l'ancien échec, les choix incomplets, les citations inventées et les doublons", () => {
  assert.throws(() => verifierQuestionLocale({ titre: "Préhistoire", matiere: "Histoire" }, passage, []));
  assert.throws(() => verifierQuestionLocale({ ...valide, choix: ["A"] }, passage, []));
  assert.throws(() => verifierQuestionLocale({ ...valide, choix: ["A", "B", "C", "D"] }, passage, []), /réelles/);
  assert.throws(() => verifierQuestionLocale({ ...valide, choix: [valide.choix[0], "Darwin", "DARWIN", "Autre"] }, passage, []), /différentes/);
  assert.throws(() => verifierQuestionLocale({ ...valide, extrait: "Michel Brunet découvre Toumaï en Éthiopie en 1974." }, passage, []), /mot pour mot/);
  assert.throws(() => verifierQuestionLocale({ ...valide, bonne_reponse: 2 }, passage, []), /bonne proposition/);
  const formule = "Le produit A × B est noté dans le cours.";
  assert.throws(() => verifierQuestionLocale({ question: "Quelle expression indique le produit ?", choix: ["A+B", "X", "Y", "Z"], bonne_reponse: 0, extrait: formule }, formule, []), /opérateurs/);
  assert.throws(() => verifierQuestionLocale({ question: "Quelle est la définition de la bipédie ?", choix: ["Marcher sur ses deux pieds", "Marcher sur ses deux jambes", "Ramper sur le ventre", "Voler avec des ailes"], bonne_reponse: 0, extrait: "La bipédie consiste à marcher sur ses deux pieds." }, "La bipédie consiste à marcher sur ses deux pieds.", []), /trop proches/);
  const q = verifierQuestionLocale(valide, passage, []);
  assert.ok(q.explication.includes(valide.extrait));
  assert.throws(() => verifierQuestionLocale(valide, passage, [q]), /existe déjà/);
});
test("les retours à la ligne du PDF et les apostrophes typographiques n'invalident pas une vraie citation", () => {
  const source = passage.replace("Michel Brunet", "Michel\nBrunet");
  assert.equal(verifierQuestionLocale(valide, source, []).bonne_reponse, 0);
});
test("un texte à compléter masque les mots exacts malgré les accents et les retours à la ligne", () => {
  const q = questionATrou("La peinture\npariétale est réalisée à même la roche.", "peinture parietale");
  assert.ok(q.includes("[…]")); assert.ok(q.includes("réalisée à même la roche")); assert.ok(!q.includes("pariétale"));
  assert.throws(() => questionATrou(passage, "une invention absente"));
  assert.ok(questionATrou("La station se trouve à −5 mètres et reçoit dix visiteurs.", "-5").includes("à […] mètres"));
  const texte = "La station se trouve à −14 mètres sous la surface.";
  assert.throws(() => verifierQuestionLocale({ question: "Où se trouve la station ?", choix: ["14", "25", "30", "40"], bonne_reponse: 0, extrait: texte }, texte, []), /signe/);
});
test("les définitions utilisent les vrais termes du cours et ne demandent aucun appel au modèle", async () => {
  const ancien = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("Appel inutile"); };
    const texte = "Bipédie : Marcher sur ses deux pieds.\nFossile : Trace d’un organisme vivant transformée en roche.\nPolissage : Rendre la surface d’un objet lisse et brillante.\nSédentarisation : Vivre toujours au même endroit sans se déplacer.";
    const q = await genererQcmOllama("http://local", "test", { texte, nombre: 4, difficulte: "facile" });
    assert.equal(q.questions.length, 4);
    for (const question of q.questions) assert.ok(question.choix.every(c => ["Bipédie", "Fossile", "Polissage", "Sédentarisation"].includes(c)));
  } finally { globalThis.fetch = ancien; }
});
test("un ajout non fondé dans l'énoncé est remplacé par un exercice extrait du texte, sans conserver l'invention", async () => {
  const ancien = globalThis.fetch;
  try {
    globalThis.fetch = async () => flux({ question: "Quelle peinture est réalisée sans pigments ?", choix: ["La peinture pariétale", "La sculpture", "La poterie", "La gravure"] });
    const q = await genererQcmOllama("http://local", "test", { texte: "La peinture pariétale est réalisée à même la roche par des hommes préhistoriques.", nombre: 1, difficulte: "facile" });
    assert.ok(q.questions[0].question.includes("[…]")); assert.ok(!q.questions[0].question.includes("pigments"));
  } finally { globalThis.fetch = ancien; }
});
test("la génération corrige seulement la question invalide, compte les réponses validées et reprend sans recalcul", async () => {
  const ancien = globalThis.fetch; const cache = new Map<string, unknown>(); let appels = 0;
  const compteurs: number[] = [];
  const execution = { reprise: { lire: (i: number, h: string) => cache.get(i + h) ?? null, ecrire: (i: number, h: string, q: unknown) => { cache.set(i + h, q); } }, suivi: (a: { partiesFaites?: number }) => { if (a.partiesFaites !== undefined) compteurs.push(a.partiesFaites); } };
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)); appels++;
      assert.deepEqual(body.format.required, ["question"]);
      assert.equal(body.options.num_ctx, 4096); assert.equal(body.options.num_predict, 180);
      assert.equal(body.options.temperature, 0);
      assert.equal(body.think, false);
      if (appels === 1) return flux({ titre: "Préhistoire" });
      return flux(appels === 2 ? dateValide : { question: "En quelle année Lucy a-t-elle été découverte ?", choix: ["1974", "2001", "1967", "1850"] });
    };
    const opts = { texte: passage, nombre: 2, difficulte: "difficile" as const, titre: "La Préhistoire", ...execution };
    const resultat = await genererQcmOllama("http://local", "qwen3:4b", opts);
    assert.equal(QuizSchema.parse(resultat).questions.length, 2); assert.equal(appels, 3);
    assert.equal(resultat.titre, "La Préhistoire"); assert.equal(compteurs.at(-1), 2);
    await genererQcmOllama("http://local", "qwen3:4b", opts); assert.equal(appels, 3);
    await assert.rejects(genererQcmOllama("http://local", "qwen3:4b", { ...opts, texte: passage, signal: AbortSignal.abort() }));
  } finally { globalThis.fetch = ancien; }
});
test("après trois réponses inutilisables, une relance conserve les questions déjà réussies", async () => {
  const ancien = globalThis.fetch; const cache = new Map<string, unknown>(); let appels = 0; let relance = false;
  const opts = { texte: passage, nombre: 2, difficulte: "facile" as const, reprise: {
    lire: (i: number, h: string) => cache.get(`${i}:${h}`) ?? null,
    ecrire: (i: number, h: string, q: unknown) => { cache.set(`${i}:${h}`, q); },
  } };
  try {
    globalThis.fetch = async () => {
      appels++;
      if (appels === 1) return flux(dateValide);
      if (!relance) return flux({});
      return flux({ question: "En quelle année Lucy a-t-elle été découverte ?", choix: ["1974", "2001", "1967", "1850"], bonne_reponse: 0, extrait: "Lucy a été découverte en Éthiopie en 1974." });
    };
    await assert.rejects(genererQcmOllama("http://local", "test", opts), /question 2 sur 2/);
    assert.equal(appels, 4); assert.equal(cache.size, 1);
    relance = true;
    assert.equal((await genererQcmOllama("http://local", "test", opts)).questions.length, 2);
    assert.equal(appels, 5);
  } finally { globalThis.fetch = ancien; }
});
test("un fait difficile est remplacé par un autre fait du cours, puis réutilisé à la reprise", async () => {
  const ancien = globalThis.fetch; let appels = 0; const cache = new Map<string, unknown>();
  const opts = { texte: passage + "\nEn 1859, Charles Darwin publie un ouvrage sur les espèces.", nombre: 1, difficulte: "difficile" as const, reprise: {
    lire: (i: number, h: string) => cache.get(`${i}:${h}`) ?? null,
    ecrire: (i: number, h: string, q: unknown) => { cache.set(`${i}:${h}`, q); },
  } };
  try {
    globalThis.fetch = async (_url, init) => {
      appels++; const b = JSON.parse(String(init?.body));
      return flux(b.messages[1].content.includes("2001") ? dateValide : {});
    };
    const q = await genererQcmOllama("http://local", "test", opts);
    assert.equal(q.questions.length, 1); assert.ok(q.questions[0].extrait.includes("2001")); assert.equal(appels, 4);
    await genererQcmOllama("http://local", "test", opts); assert.equal(appels, 4);
  } finally { globalThis.fetch = ancien; }
});
