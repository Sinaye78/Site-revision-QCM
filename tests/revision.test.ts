import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-revision-"));
process.env.AUTH_SECRET = "secret-pour-tests-uniquement";
import { creerInvite, creerCours, creerQuiz, lireQuiz, questionsDejaPosees, signalerQuestion, transfererDonnees } from "../lib/db";
import {
  ajouterJours, boiteSuivante, compterARevoir, enregistrerReponses, jourDeRevision, jourParis, prochainJourDeRevision,
  questionsARevoir, serieDeJours,
} from "../lib/revision";
import { corrigerCopie, type Quiz } from "../lib/quiz";
import { cartesDeLaFiche } from "../lib/cartes";
import { consigneUtilisateur } from "../lib/consignes-ia";
import { formaterJour } from "../lib/dates";
import type { Fiche } from "../lib/fiche";

const question = (n: number) => ({ question: `Question numéro ${n} ?`, choix: ["a1", "b1", "c1", "d1"], bonne_reponse: 0, explication: "Parce que.", extrait: "" });
const quiz = (n: number): Quiz => ({ titre: "Test", matiere: "SVT", questions: Array.from({ length: n }, (_, i) => question(i)) });
const JOUR = Date.UTC(2026, 10, 12, 12); // 12 novembre 2026, 13 h à Paris

test("les jours sont comptés à l'heure de Paris et s'additionnent sans décalage", () => {
  assert.equal(jourParis(Date.UTC(2026, 10, 12, 23, 30)), "2026-11-13"); // 0 h 30 à Paris
  assert.equal(ajouterJours("2026-12-30", 3), "2027-01-02");
  assert.equal(ajouterJours("2026-03-01", -1), "2026-02-28");
  assert.equal(formaterJour("2026-11-13", "2026-11-12"), "demain");
  assert.match(formaterJour("2026-11-18", "2026-11-12"), /^le mercredi 18 novembre$/);
});

test("une erreur renvoie en boîte 1, une bonne réponse fait monter jusqu'à 5", () => {
  assert.equal(boiteSuivante(undefined, true), 1);
  assert.equal(boiteSuivante(3, true), 4);
  assert.equal(boiteSuivante(5, true), 5);
  assert.equal(boiteSuivante(4, false), 1);
  assert.equal(jourDeRevision(1, "2026-11-12"), "2026-11-13");
  assert.equal(jourDeRevision(5, "2026-11-12"), "2026-12-12");
});

test("les questions ratées reviennent le lendemain, pas les autres, et la série compte les jours", () => {
  const u = creerInvite();
  const id = creerQuiz(u.id, quiz(3), { difficulte: "facile", fournisseur: "test", coursId: null });
  enregistrerReponses(u.id, [{ quizId: id, question: 0, juste: false }, { quizId: id, question: 1, juste: true }, { quizId: id, question: 2, juste: true }], JOUR);
  assert.equal(compterARevoir(u.id, "2026-11-12"), 0);
  assert.equal(prochainJourDeRevision(u.id, "2026-11-12"), "2026-11-13");
  const demain = questionsARevoir(u.id, 20, "2026-11-13");
  assert.deepEqual(demain.map((q) => q.index), [0, 1, 2]); // boîte 1 : toutes reviennent demain, la ratée d'abord
  enregistrerReponses(u.id, [{ quizId: id, question: 1, juste: true }], JOUR + 86_400_000);
  assert.equal(questionsARevoir(u.id, 20, "2026-11-14").some((q) => q.index === 1), false); // boîte 2 : dans 3 jours
  assert.equal(serieDeJours(u.id, "2026-11-13"), 2);
  assert.equal(serieDeJours(u.id, "2026-11-14"), 2); // pas encore révisé aujourd'hui : la série tient
  assert.equal(serieDeJours(u.id, "2026-11-16"), 0);
});

test("une question signalée ne compte plus dans la note ni dans les révisions", () => {
  const u = creerInvite();
  const autre = creerInvite();
  const id = creerQuiz(u.id, quiz(4), { difficulte: "moyen", fournisseur: "test", coursId: null });
  enregistrerReponses(u.id, [0, 1, 2, 3].map((question) => ({ quizId: id, question, juste: false })), JOUR);
  assert.equal(signalerQuestion(autre.id, id, 1, true), false);
  assert.equal(signalerQuestion(u.id, id, 1, true), true);
  const q = lireQuiz(u.id, id)!.quiz;
  assert.equal(q.questions[1].signalee, true);
  assert.deepEqual(corrigerCopie(q.questions, [0, 3, 3, 0]), { score: 2, total: 3 });
  assert.deepEqual(questionsARevoir(u.id, 20, "2026-11-13").map((r) => r.index), [0, 2, 3]);
  signalerQuestion(u.id, id, 1, false);
  assert.equal(lireQuiz(u.id, id)!.quiz.questions[1].signalee, undefined);
});

test("les révisions et la série suivent l'invité qui se connecte", () => {
  const invite = creerInvite();
  const compte = creerInvite();
  const id = creerQuiz(invite.id, quiz(1), { difficulte: "facile", fournisseur: "test", coursId: null });
  enregistrerReponses(invite.id, [{ quizId: id, question: 0, juste: false }], JOUR);
  transfererDonnees(invite.id, compte.id);
  assert.equal(compterARevoir(compte.id, "2026-11-13"), 1);
  assert.equal(serieDeJours(compte.id, "2026-11-12"), 1);
});

test("les questions déjà posées sur un cours sont transmises à l'IA", () => {
  const u = creerInvite();
  const cours = creerCours(u.id, { titre: "Cours", titreAuto: false, source: "Texte", texte: "x".repeat(200), fichiers: [], dossierId: null });
  creerQuiz(u.id, quiz(2), { difficulte: "facile", fournisseur: "test", coursId: cours });
  const eviter = questionsDejaPosees(u.id, cours);
  assert.deepEqual(eviter.sort(), ["Question numéro 0 ?", "Question numéro 1 ?"]);
  const consigne = consigneUtilisateur({ nombre: 5, difficulte: "facile", texte: "Le cours.", aDesImages: false, eviter });
  assert.match(consigne, /N'en repose aucune/);
  assert.match(consigne, /\n- Question numéro 0 \?/);
});

test("les cartes mémoire viennent des définitions, dates et formules expliquées, sans doublon", () => {
  const fiche: Fiche = {
    titre: "Cours", matiere: "Histoire", resume: "", mots_cles: [], illustrations: [],
    sections: [{
      titre: "La Révolution",
      blocs: [
        { type: "definition", terme: "**Privilèges**", texte: "Avantages de la noblesse." },
        { type: "definition", terme: "Privilèges", texte: "Avantages de la noblesse." },
        { type: "date", date: "14 juillet 1789", texte: "Prise de la Bastille." },
        { type: "formule", texte: "v = d / t", explication: "" },
        { type: "formule", texte: "v = d / t", explication: "La vitesse moyenne." },
        { type: "paragraphe", texte: "Texte simple." },
      ],
    }],
  };
  const cartes = cartesDeLaFiche(fiche);
  assert.deepEqual(cartes.map((c) => [c.type, c.recto, c.verso]), [
    ["definition", "Privilèges", "Avantages de la noblesse."],
    ["date", "14 juillet 1789", "Prise de la Bastille."],
    ["formule", "La vitesse moyenne.", "v = d / t"],
  ]);
});
