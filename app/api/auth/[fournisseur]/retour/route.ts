import { NextResponse, type NextRequest } from "next/server";
import { BASE } from "@/lib/chemin";
import { COOKIE_SESSION, DUREE_SESSION_MS, creerJeton, egal, emailAutorise, lireJeton, optionsCookie } from "@/lib/auth";
import { COOKIE_ETAT, configOAuth, lireProfil } from "@/lib/oauth";
import { enregistrerUtilisateur, lireUtilisateur, transfererDonnees } from "@/lib/db";

function vers(chemin: string) {
  const rep = new NextResponse(null, { status: 303, headers: { Location: `${BASE}${chemin}` } });
  rep.cookies.set(COOKIE_ETAT, "", { path: BASE || "/", maxAge: 0 });
  return rep;
}

/** Retour de Discord ou Google après la connexion. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await params;
  const config = configOAuth(fournisseur);
  if (!config) return vers("/?erreur=indisponible");

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return vers("/?erreur=annule");

  const attendu = req.cookies.get(COOKIE_ETAT)?.value ?? "";
  const recu = `${config.id}.${q.get("state") ?? ""}`;
  const code = q.get("code");
  if (!code || !attendu || !egal(attendu, recu)) return vers("/?erreur=expire");

  let profil;
  try {
    profil = await lireProfil(config, code);
  } catch (e) {
    console.error("[oauth]", e);
    return vers("/?erreur=fournisseur");
  }
  if (!profil.fournisseurId) return vers("/?erreur=fournisseur");
  if (!profil.email || !profil.emailVerifie) return vers("/?erreur=email");
  if (!emailAutorise(profil.email)) return vers(`/?erreur=refuse&email=${encodeURIComponent(profil.email)}`);

  const utilisateur = enregistrerUtilisateur({ fournisseur: config.id, ...profil });

  // S'il utilisait le site sans compte sur ce navigateur, ses cours passent sur son compte.
  const ancienId = lireJeton(req.cookies.get(COOKIE_SESSION)?.value);
  const ancien = ancienId ? lireUtilisateur(ancienId) : null;
  if (ancien && ancien.fournisseur === "invite") transfererDonnees(ancien.id, utilisateur.id);

  const rep = vers("/accueil");
  rep.cookies.set(COOKIE_SESSION, creerJeton(utilisateur.id), optionsCookie(DUREE_SESSION_MS, BASE));
  return rep;
}
