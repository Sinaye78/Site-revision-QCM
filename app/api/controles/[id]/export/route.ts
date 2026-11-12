import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireControle } from "@/lib/controles-db";
import { controleEnElements, enDocx, enMarkdown, nomDeFichier, TYPES_EXPORT } from "@/lib/export";

export const runtime = "nodejs";

/** Télécharge le contrôle (sujet puis corrigé et barème) en Word (?format=docx) ou en Markdown (?format=md). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const k = lireControle(u.id, (await params).id);
  if (!k) return new NextResponse("Contrôle introuvable.", { status: 404 });
  const format = req.nextUrl.searchParams.get("format") === "md" ? "md" : "docx";
  const elements = controleEnElements(k.controle, k.controle.titre, k.dureeMin);
  const contenu = format === "md" ? Buffer.from(enMarkdown(elements), "utf8") : await enDocx(elements, k.controle.titre);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": TYPES_EXPORT[format],
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nomDeFichier(`Contrôle - ${k.controle.titre}`, format))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
