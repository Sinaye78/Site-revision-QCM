import { NextResponse } from "next/server";
import { BASE } from "@/lib/chemin";
import { COOKIE_SESSION, DUREE_INVITE_MS, creerJeton, ipDe, optionsCookie, peutCreerInvite, sansCompteActif } from "@/lib/auth";
import { creerInvite } from "@/lib/db";

/** Bouton « Continuer sans compte » : crée un espace lié à ce navigateur seulement. */
export async function POST(req: Request) {
  const vers = (chemin: string) => new NextResponse(null, { status: 303, headers: { Location: `${BASE}${chemin}` } });
  if (!sansCompteActif()) return vers("/?erreur=sans-compte");
  if (!peutCreerInvite(ipDe(req))) return vers("/?erreur=trop");

  const invite = creerInvite();
  const rep = vers("/nouveau");
  rep.cookies.set(COOKIE_SESSION, creerJeton(invite.id, DUREE_INVITE_MS), optionsCookie(DUREE_INVITE_MS, BASE));
  return rep;
}
