import { NextResponse, type NextRequest } from "next/server";
import { estInvite, ipDe, utilisateurCourant } from "@/lib/auth";
import { ErreurUtilisateur } from "@/lib/extraction";
import { DIFFICULTES, NOMBRES, type Difficulte } from "@/lib/quiz";
import { lireCours } from "@/lib/db";
import { ajouterCours } from "@/lib/ajout-cours";
import { enqueuerTache, QuotaTaches } from "@/lib/taches-db";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  let coursId: string | null = null;
  try {
    const form = await req.formData();
    const mode = form.get("mode") ?? "local";
    if (mode !== "local" && mode !== "rapide") return NextResponse.json({ erreur: "Choisis un mode de génération valide." }, { status: 400 });
    const nombreDemande = Number(form.get("nombre"));
    const nombre = (NOMBRES as readonly number[]).includes(nombreDemande) ? nombreDemande : 10;
    const diff = String(form.get("difficulte") ?? "");
    const difficulte: Difficulte = (DIFFICULTES as readonly string[]).includes(diff) ? diff as Difficulte : "moyen";
    const choisi = String(form.get("cours") ?? "");
    if (choisi) {
      const cours = lireCours(u.id, choisi);
      if (!cours) throw new ErreurUtilisateur("Ce cours n'existe plus.");
      coursId = cours.id;
    } else coursId = (await ajouterCours(u.id, form)).coursId;
    const tache = enqueuerTache(u.id, coursId, "qcm", { nombre, difficulte, mode }, estInvite(u), ipDe(req));
    return NextResponse.json({ tacheId: tache.id, coursId }, { status: 202 });
  } catch (e) {
    if (e instanceof QuotaTaches) return NextResponse.json({ erreur: e.message, coursId }, { status: 429 });
    if (e instanceof ErreurUtilisateur) return NextResponse.json({ erreur: e.message, coursId }, { status: 422 });
    console.error("[envoi-qcm]", e);
    return NextResponse.json({ erreur: "L'envoi n'a pas pu être enregistré. Réessaie.", coursId }, { status: 400 });
  }
}
