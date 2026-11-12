import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-controle-"));
process.env.AUTH_SECRET = "secret-pour-tests-uniquement";
import {
  ControleSchema, controleDemo, corrigerAutomatiquement, corrigerParMotsCles, nettoyerReponses, noteSur20Controle, sujetPourEleve, trouJuste, bornerPoints,
  type Controle,
} from "../lib/controle";
import { creerControle, creerCopie, lireCopie, listerControles, lireControle } from "../lib/controles-db";
import { creerCours, creerInvite, transfererDonnees } from "../lib/db";
import { enqueuerTache, lireTache } from "../lib/taches-db";
import { traiterUneTache } from "../lib/traiter-taches";
import { controleEnElements, enMarkdown } from "../lib/export";

const demo = controleDemo();

test("le format refuse un texte à trous sans réponse pour chaque trou, et accepte « vrai » écrit en toutes lettres", () => {
  const base = { titre: "T", matiere: "", questions: [demo.questions[0], demo.questions[1]] };
  assert.equal(ControleSchema.safeParse({ ...base, questions: [...base.questions, { type: "trous", enonce: "Le ___ et le ___.", reponses: [["a"]], points: 2 }] }).success, false);
  const ok = ControleSchema.parse({ ...base, questions: [...base.questions, { type: "vrai_faux", enonce: "Une affirmation.", reponse: "Vrai", points: 1.3 }] });
  const vf = ok.questions[2];
  assert.equal(vf.type === "vrai_faux" && vf.reponse, true);
  assert.equal(vf.points, 1.5);
});

test("le sujet envoyé au navigateur ne contient aucune réponse", () => {
  const sujet = JSON.stringify(sujetPourEleve(demo));
  for (const interdit of ["bonne_reponse", "reponse_modele", "elements_attendus", "Varennes", "explication", "\"reponse\""]) assert.equal(sujet.includes(interdit), false, interdit);
});

test("les questions fermées sont corrigées par le site, avec une petite faute tolérée dans les trous", () => {
  assert.equal(trouJuste("varenne", ["Varennes"]), true);
  assert.equal(trouJuste("Séptembre", ["septembre"]), true);
  assert.equal(trouJuste("mars", ["mai"]), false);
  const reponses = nettoyerReponses(demo, [0, false, ["Varenne", "octobre"], "  ", 42, "bonus"]);
  assert.deepEqual(reponses.slice(0, 4), [0, false, ["Varenne", "octobre"], null]);
  assert.equal(reponses[4], null); // un nombre n'est pas une réponse rédigée
  const c = corrigerAutomatiquement(demo, reponses);
  assert.deepEqual(c.map((x) => [x.points, x.par]), [[2, "site"], [0, "site"], [2, "site"], [0, "site"], [0, "site"]]);
  assert.deepEqual(c[2].trous_justes, [true, false]);
  const avecRedaction = corrigerAutomatiquement(demo, nettoyerReponses(demo, [0, true, ["Varennes", "septembre"], "La Déclaration", "Un texte"]));
  assert.deepEqual(avecRedaction.map((x) => x.par), ["site", "site", "site", "attente", "attente"]);
});

test("sans IA, les idées attendues sont retrouvées par leurs mots-clés, et la note est ramenée sur 20", () => {
  const q = demo.questions[4];
  if (q.type !== "redigee") throw new Error("question rédigée attendue");
  const c = corrigerParMotsCles(q, "Avec la prise de la Bastille et l'abolition des privileges, la société change.");
  assert.deepEqual(c.elements_trouves, [0, 1]);
  assert.equal(c.points, 4);
  assert.match(c.commentaire, /Déclaration des droits/);
  assert.equal(noteSur20Controle([{ points: 3, max: 4, commentaire: "", par: "site" }, { points: 5, max: 16, commentaire: "", par: "ia" }]), 8);
  assert.equal(bornerPoints(12, 8), 8);
  assert.equal(bornerPoints(-1, 8), 0);
  assert.equal(bornerPoints("2.3", 8), 2.5);
  assert.equal(bornerPoints("beaucoup", 8), 0);
});

test("un contrôle demandé est préparé puis corrigé par le service, et suit l'invité qui se connecte", async () => {
  const u = creerInvite();
  const cours = creerCours(u.id, { titre: "Révolution", titreAuto: false, source: "Texte", texte: "La Révolution française. ".repeat(20), fichiers: [], dossierId: null });
  const ancien = process.env.IA_DEMO;
  process.env.IA_DEMO = "1";
  try {
    const t = enqueuerTache(u.id, cours, "controle", { mode: "rapide", nombre: 5, difficulte: "moyen", types: ["qcm", "redigee", "vrai_faux"], duree: 20 }, false, "");
    assert.equal(await traiterUneTache(), true);
    const fini = lireTache(u.id, t.id)!;
    assert.equal(fini.statut, "termine");
    const k = lireControle(u.id, fini.resultatId!)!;
    assert.equal(k.dureeMin, 20);
    assert.deepEqual(k.controle.questions.map((q) => q.type), ["qcm", "vrai_faux", "redigee"]);

    const reponses = nettoyerReponses(k.controle, [0, true, "La prise de la Bastille, l'abolition des privilèges et la Déclaration des droits de l'homme."]);
    const copie = creerCopie(k.id, reponses, { questions: corrigerAutomatiquement(k.controle, reponses), appreciation: "" }, "en_correction", null, 300);
    const c = enqueuerTache(u.id, cours, "correction", { mode: "rapide", copie }, false, "");
    assert.equal(await traiterUneTache(), true);
    assert.equal(lireTache(u.id, c.id)!.statut, "termine");
    const corrigee = lireCopie(u.id, copie)!.copie;
    assert.equal(corrigee.statut, "corrigee");
    assert.deepEqual(corrigee.correction.questions[2].elements_trouves, [0, 1, 2]);
    assert.equal(corrigee.note, 16.5); // 2/2 + 2/2 + 6/8 = 10/12, soit 16,5/20 au demi-point
    assert.equal(listerControles(u.id)[0].meilleure, 16.5);

    const compte = creerInvite();
    transfererDonnees(u.id, compte.id);
    assert.equal(lireCopie(compte.id, copie)?.copie.id, copie);
    assert.equal(lireControle(u.id, k.id), null);
  } finally {
    if (ancien === undefined) delete process.env.IA_DEMO;
    else process.env.IA_DEMO = ancien;
  }
});

test("la version papier donne le sujet avec le barème, puis le corrigé", () => {
  const md = enMarkdown(controleEnElements(demo as Controle, "Révolution", 30));
  assert.match(md, /Contrôle sur 20 points · 30 minutes/);
  assert.match(md, /### 3\. Complète le texte\. \(4 pts\)/);
  assert.match(md, /arrêtée à ______________/);
  assert.match(md, /## Corrigé et barème[\s\S]*Varennes ; septembre[\s\S]*- abolition des privilèges/);
});
