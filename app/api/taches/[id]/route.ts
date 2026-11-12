import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireTache } from "@/lib/taches-db";
export const runtime = "nodejs";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const tache = lireTache(u.id, (await params).id);
  if (!tache) return NextResponse.json({ erreur: "Traitement introuvable." }, { status: 404 });
  return NextResponse.json(tache, { headers: { "Cache-Control": "no-store" } });
}
