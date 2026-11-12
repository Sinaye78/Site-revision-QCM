import { NextResponse, type NextRequest } from "next/server";
import { estInvite, ipDe, utilisateurCourant } from "@/lib/auth";
import { lireCours } from "@/lib/db";
import { DUREES, NOMBRES_CONTROLE, TYPES_QUESTIONS, type TypeQuestion } from "@/lib/controle";
import { DIFFICULTES, type Difficulte } from "@/lib/quiz";
import { enqueuerTache, QuotaTaches } from "@/lib/taches-db";

export const runtime = "nodejs";

/** Demande un nouveau contrôle sur un cours : { cours, nombre, difficulte, types, duree, mode }. */
export async function POST(req: NextRequest) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corps) return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  const cours = typeof corps.cours === "string" ? lireCours(u.id, corps.cours) : null;
  if (!cours) return NextResponse.json({ erreur: "Choisis un cours." }, { status: 400 });
  const mode = corps.mode === "rapide" ? "rapide" : "local";
  const nombre = (NOMBRES_CONTROLE as readonly number[]).includes(Number(corps.nombre)) ? Number(corps.nombre) : 8;
  const difficulte: Difficulte = (DIFFICULTES as readonly string[]).includes(String(corps.difficulte)) ? (corps.difficulte as Difficulte) : "moyen";
  const duree = (DUREES as readonly number[]).includes(Number(corps.duree)) ? Number(corps.duree) : 0;
  const connus = TYPES_QUESTIONS.map((t) => t.id);
  const types = (Array.isArray(corps.types) ? corps.types : []).filter((t): t is TypeQuestion => connus.includes(t as TypeQuestion));
  if (!types.length) return NextResponse.json({ erreur: "Choisis au moins un type de question." }, { status: 400 });
  try {
    const tache = enqueuerTache(u.id, cours.id, "controle", { mode, nombre, difficulte, types: [...new Set(types)].sort(), duree }, estInvite(u), ipDe(req));
    return NextResponse.json({ tacheId: tache.id }, { status: 202 });
  } catch (e) {
    if (e instanceof QuotaTaches) return NextResponse.json({ erreur: e.message }, { status: 429 });
    console.error("[envoi-controle]", e);
    return NextResponse.json({ erreur: "La demande n'a pas pu être enregistrée." }, { status: 500 });
  }
}
