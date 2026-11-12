import { NextResponse, type NextRequest } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { lireQuiz } from "@/lib/db";
import { enDocx, enMarkdown, nomDeFichier, qcmEnElements, TYPES_EXPORT } from "@/lib/export";

export const runtime = "nodejs";

/** Télécharge le QCM (sujet puis corrigé) en Word (?format=docx) ou en Markdown (?format=md). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const q = lireQuiz(u.id, (await params).id);
  if (!q) return new NextResponse("QCM introuvable.", { status: 404 });
  const format = req.nextUrl.searchParams.get("format") === "md" ? "md" : "docx";
  const elements = qcmEnElements(q.quiz, q.quiz.titre);
  const contenu = format === "md" ? Buffer.from(enMarkdown(elements), "utf8") : await enDocx(elements, q.quiz.titre);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": TYPES_EXPORT[format],
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nomDeFichier(`QCM - ${q.quiz.titre}`, format))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
