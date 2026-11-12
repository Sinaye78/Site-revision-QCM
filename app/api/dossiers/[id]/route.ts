import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireDossier, modifierDossier, supprimerDossier } from "@/lib/db";
import { supprimerFichier } from "@/lib/fichiers";
import { lireImageDossier } from "../image";

type Ctx = { params: Promise<{ id: string }> };
const nonConnecte = () => NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
const introuvable = () => NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });

/** Modifie nom, couleur ou image. « retirerImage=1 » remet la couverture sans image. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  if (!lireDossier(u.id, id)) return introuvable();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi illisible." }, { status: 400 });

  const champs: { nom?: string; couleur?: string; image?: string | null } = {};
  if (form.has("nom")) {
    const nom = String(form.get("nom")).trim().slice(0, 60);
    if (!nom) return NextResponse.json({ erreur: "Donne un nom au dossier." }, { status: 400 });
    champs.nom = nom;
  }
  if (form.has("couleur")) champs.couleur = String(form.get("couleur"));
  const image = await lireImageDossier(form.get("image"));
  if ("erreur" in image) return NextResponse.json({ erreur: image.erreur }, { status: 400 });
  if (image.fichier) champs.image = image.fichier;
  else if (form.get("retirerImage") === "1") champs.image = null;

  if (!modifierDossier(u.id, id, champs)) {
    supprimerFichier(image.fichier);
    return introuvable();
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await utilisateurCourant();
  if (!u) return nonConnecte();
  const { id } = await params;
  return supprimerDossier(u.id, id) ? NextResponse.json({ ok: true }) : introuvable();
}
