import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { enregistrerTentative, lireQuiz, modifierQuiz, signalerQuestion, supprimerQuiz } from "@/lib/db";
import { corrigerCopie } from "@/lib/quiz";
import { enregistrerReponses } from "@/lib/revision";

type Ctx = { params: Promise<{ id: string }> };
const nonConnecte = () => NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
const introuvable = () => NextResponse.json({ erreur: "QCM introuvable." }, { status: 404 });

/**
 * Enregistre une copie complète. Le score est recalculé ici, pas confié au
 * navigateur ; les questions signalées fausses ne comptent pas. Chaque réponse
 * alimente aussi la répétition espacée.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  const enregistre = lireQuiz(u.id, id);
  if (!enregistre) return introuvable();

  const corps = (await req.json().catch(() => ({}))) as { reponses?: unknown };
  const questions = enregistre.quiz.questions;
  const reponses = Array.isArray(corps.reponses) ? corps.reponses.map((r) => (Number.isInteger(r) ? Number(r) : -1)) : [];
  if (reponses.length !== questions.length) return NextResponse.json({ erreur: "Réponses incomplètes." }, { status: 400 });

  const { score, total } = corrigerCopie(questions, reponses);
  if (total > 0) enregistrerTentative(id, reponses, score, total);
  enregistrerReponses(
    u.id,
    questions.flatMap((q, i) => (q.signalee ? [] : [{ quizId: id, question: i, juste: reponses[i] === q.bonne_reponse }]))
  );
  return NextResponse.json({ score, total });
}

/** Renommer un QCM, ou signaler qu'une question est fausse (`signaler`: son numéro, `valeur`: oui/non). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  const corps = (await req.json().catch(() => ({}))) as { titre?: unknown; signaler?: unknown; valeur?: unknown };
  if (corps.signaler !== undefined) {
    if (!Number.isInteger(corps.signaler)) return NextResponse.json({ erreur: "Question inconnue." }, { status: 400 });
    return signalerQuestion(u.id, id, Number(corps.signaler), corps.valeur !== false) ? NextResponse.json({ ok: true }) : introuvable();
  }
  const champs: { titre?: string } = {};
  if (typeof corps.titre === "string") {
    const titre = corps.titre.trim().slice(0, 120);
    if (!titre) return NextResponse.json({ erreur: "Le nom ne peut pas être vide." }, { status: 400 });
    champs.titre = titre;
  }
  return modifierQuiz(u.id, id, champs) ? NextResponse.json({ ok: true }) : introuvable();
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  return supprimerQuiz(u.id, id) ? NextResponse.json({ ok: true }) : introuvable();
}
