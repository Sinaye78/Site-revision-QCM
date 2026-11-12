/**
 * Lecture des autres formats de cours : PowerPoint (.pptx), LibreOffice
 * (.odt, .odp), .rtf et pages web (.html). Le texte sort avec des retours à
 * la ligne entre les paragraphes, et des repères « Diapo N » pour les diaporamas.
 */
import JSZip from "jszip";

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decoderEntites(texte: string): string {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITES[code.toLowerCase()] ?? tout;
  });
}

function propre(texte: string): string {
  return texte
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texte d'un morceau de XML bureautique : un retour à la ligne par paragraphe. */
function texteXml(xml: string, paragraphe: RegExp, morceau: RegExp): string {
  const lignes: string[] = [];
  for (const p of xml.match(paragraphe) ?? []) {
    const texte = (p.match(morceau) ?? []).map((m) => decoderEntites(m.replace(/<[^>]+>/g, ""))).join("");
    if (texte.trim()) lignes.push(texte.trim());
  }
  return lignes.join("\n");
}

async function ouvrirZip(contenu: Buffer, nom: string): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(contenu);
  } catch {
    throw new Error(`« ${nom} » est abîmé ou n'est pas un vrai fichier de ce type.`);
  }
}

export async function textePptx(contenu: Buffer, nom: string): Promise<string> {
  const zip = await ouvrirZip(contenu, nom);
  const numero = (chemin: string) => Number(chemin.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const diapos = Object.keys(zip.files).filter((c) => /^ppt\/slides\/slide\d+\.xml$/.test(c)).sort((a, b) => numero(a) - numero(b));
  const parties: string[] = [];
  for (const chemin of diapos) {
    const xml = await zip.file(chemin)!.async("string");
    const texte = texteXml(xml, /<a:p>[\s\S]*?<\/a:p>/g, /<a:t>[\s\S]*?<\/a:t>/g);
    // Les notes de l'orateur contiennent souvent les explications du prof.
    const notesXml = await zip.file(`ppt/notesSlides/notesSlide${numero(chemin)}.xml`)?.async("string");
    const notes = notesXml ? texteXml(notesXml, /<a:p>[\s\S]*?<\/a:p>/g, /<a:t>[\s\S]*?<\/a:t>/g).replace(/^\d+$/gm, "").trim() : "";
    if (texte || notes) parties.push(`Diapo ${numero(chemin)}\n${texte}${notes ? `\nNotes : ${notes}` : ""}`);
  }
  return propre(parties.join("\n\n"));
}

/** .odt (texte) et .odp (présentation) de LibreOffice : tout est dans content.xml. */
export async function texteOdf(contenu: Buffer, nom: string): Promise<string> {
  const zip = await ouvrirZip(contenu, nom);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error(`« ${nom} » n'est pas un document LibreOffice lisible.`);
  const corps = xml
    .replace(/<draw:page\b[^>]*draw:name="([^"]*)"[^>]*>/g, "\n\n$1\n")
    .replace(/<text:(?:tab|s)\b[^>]*\/>/g, " ")
    .replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<\/text:(?:p|h)>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return propre(decoderEntites(corps));
}

/** RTF : on garde le texte et on retire les commandes de mise en forme. */
export function texteRtf(source: string): string {
  if (!source.startsWith("{\\rtf")) throw new Error("Ce fichier .rtf n'est pas lisible.");
  let texte = "";
  const pile: boolean[] = [];
  let ignorer = false;
  let i = 0;
  // Groupes à ne pas lire : polices, couleurs, styles, images, informations du document…
  const GROUPES_IGNORES = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|footnote|themedata|colorschememapping|latentstyles|datastore|xmlnstbl|listtable|listoverridetable|rsidtbl|generator|mmathPr)$/;
  while (i < source.length) {
    const c = source[i];
    if (c === "{") {
      pile.push(ignorer);
      i++;
      if (source.startsWith("\\*", i)) ignorer = true;
      continue;
    }
    if (c === "}") {
      ignorer = pile.pop() ?? false;
      i++;
      continue;
    }
    if (c === "\\") {
      const suite = source[i + 1];
      if (suite === "'" ) {
        if (!ignorer) texte += Buffer.from([parseInt(source.slice(i + 2, i + 4), 16)]).toString("latin1");
        i += 4;
        continue;
      }
      if (suite === "\\" || suite === "{" || suite === "}") {
        if (!ignorer) texte += suite;
        i += 2;
        continue;
      }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(i, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      const [tout, mot, nombre] = m;
      i += tout.length;
      if (GROUPES_IGNORES.test(mot)) ignorer = true;
      if (ignorer) continue;
      if (mot === "par" || mot === "line" || mot === "row") texte += "\n";
      else if (mot === "tab" || mot === "cell") texte += " ";
      else if (mot === "u" && nombre) {
        const code = Number(nombre);
        texte += String.fromCharCode(code < 0 ? code + 65536 : code);
        if (source[i] === "?") i++;
      }
      continue;
    }
    if (c === "\r" || c === "\n") {
      i++;
      continue;
    }
    if (!ignorer) texte += c;
    i++;
  }
  return propre(texte);
}

/** Page web enregistrée ou téléchargée : on garde le titre et le texte lisible. */
export function texteHtml(html: string): string {
  const sansBruit = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|template|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const principal = /<(article|main)\b[\s\S]*?<\/\1>/i.exec(sansBruit)?.[0] ?? sansBruit;
  const texte = principal
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|section|blockquote|pre|dd|dt|ul|ol)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  // Les puces d'une liste restent collées au paragraphe qui l'annonce.
  return propre(decoderEntites(texte)).replace(/\n\n(?=- )/g, "\n");
}

export function titreHtml(html: string): string {
  return propre(decoderEntites(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "") ?? "")).slice(0, 120);
}
