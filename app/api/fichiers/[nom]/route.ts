import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { fichierAppartientA } from "@/lib/db";
import { lireFichier } from "@/lib/fichiers";

/** Sert un fichier gardé (cours d'origine ou image de dossier), seulement à son propriétaire. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nom: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const { nom } = await params;
  const f = fichierAppartientA(u.id, nom) ? lireFichier(nom) : null;
  if (!f) return new NextResponse("Introuvable", { status: 404 });

  const titre = req.nextUrl.searchParams.get("titre");
  const headers: Record<string, string> = {
    "Content-Type": f.type,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  // Le PDF s'affiche dans la page du cours ; tout le reste est servi sans droit d'exécuter quoi que ce soit.
  if (f.type !== "application/pdf") headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
  else headers["X-Frame-Options"] = "SAMEORIGIN";
  if (titre) headers["Content-Disposition"] = `inline; filename*=UTF-8''${encodeURIComponent(titre)}`;
  return new NextResponse(new Uint8Array(f.contenu), { headers });
}
