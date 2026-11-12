import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { ajouterCours } from "@/lib/ajout-cours";
import { ErreurUtilisateur } from "@/lib/extraction";

export const runtime = "nodejs";

/** Range un nouveau cours dans « Mes cours » (sans IA). */
export async function POST(req: NextRequest) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi illisible. Réessaie." }, { status: 400 });

  try {
    const { coursId, tronque } = await ajouterCours(u.id, form);
    return NextResponse.json({ id: coursId, tronque });
  } catch (e) {
    if (e instanceof ErreurUtilisateur) return NextResponse.json({ erreur: e.message }, { status: 422 });
    console.error("[cours]", e);
    return NextResponse.json({ erreur: "Un problème est survenu en lisant le cours. Réessaie." }, { status: 500 });
  }
}
