import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { listerTaches } from "@/lib/taches-db";

export const runtime = "nodejs";

/** Les traitements récents du compte, pour prévenir l'élève quand l'un d'eux se termine. */
export async function GET() {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const taches = listerTaches(u.id)
    .slice(0, 30)
    .map((t) => ({ id: t.id, titre: t.titre, type: t.type, statut: t.statut, coursId: t.coursId, resultatId: t.resultatId }));
  return NextResponse.json({ taches }, { headers: { "Cache-Control": "no-store" } });
}
