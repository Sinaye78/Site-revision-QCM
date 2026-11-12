import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireQuiz, type QuizEnregistre } from "@/lib/db";
import { enregistrerReponses, type ResultatQuestion } from "@/lib/revision";

/**
 * Réponses données hors d'une copie complète : erreurs refaites ou séance de
 * révision. Corps : { reponses: [{ quizId, index, choix }] }. La justesse est
 * vérifiée ici avec la vraie bonne réponse.
 */
export async function POST(req: NextRequest) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const corps = (await req.json().catch(() => ({}))) as { reponses?: unknown };
  if (!Array.isArray(corps.reponses) || corps.reponses.length > 100) return NextResponse.json({ erreur: "Réponses illisibles." }, { status: 400 });

  const quizzes = new Map<string, QuizEnregistre | null>();
  const resultats: ResultatQuestion[] = [];
  for (const brut of corps.reponses as { quizId?: unknown; index?: unknown; choix?: unknown }[]) {
    if (typeof brut?.quizId !== "string" || !Number.isInteger(brut.index) || !Number.isInteger(brut.choix)) continue;
    if (!quizzes.has(brut.quizId)) quizzes.set(brut.quizId, lireQuiz(u.id, brut.quizId));
    const question = quizzes.get(brut.quizId)?.quiz.questions[Number(brut.index)];
    if (!question || question.signalee) continue;
    resultats.push({ quizId: brut.quizId, question: Number(brut.index), juste: Number(brut.choix) === question.bonne_reponse });
  }
  enregistrerReponses(u.id, resultats);
  return NextResponse.json({ score: resultats.filter((r) => r.juste).length, total: resultats.length });
}
