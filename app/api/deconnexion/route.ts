import { NextResponse } from "next/server";
import { COOKIE_SESSION } from "@/lib/auth";
import { BASE } from "@/lib/chemin";

export async function POST() {
  // Redirection relative : fonctionne derrière le reverse proxy sans connaître le domaine.
  const rep = new NextResponse(null, { status: 303, headers: { Location: `${BASE}/` } });
  rep.cookies.set(COOKIE_SESSION, "", { path: BASE || "/", maxAge: 0 });
  return rep;
}
