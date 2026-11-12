import JSZip from "jszip";
import type { Bloc, Fiche } from "./fiche";
import type { Quiz } from "./quiz";
import type { Controle } from "./controle";
import { extensionDe, lireFichier } from "./fichiers";

/**
 * Exports d'une fiche ou d'un QCM : Markdown (texte simple, pour Obsidian,
 * Notion…) et Word (.docx, construit à la main : pas de dépendance en plus).
 */
export type ElementDoc =
  | { type: "titre"; niveau: 1 | 2 | 3; texte: string }
  | { type: "paragraphe"; texte: string; style?: "important" | "exemple" | "discret" | "formule" }
  | { type: "puce"; texte: string }
  | { type: "image"; fichier: string; legende: string }
  | { type: "saut" };

const LETTRES = ["A", "B", "C", "D"];

/* ---------------- Fiche et QCM → éléments ---------------- */

function elementsBloc(b: Bloc): ElementDoc[] {
  const ajout = b.ajout_ia ? " (ajouté par l'IA)" : "";
  switch (b.type) {
    case "paragraphe":
      return [{ type: "paragraphe", texte: b.texte + ajout }];
    case "liste":
      return b.elements.map((e) => ({ type: "puce" as const, texte: e }));
    case "definition":
      return [{ type: "paragraphe", texte: `**${b.terme.replace(/\*\*/g, "")}** : ${b.texte}${ajout}` }];
    case "important":
      return [{ type: "paragraphe", texte: `À retenir : ${b.texte}${ajout}`, style: "important" }];
    case "date":
      return [{ type: "paragraphe", texte: `**${b.date.replace(/\*\*/g, "")}** — ${b.texte}${ajout}` }];
    case "formule":
      return [
        { type: "paragraphe", texte: b.texte, style: "formule" },
        ...(b.explication ? [{ type: "paragraphe" as const, texte: b.explication, style: "discret" as const }] : []),
      ];
    case "exemple":
      return [{ type: "paragraphe", texte: `Exemple : ${b.texte}${ajout}`, style: "exemple" }];
    case "image":
      return b.fichier ? [{ type: "image", fichier: b.fichier, legende: b.legende }] : [];
  }
}

export function ficheEnElements(fiche: Fiche, titre: string): ElementDoc[] {
  const el: ElementDoc[] = [{ type: "titre", niveau: 1, texte: titre }];
  if (fiche.matiere) el.push({ type: "paragraphe", texte: fiche.matiere, style: "discret" });
  if (fiche.resume) el.push({ type: "paragraphe", texte: `En bref : ${fiche.resume}`, style: "important" });
  fiche.sections.forEach((s, i) => {
    el.push({ type: "titre", niveau: 2, texte: `${i + 1}. ${s.titre}` });
    s.blocs.forEach((b) => el.push(...elementsBloc(b)));
  });
  if (fiche.mots_cles.length) el.push({ type: "paragraphe", texte: `Mots-clés : ${fiche.mots_cles.join(", ")}`, style: "discret" });
  return el;
}

/** Le sujet (questions et cases à cocher), puis le corrigé sur une nouvelle page. */
export function qcmEnElements(quiz: Quiz, titre: string): ElementDoc[] {
  const questions = quiz.questions.filter((q) => !q.signalee);
  const el: ElementDoc[] = [
    { type: "titre", niveau: 1, texte: titre },
    { type: "paragraphe", texte: `${quiz.matiere ? `${quiz.matiere} · ` : ""}${questions.length} questions · une seule bonne réponse par question`, style: "discret" },
    { type: "paragraphe", texte: "Nom : ____________________    Note : ______ / 20", style: "discret" },
  ];
  questions.forEach((q, i) => {
    el.push({ type: "titre", niveau: 3, texte: `${i + 1}. ${q.question}` });
    q.choix.forEach((c, j) => el.push({ type: "paragraphe", texte: `☐  ${LETTRES[j]}. ${c}` }));
  });
  el.push({ type: "saut" }, { type: "titre", niveau: 2, texte: "Corrigé" });
  questions.forEach((q, i) => {
    el.push({ type: "paragraphe", texte: `**${i + 1}. ${LETTRES[q.bonne_reponse]}** — ${q.choix[q.bonne_reponse]}` });
    el.push({ type: "paragraphe", texte: q.explication + (q.page ? ` (cours, page ${q.page})` : ""), style: "discret" });
  });
  return el;
}

/* ---------------- Markdown ---------------- */

export function enMarkdown(elements: ElementDoc[]): string {
  const lignes: string[] = [];
  for (const e of elements) {
    if (e.type === "titre") lignes.push(`${"#".repeat(e.niveau)} ${e.texte}`, "");
    else if (e.type === "puce") lignes.push(`- ${e.texte}`);
    else if (e.type === "saut") lignes.push("", "---", "");
    else if (e.type === "image") lignes.push(`*[Image : ${e.legende || "illustration du cours"}]*`, "");
    else if (e.style === "important") lignes.push(`> ${e.texte}`, "");
    else if (e.style === "formule") lignes.push("```", e.texte, "```", "");
    else if (e.style === "exemple" || e.style === "discret") lignes.push(`*${e.texte.replace(/\*\*/g, "")}*`, "");
    else lignes.push(e.texte, "");
  }
  // Une liste reste groupée, puis une ligne vide la sépare de la suite.
  return lignes.join("\n").replace(/(^- .*\n)(?!- |\n)/gm, "$1\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ---------------- Word (.docx) ---------------- */

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** « un **mot** important » → morceaux de texte, en gras pour le mot. */
function runs(texte: string, base = ""): string {
  return texte
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((m) => {
      const gras = m.startsWith("**") && m.endsWith("**") && m.length > 4;
      const contenu = gras ? m.slice(2, -2) : m;
      return `<w:r><w:rPr>${base}${gras ? "<w:b/><w:highlight w:val=\"yellow\"/>" : ""}</w:rPr><w:t xml:space="preserve">${echapper(contenu)}</w:t></w:r>`;
    })
    .join("");
}

/** Taille en pixels d'une image PNG, JPEG ou GIF (lue dans son en-tête). */
export function tailleImage(contenu: Buffer, ext: string): { l: number; h: number } | null {
  if (ext === "png" && contenu.length > 24) return { l: contenu.readUInt32BE(16), h: contenu.readUInt32BE(20) };
  if (ext === "gif" && contenu.length > 10) return { l: contenu.readUInt16LE(6), h: contenu.readUInt16LE(8) };
  if (ext === "jpg" || ext === "jpeg") {
    let i = 2;
    while (i + 9 < contenu.length) {
      if (contenu[i] !== 0xff) return null;
      const marqueur = contenu[i + 1];
      const longueur = contenu.readUInt16BE(i + 2);
      if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) return { h: contenu.readUInt16BE(i + 5), l: contenu.readUInt16BE(i + 7) };
      i += 2 + longueur;
    }
  }
  return null;
}

const STYLES_PARAGRAPHE: Record<string, string> = {
  important: '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="D1342F"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF3A6"/>',
  exemple: '<w:ind w:left="360"/>',
  discret: "",
  formule: '<w:shd w:val="clear" w:color="auto" w:fill="F2F4F8"/><w:ind w:left="360"/>',
};
const RUNS_PARAGRAPHE: Record<string, string> = { exemple: "<w:i/>", discret: '<w:color w:val="5A6680"/><w:sz w:val="20"/>', formule: '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' };

export async function enDocx(elements: ElementDoc[], titre: string): Promise<Buffer> {
  const zip = new JSZip();
  const relations: string[] = [];
  const types = new Set<string>();
  const corps: string[] = [];
  let numeroImage = 0;

  for (const e of elements) {
    if (e.type === "titre") {
      corps.push(`<w:p><w:pPr><w:pStyle w:val="${e.niveau === 1 ? "Title" : `Heading${e.niveau - 1}`}"/></w:pPr>${runs(e.texte)}</w:p>`);
    } else if (e.type === "puce") {
      corps.push(`<w:p><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>${runs(`•\t${e.texte}`)}</w:p>`);
    } else if (e.type === "saut") {
      corps.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    } else if (e.type === "image") {
      const lu = lireFichier(e.fichier);
      const ext = extensionDe(e.fichier);
      const taille = lu ? tailleImage(lu.contenu, ext) : null;
      if (!lu || !taille || !taille.l || !taille.h) continue;
      numeroImage++;
      const nom = `image${numeroImage}.${ext === "jpeg" ? "jpg" : ext}`;
      zip.file(`word/media/${nom}`, lu.contenu);
      types.add(ext === "jpeg" ? "jpg" : ext);
      const rid = `rIdImage${numeroImage}`;
      relations.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${nom}"/>`);
      // 15 cm de large au maximum, 12 cm de haut (unités EMU : 360 000 par cm).
      const echelle = Math.min(1, (15 * 360000) / (taille.l * 9525), (12 * 360000) / (taille.h * 9525));
      const cx = Math.round(taille.l * 9525 * echelle);
      const cy = Math.round(taille.h * 9525 * echelle);
      corps.push(
        `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${numeroImage}" name="${nom}"/>` +
          `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
          `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${numeroImage}" name="${nom}"/><pic:cNvPicPr/></pic:nvPicPr>` +
          `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
          `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
          `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
      );
      if (e.legende) corps.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${runs(e.legende, RUNS_PARAGRAPHE.discret + "<w:i/>")}</w:p>`);
    } else {
      const style = e.style ?? "";
      corps.push(`<w:p><w:pPr>${STYLES_PARAGRAPHE[style] ?? ""}</w:pPr>${runs(e.texte, RUNS_PARAGRAPHE[style] ?? "")}</w:p>`);
    }
  }

  const imagesTypes = [...types].map((t) => `<Default Extension="${t}" ContentType="image/${t === "jpg" ? "jpeg" : t}"/>`).join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imagesTypes}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${echapper(titre)}</dc:title><dc:creator>Révision QCM</dc:creator></cp:coreProperties>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${relations.join("")}</Relationships>`
  );
  const titreStyle = (id: string, nom: string, taille: number, couleur: string, avant: number) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nom}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${avant}" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="${couleur}"/><w:sz w:val="${taille}"/></w:rPr></w:style>`;
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="23"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${titreStyle("Title", "Title", 40, "22314F", 0)}${titreStyle("Heading1", "heading 1", 30, "D1342F", 360)}${titreStyle("Heading2", "heading 2", 25, "22314F", 240)}</w:styles>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${corps.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Nom de fichier propre, sans caractères interdits. */
export function nomDeFichier(titre: string, extension: string): string {
  const base = titre.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "cours";
  return `${base}.${extension}`;
}

export const TYPES_EXPORT = {
  md: "text/markdown; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Un contrôle sur papier : le sujet avec le barème et des lignes pour rédiger, puis le corrigé détaillé. */
export function controleEnElements(c: Controle, titre: string, dureeMin: number): ElementDoc[] {
  const pts = (p: number) => `${String(p).replace(".", ",")} pt${p > 1 ? "s" : ""}`;
  const total = c.questions.reduce((n, q) => n + q.points, 0);
  const el: ElementDoc[] = [
    { type: "titre", niveau: 1, texte: titre },
    { type: "paragraphe", texte: `${c.matiere ? `${c.matiere} · ` : ""}Contrôle sur ${String(total).replace(".", ",")} points${dureeMin ? ` · ${dureeMin} minutes` : ""}`, style: "discret" },
    { type: "paragraphe", texte: "Nom : ____________________    Note : ______ / 20", style: "discret" },
  ];
  c.questions.forEach((q, i) => {
    el.push({ type: "titre", niveau: 3, texte: `${i + 1}. ${q.type === "trous" ? "Complète le texte." : q.type === "vrai_faux" ? "Vrai ou faux ?" : q.enonce} (${pts(q.points)})` });
    if (q.type === "qcm") q.choix.forEach((ch, j) => el.push({ type: "paragraphe", texte: `☐  ${LETTRES[j]}. ${ch}` }));
    else if (q.type === "vrai_faux") el.push({ type: "paragraphe", texte: `${q.enonce}    ☐ Vrai   ☐ Faux` });
    else if (q.type === "trous") el.push({ type: "paragraphe", texte: q.enonce.replace(/_{3,}/g, "______________") });
    else for (let k = 0; k < (q.type === "courte" ? 2 : 7); k++) el.push({ type: "paragraphe", texte: "_".repeat(80), style: "discret" });
  });
  el.push({ type: "saut" }, { type: "titre", niveau: 2, texte: "Corrigé et barème" });
  c.questions.forEach((q, i) => {
    let reponse = "";
    if (q.type === "qcm") reponse = `${LETTRES[q.bonne_reponse]}. ${q.choix[q.bonne_reponse]}`;
    else if (q.type === "vrai_faux") reponse = q.reponse ? "Vrai" : "Faux";
    else if (q.type === "trous") reponse = q.reponses.map((r) => r.join(" / ")).join(" ; ");
    else reponse = q.reponse_modele;
    el.push({ type: "paragraphe", texte: `**${i + 1}. (${pts(q.points)})** ${reponse}` });
    if (q.type === "courte" || q.type === "redigee") q.elements_attendus.forEach((e) => el.push({ type: "puce", texte: e }));
    else if (q.explication) el.push({ type: "paragraphe", texte: q.explication, style: "discret" });
  });
  return el;
}
