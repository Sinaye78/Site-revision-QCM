import { NextResponse, type NextRequest } from "next/server";
import { estInvite, ipDe, utilisateurCourant } from "@/lib/auth";
import { deciderProposition, enregistrerFiche, lireCours, restaurerVersionFiche } from "@/lib/db";
import { FicheSchema, type Bloc, type Fiche } from "@/lib/fiche";
import { MAX_CONSIGNE } from "@/lib/retouche";
import { enqueuerTache, QuotaTaches } from "@/lib/taches-db";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const nonConnecte = () => NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
const introuvable = () => NextResponse.json({ erreur: "Cours introuvable." }, { status: 404 });

async function lireCorps(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const texte = await req.text();
    const brut = texte ? JSON.parse(texte) : {};
    return brut && typeof brut === "object" ? (brut as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Demande à l'IA de mettre le cours au propre (corps : { mode }), ou de
 * retoucher la fiche existante (corps : { mode, retouche: { demande, section? } }).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  const cours = lireCours(u.id, id);
  if (!cours) return introuvable();
  const choix = await lireCorps(req);
  if (!choix) return NextResponse.json({ erreur: "Choix de génération illisible." }, { status: 400 });
  const mode = choix.mode ?? "local";
  if (mode !== "local" && mode !== "rapide") return NextResponse.json({ erreur: "Choisis un mode de génération valide." }, { status: 400 });

  let type: "fiche" | "retouche" = "fiche";
  let parametres: object = { mode };
  if (choix.retouche !== undefined) {
    const r = choix.retouche as { demande?: unknown; section?: unknown };
    const demande = typeof r?.demande === "string" ? r.demande.trim().slice(0, MAX_CONSIGNE) : "";
    if (demande.length < 4) return NextResponse.json({ erreur: "Dis à l'IA ce qu'elle doit changer." }, { status: 400 });
    if (!cours.fiche) return NextResponse.json({ erreur: "Mets d'abord ce cours au propre." }, { status: 400 });
    const section = Number.isInteger(r.section) && cours.fiche.sections[Number(r.section)] ? Number(r.section) : undefined;
    type = "retouche";
    parametres = { mode, demande, ...(section !== undefined ? { section } : {}) };
  }
  try {
    const tache = enqueuerTache(u.id, id, type, parametres, estInvite(u), ipDe(req));
    return NextResponse.json({ tacheId: tache.id, coursId: id }, { status: 202 });
  } catch (e) {
    if (e instanceof QuotaTaches) return NextResponse.json({ erreur: e.message }, { status: 429 });
    console.error("[envoi-fiche]", e);
    return NextResponse.json({ erreur: "La demande n'a pas pu être enregistrée." }, { status: 500 });
  }
}

/** Les images qu'une fiche modifiée à la main a le droit d'afficher : celles du cours et de la fiche actuelle. */
function imagesAutorisees(cours: NonNullable<ReturnType<typeof lireCours>>): Set<string> {
  const ok = new Set(cours.fichiers.filter((f) => f.type.startsWith("image/")).map((f) => f.fichier));
  cours.fiche?.illustrations?.forEach((i) => ok.add(i.fichier));
  cours.fiche?.sections.forEach((s) => s.blocs.forEach((b) => b.type === "image" && b.fichier && ok.add(b.fichier)));
  return ok;
}

/** Enregistre la fiche modifiée à la main (corps : { fiche }). L'ancienne part dans l'historique. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  const cours = lireCours(u.id, id);
  if (!cours) return introuvable();
  const corps = await lireCorps(req);
  const lu = FicheSchema.safeParse(corps?.fiche);
  if (!lu.success) {
    const probleme = lu.error.issues[0];
    return NextResponse.json({ erreur: `La fiche n'est pas complète (${probleme?.path.join(" › ") || "format"} : ${probleme?.message ?? "invalide"}).` }, { status: 400 });
  }
  const autorisees = imagesAutorisees(cours);
  const fiche: Fiche = {
    ...lu.data,
    // Les illustrations restent celles rangées par le site, jamais celles envoyées par le navigateur.
    illustrations: cours.fiche?.illustrations ?? [],
    sections: lu.data.sections
      .map((s) => ({ ...s, blocs: s.blocs.filter((b: Bloc) => b.type !== "image" || (b.fichier !== undefined && autorisees.has(b.fichier))) }))
      .filter((s) => s.blocs.length > 0),
  };
  if (!fiche.sections.length) return NextResponse.json({ erreur: "La fiche doit garder au moins une partie." }, { status: 400 });
  enregistrerFiche(u.id, id, fiche, "main");
  return NextResponse.json({ ok: true });
}

/** { restaurer: idVersion } remet une ancienne version ; { proposition: "garder" | "refuser" } décide de la retouche de l'IA. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  if (!lireCours(u.id, id)) return introuvable();
  const corps = await lireCorps(req);
  if (Number.isInteger(corps?.restaurer)) {
    return restaurerVersionFiche(u.id, id, Number(corps!.restaurer)) ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: "Cette version n'existe plus." }, { status: 404 });
  }
  if (corps?.proposition === "garder" || corps?.proposition === "refuser") {
    return deciderProposition(u.id, id, corps.proposition === "garder")
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erreur: "Il n'y a plus de proposition à valider." }, { status: 404 });
  }
  return NextResponse.json({ erreur: "Demande inconnue." }, { status: 400 });
}
