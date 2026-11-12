import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { BASE } from "@/lib/chemin";
import { COOKIE_ETAT, configOAuth, urlConnexion } from "@/lib/oauth";

/** Envoie vers la page de connexion de Discord ou Google. */
export async function GET(_req: Request, { params }: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await params;
  const config = configOAuth(fournisseur);
  if (!config) return new NextResponse(null, { status: 303, headers: { Location: `${BASE}/?erreur=indisponible` } });

  // Valeur au hasard renvoyée par le fournisseur : prouve que le retour vient bien de notre demande.
  const etat = crypto.randomBytes(24).toString("base64url");
  const rep = new NextResponse(null, { status: 303, headers: { Location: urlConnexion(config, etat) } });
  rep.cookies.set(COOKIE_ETAT, `${config.id}.${etat}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.SITE_URL ?? "").startsWith("https:"),
    path: BASE || "/",
    maxAge: 600,
  });
  return rep;
}
