import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { modifierCours, modifierTexteCours, supprimerCours } from "@/lib/db";
import { MAX_CARACTERES } from "@/lib/extraction";

type Ctx = { params: Promise<{ id: string }> };
const nonConnecte = () => NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
const introuvable = () => NextResponse.json({ erreur: "Cours introuvable." }, { status: 404 });

/** Renommer un cours ou le ranger dans un dossier (dossierId: null = le sortir). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  const corps = (await req.json().catch(() => ({}))) as { titre?: unknown; dossierId?: unknown; texte?: unknown };
  // Correction du texte d'origine (faute de lecture d'une photo, passage en trop…).
  if (typeof corps.texte === "string") {
    const texte = corps.texte.trim().slice(0, MAX_CARACTERES);
    if (texte.length < 30) return NextResponse.json({ erreur: "Le texte du cours est presque vide." }, { status: 400 });
    return modifierTexteCours(u.id, id, texte) ? NextResponse.json({ ok: true }) : introuvable();
  }
  const champs: { titre?: string; dossierId?: string | null } = {};
  if (typeof corps.titre === "string") {
    const titre = corps.titre.trim().slice(0, 120);
    if (!titre) return NextResponse.json({ erreur: "Le nom ne peut pas être vide." }, { status: 400 });
    champs.titre = titre;
  }
  if (corps.dossierId === null || typeof corps.dossierId === "string") champs.dossierId = corps.dossierId || null;
  return modifierCours(u.id, id, champs) ? NextResponse.json({ ok: true }) : introuvable();
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  return supprimerCours(u.id, id) ? NextResponse.json({ ok: true }) : introuvable();
}
