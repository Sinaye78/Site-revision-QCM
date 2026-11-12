import { db } from "./db";
import type { Question, Quiz } from "./quiz";

/**
 * Répétition espacée (boîtes de Leitner) sur les questions des QCM.
 * Une bonne réponse fait monter la question d'une boîte, donc on la revoit
 * plus tard ; une erreur la renvoie en boîte 1, à revoir dès le lendemain.
 * Les jours sont comptés à l'heure de Paris, au format AAAA-MM-JJ.
 */
export const INTERVALLES_JOURS = [1, 3, 7, 14, 30] as const;
export const BOITE_MAX = INTERVALLES_JOURS.length;

const formatJour = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

export function jourParis(instant: number = Date.now()): string {
  return formatJour.format(instant);
}

export function ajouterJours(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

export function boiteSuivante(boite: number | undefined, juste: boolean): number {
  if (!juste) return 1;
  return Math.min((boite ?? 0) + 1, BOITE_MAX);
}

export function jourDeRevision(boite: number, aujourdhui: string): string {
  return ajouterJours(aujourdhui, INTERVALLES_JOURS[Math.max(1, Math.min(boite, BOITE_MAX)) - 1]);
}

export type ResultatQuestion = { quizId: string; question: number; juste: boolean };

/** Range les réponses données (QCM complet, erreurs refaites ou révision) et note le jour d'activité. */
export function enregistrerReponses(u: string, resultats: ResultatQuestion[], maintenant: number = Date.now()) {
  if (resultats.length === 0) return;
  const aujourdhui = jourParis(maintenant);
  const b = db();
  b.exec("BEGIN IMMEDIATE");
  try {
    const lire = b.prepare("SELECT boite FROM revisions WHERE quiz_id = ? AND question = ?");
    const ecrire = b.prepare(
      `INSERT INTO revisions (quiz_id, question, boite, jour_prochain, vu_le, erreurs) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(quiz_id, question) DO UPDATE SET boite = excluded.boite, jour_prochain = excluded.jour_prochain,
         vu_le = excluded.vu_le, erreurs = revisions.erreurs + excluded.erreurs`
    );
    for (const r of resultats) {
      const actuelle = lire.get(r.quizId, r.question) as { boite: number } | undefined;
      const boite = boiteSuivante(actuelle?.boite, r.juste);
      ecrire.run(r.quizId, r.question, boite, jourDeRevision(boite, aujourdhui), maintenant, r.juste ? 0 : 1);
    }
    b.prepare("INSERT OR IGNORE INTO activite (utilisateur_id, jour) VALUES (?, ?)").run(u, aujourdhui);
    b.exec("COMMIT");
  } catch (e) {
    b.exec("ROLLBACK");
    throw e;
  }
}

/** Une question signalée fausse sort de la répétition espacée. */
export function oublierQuestion(quizId: string, question: number) {
  db().prepare("DELETE FROM revisions WHERE quiz_id = ? AND question = ?").run(quizId, question);
}

export type QuestionARevoir = { quizId: string; index: number; boite: number; quizTitre: string; matiere: string; coursId: string | null; question: Question };

/** Les questions à revoir aujourd'hui, les plus fragiles d'abord. */
export function questionsARevoir(u: string, limite = 20, aujourdhui = jourParis()): QuestionARevoir[] {
  const lignes = db()
    .prepare(
      `SELECT r.quiz_id, r.question, r.boite, q.titre, q.matiere, q.donnees, q.cours_id
         FROM revisions r JOIN quizzes q ON q.id = r.quiz_id
        WHERE q.utilisateur_id = ? AND r.jour_prochain <= ?
        ORDER BY r.boite, r.jour_prochain, r.vu_le`
    )
    .all(u, aujourdhui) as { quiz_id: string; question: number; boite: number; titre: string; matiere: string; donnees: string; cours_id: string | null }[];
  const quizzes = new Map<string, Quiz>();
  const resultat: QuestionARevoir[] = [];
  for (const l of lignes) {
    if (resultat.length >= limite) break;
    let quiz = quizzes.get(l.quiz_id);
    if (!quiz) {
      quiz = JSON.parse(l.donnees) as Quiz;
      quizzes.set(l.quiz_id, quiz);
    }
    const question = quiz.questions[l.question];
    if (!question || question.signalee) continue;
    resultat.push({ quizId: l.quiz_id, index: l.question, boite: l.boite, quizTitre: l.titre, matiere: l.matiere, coursId: l.cours_id, question });
  }
  return resultat;
}

export function compterARevoir(u: string, aujourdhui = jourParis()): number {
  const l = db()
    .prepare("SELECT COUNT(*) AS n FROM revisions r JOIN quizzes q ON q.id = r.quiz_id WHERE q.utilisateur_id = ? AND r.jour_prochain <= ?")
    .get(u, aujourdhui) as { n: number };
  return Number(l.n);
}

/** Le prochain jour où des questions reviendront (null s'il n'y en a aucune). */
export function prochainJourDeRevision(u: string, aujourdhui = jourParis()): string | null {
  const l = db()
    .prepare("SELECT MIN(r.jour_prochain) AS j FROM revisions r JOIN quizzes q ON q.id = r.quiz_id WHERE q.utilisateur_id = ? AND r.jour_prochain > ?")
    .get(u, aujourdhui) as { j: string | null };
  return l.j;
}

/** Nombre de jours d'affilée avec au moins une révision (aujourd'hui, ou jusqu'à hier si pas encore révisé). */
export function serieDeJours(u: string, aujourdhui = jourParis()): number {
  const jours = new Set(
    (db().prepare("SELECT jour FROM activite WHERE utilisateur_id = ? AND jour >= ?").all(u, ajouterJours(aujourdhui, -400)) as { jour: string }[]).map((l) => l.jour)
  );
  let jour = jours.has(aujourdhui) ? aujourdhui : ajouterJours(aujourdhui, -1);
  let serie = 0;
  while (jours.has(jour)) {
    serie++;
    jour = ajouterJours(jour, -1);
  }
  return serie;
}

/** Combien de questions sont « acquises » (boîte 4 ou plus) sur toutes celles déjà vues. */
export function bilanMemoire(u: string): { vues: number; acquises: number } {
  const l = db()
    .prepare("SELECT COUNT(*) AS vues, SUM(CASE WHEN r.boite >= 4 THEN 1 ELSE 0 END) AS acquises FROM revisions r JOIN quizzes q ON q.id = r.quiz_id WHERE q.utilisateur_id = ?")
    .get(u) as { vues: number; acquises: number | null };
  return { vues: Number(l.vues), acquises: Number(l.acquises ?? 0) };
}
