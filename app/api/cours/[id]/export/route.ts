import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireCours } from "@/lib/db";
import { enDocx, enMarkdown, ficheEnElements, nomDeFichier, TYPES_EXPORT } from "@/lib/export";

export const runtime = "nodejs";

/** Télécharge la fiche « au propre » en Word (?format=docx) ou en Markdown (?format=md). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const cours = lireCours(u.id, (await params).id);
  if (!cours?.fiche) return new NextResponse("Ce cours n'a pas encore de fiche.", { status: 404 });
  const format = req.nextUrl.searchParams.get("format") === "md" ? "md" : "docx";
  const elements = ficheEnElements(cours.fiche, cours.titre);
  const contenu = format === "md" ? Buffer.from(enMarkdown(elements), "utf8") : await enDocx(elements, cours.titre);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": TYPES_EXPORT[format],
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nomDeFichier(cours.titre, format))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
