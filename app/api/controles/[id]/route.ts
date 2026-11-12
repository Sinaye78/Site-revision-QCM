import { NextResponse, type NextRequest } from "next/server";
import { estInvite, ipDe, utilisateurCourant } from "@/lib/auth";
import { lireCours } from "@/lib/db";
import { creerCopie, lireControle, renommerControle, supprimerControle } from "@/lib/controles-db";
import { aCorrigerParIA, corrigerAutomatiquement, nettoyerReponses, noteSur20Controle, type Correction } from "@/lib/controle";
import { appreciation } from "@/lib/quiz";
import { executerCorrection } from "@/lib/controle-ia";
import { enqueuerTache, QuotaTaches } from "@/lib/taches-db";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const nonConnecte = () => NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
const introuvable = () => NextResponse.json({ erreur: "Contrôle introuvable." }, { status: 404 });

/**
 * Rendre sa copie : { reponses, dureeS, mode }. Les questions fermées sont
 * notées tout de suite ; s'il y a des réponses rédigées, l'IA les corrige en
 * arrière-plan et la copie passe « en correction ».
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const k = lireControle(u.id, (await params).id);
  if (!k) return introuvable();
  const corps = (await req.json().catch(() => ({}))) as { reponses?: unknown; dureeS?: unknown; mode?: unknown };
  const reponses = nettoyerReponses(k.controle, corps.reponses);
  const dureeS = Number.isFinite(Number(corps.dureeS)) ? Math.max(0, Math.min(6 * 3600, Math.round(Number(corps.dureeS)))) : null;
  const auto = corrigerAutomatiquement(k.controle, reponses);
  const aCorriger = k.controle.questions.some((q, i) => aCorrigerParIA(q) && typeof reponses[i] === "string");

  if (!aCorriger) {
    // Rien à faire corriger par l'IA (questions fermées, ou réponses rédigées laissées vides).
    const questions = auto.map((c) => (c.par === "attente" ? { ...c, par: "site" as const, commentaire: "Pas de réponse." } : c));
    const note = noteSur20Controle(questions);
    const correction: Correction = { questions, appreciation: appreciation(note).commentaire };
    return NextResponse.json({ copieId: creerCopie(k.id, reponses, correction, "corrigee", note, dureeS) });
  }

  const copieId = creerCopie(k.id, reponses, { questions: auto, appreciation: "" }, "en_correction", null, dureeS);
  const mode = corps.mode === "local" ? "local" : "rapide";
  if (k.coursId && lireCours(u.id, k.coursId)) {
    try {
      const tache = enqueuerTache(u.id, k.coursId, "correction", { mode, copie: copieId }, estInvite(u), ipDe(req));
      return NextResponse.json({ copieId, tacheId: tache.id });
    } catch (e) {
      // Quota atteint : la copie reste enregistrée, l'élève pourra la faire corriger sans IA.
      if (e instanceof QuotaTaches) return NextResponse.json({ copieId, erreur: e.message });
      throw e;
    }
  }
  // Le cours a été supprimé : pas de file d'attente possible, on corrige tout de suite.
  await executerCorrection(copieId, { mode }).catch((e) => console.error("[correction-directe]", e instanceof Error ? e.message : e));
  return NextResponse.json({ copieId });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const corps = (await req.json().catch(() => ({}))) as { titre?: unknown };
  const titre = typeof corps.titre === "string" ? corps.titre.trim().slice(0, 120) : "";
  if (!titre) return NextResponse.json({ erreur: "Le nom ne peut pas être vide." }, { status: 400 });
  return renommerControle(u.id, (await params).id, titre) ? NextResponse.json({ ok: true }) : introuvable();
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  return supprimerControle(u.id, (await params).id) ? NextResponse.json({ ok: true }) : introuvable();
}
