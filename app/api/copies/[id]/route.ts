import { NextResponse, type NextRequest } from "next/server";
import { estInvite, ipDe, utilisateurCourant } from "@/lib/auth";
import { lireCours } from "@/lib/db";
import { lireCopie } from "@/lib/controles-db";
import { executerCorrection } from "@/lib/controle-ia";
import { enqueuerTache, QuotaTaches } from "@/lib/taches-db";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** État d'une copie (pour la page de résultat qui attend la correction). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const lu = lireCopie(u.id, (await params).id);
  if (!lu) return NextResponse.json({ erreur: "Copie introuvable." }, { status: 404 });
  return NextResponse.json({ statut: lu.copie.statut, note: lu.copie.note }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * { action: "relancer", mode } : refaire corriger par l'IA.
 * { action: "sans-ia" } : corriger tout de suite en comptant les mots-clés des éléments attendus.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const lu = lireCopie(u.id, (await params).id);
  if (!lu) return NextResponse.json({ erreur: "Copie introuvable." }, { status: 404 });
  const corps = (await req.json().catch(() => ({}))) as { action?: unknown; mode?: unknown };
  if (corps.action === "sans-ia") {
    await executerCorrection(lu.copie.id, { sansIA: true });
    return NextResponse.json({ ok: true });
  }
  if (corps.action === "relancer") {
    const coursId = lu.controle.coursId;
    if (!coursId || !lireCours(u.id, coursId)) return NextResponse.json({ erreur: "Le cours de ce contrôle a été supprimé : utilise la correction sans IA." }, { status: 400 });
    try {
      const tache = enqueuerTache(u.id, coursId, "correction", { mode: corps.mode === "local" ? "local" : "rapide", copie: lu.copie.id }, estInvite(u), ipDe(req));
      return NextResponse.json({ tacheId: tache.id }, { status: 202 });
    } catch (e) {
      if (e instanceof QuotaTaches) return NextResponse.json({ erreur: e.message }, { status: 429 });
      throw e;
    }
  }
  return NextResponse.json({ erreur: "Demande inconnue." }, { status: 400 });
}
