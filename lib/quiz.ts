import { z } from "zod";

/** Format qu'on impose à l'IA. Toute réponse est vérifiée avec ce schéma. */
export const QuestionSchema = z.object({
  question: z.string().trim().min(3),
  choix: z.array(z.string().trim().min(1)).length(4),
  bonne_reponse: z.coerce.number().int().min(0).max(3),
  explication: z.string().trim().min(3),
  extrait: z.string().trim().default(""),
  // Mise par l'élève quand l'IA s'est trompée : la question ne compte plus dans la note.
  signalee: z.boolean().optional().catch(undefined),
  // Page du PDF d'origine où se trouve l'extrait (ajoutée par le site, pas par l'IA).
  page: z.number().int().positive().optional().catch(undefined),
});

export const QuizSchema = z.object({
  titre: z.string().trim().min(1).max(120),
  matiere: z.string().trim().max(40).default(""),
  questions: z.array(QuestionSchema).min(1).max(30),
  // Vrai quand le site a déjà cherché les pages des extraits (anciens QCM).
  pages_verifiees: z.boolean().optional().catch(undefined),
});

export type Question = z.infer<typeof QuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;

export const DIFFICULTES = ["facile", "moyen", "difficile"] as const;
export type Difficulte = (typeof DIFFICULTES)[number];
export const NOMBRES = [5, 10, 15, 20] as const;

/** Mélange les choix pour que la bonne réponse ne soit pas toujours au même endroit. */
export function melangerChoix(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      const ordre = [0, 1, 2, 3];
      for (let i = ordre.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      }
      return { ...q, choix: ordre.map((i) => q.choix[i]), bonne_reponse: ordre.indexOf(q.bonne_reponse) };
    }),
  };
}

/** Score d'une copie complète : les questions signalées fausses ne comptent pas. */
export function corrigerCopie(questions: Question[], reponses: number[]): { score: number; total: number } {
  let score = 0;
  let total = 0;
  questions.forEach((q, i) => {
    if (q.signalee) return;
    total++;
    if (reponses[i] === q.bonne_reponse) score++;
  });
  return { score, total };
}

/** Mélange une liste (Fisher-Yates), sans modifier l'originale. */
export function melanger<T>(liste: readonly T[], hasard: () => number = Math.random): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Note sur 20, arrondie au demi-point. */
export function noteSur20(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 40) / 2;
}

export function formaterNote(note: number): string {
  return Number.isInteger(note) ? String(note) : note.toFixed(1).replace(".", ",");
}

export function appreciation(note: number): { commentaire: string; tampon: string } {
  if (note >= 18) return { commentaire: "Excellent travail, rien à redire.", tampon: "Excellent" };
  if (note >= 14) return { commentaire: "Très bien, tu maîtrises ton cours.", tampon: "Très bien" };
  if (note >= 10) return { commentaire: "Pas mal, encore un petit effort.", tampon: "Bien" };
  if (note >= 6) return { commentaire: "Peut mieux faire. Relis les explications.", tampon: "À revoir" };
  return { commentaire: "Relis ton cours et retente ta chance.", tampon: "À revoir" };
}
