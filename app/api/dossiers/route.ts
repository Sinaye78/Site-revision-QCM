import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { creerDossier } from "@/lib/db";
import { lireImageDossier } from "./image";

export async function POST(req: NextRequest) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Tu n'es pas connecté." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi illisible." }, { status: 400 });

  const nom = String(form.get("nom") ?? "").trim().slice(0, 60);
  if (!nom) return NextResponse.json({ erreur: "Donne un nom au dossier." }, { status: 400 });

  const image = await lireImageDossier(form.get("image"));
  if ("erreur" in image) return NextResponse.json({ erreur: image.erreur }, { status: 400 });

  const id = creerDossier(u.id, nom, String(form.get("couleur") ?? ""), image.fichier);
  return NextResponse.json({ id });
}
