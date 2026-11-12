/**
 * Transforme les fichiers envoyés en texte (PDF, Word, PowerPoint, LibreOffice,
 * RTF, pages web, texte) ou en images (photos de cours et pages de PDF scannés,
 * que l'IA lit elle-même). Garde aussi les originaux pour les ranger dans « Mes cours ».
 */
import { extensionDe } from "./fichiers";
import { textePptx, texteOdf, texteRtf, texteHtml, titreHtml } from "./formats";
import { encoderPng, reduire } from "./illustrations";
import { ErreurLien, telechargerPage } from "./lien-web";

export class ErreurUtilisateur extends Error {}

export type Original = { nom: string; extension: string; contenu: Buffer };
export type Contenu = { texte: string; images: string[]; noms: string[]; tronque: boolean; originaux: Original[]; titre?: string };

export const MAX_FICHIERS = 6;
export const MAX_IMAGES = 5;
export const MAX_OCTETS_FICHIER = 15 * 1024 * 1024;
export const MAX_CARACTERES = 80_000;

const TYPES_IMAGES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const EXTENSIONS_IMAGES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** Les formats acceptés, pour le message d'erreur et le sélecteur de fichiers. */
export const FORMATS_ACCEPTES = "PDF, Word (.docx), PowerPoint (.pptx), LibreOffice (.odt, .odp), .rtf, page web (.html), .txt ou photos";

/** Une page de PDF scanné, en image (la plus grande image de la page). */
async function pagesScannees(contenu: Buffer, nom: string, place: number): Promise<{ png: Buffer; page: number }[]> {
  const { extractImages, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(contenu));
  const pages: { png: Buffer; page: number }[] = [];
  for (let page = 1; page <= pdf.numPages && pages.length < place; page++) {
    const images = await extractImages(pdf, page).catch(() => []);
    const grande = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!grande || grande.width * grande.height < 200_000) continue;
    const pixels = new Uint8ClampedArray(grande.data.buffer, grande.data.byteOffset, grande.data.length);
    // Assez net pour lire l'écriture, assez léger pour l'envoyer à l'IA.
    const r = reduire(pixels, grande.width, grande.height, 4, 1800);
    pages.push({ png: encoderPng(r.pixels, r.l, r.h, 4), page });
  }
  if (!pages.length) {
    throw new ErreurUtilisateur(`« ${nom} » ne contient presque pas de texte et ses pages n'ont pas pu être lues. Prends plutôt les pages en photo.`);
  }
  if (pdf.numPages > place) {
    throw new ErreurUtilisateur(
      `« ${nom} » est un PDF scanné de ${pdf.numPages} pages : je peux en lire ${MAX_IMAGES} au maximum à la fois. Découpe-le en plusieurs cours, ou envoie seulement les pages utiles.`
    );
  }
  return pages;
}

/** Texte d'un PDF ; s'il n'y en a presque pas (PDF scanné), ses pages deviennent des images. */
async function lirePdf(buffer: Buffer, nom: string, placeImages: number): Promise<{ texte: string; pages: { png: Buffer; page: number }[] }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let texte = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    texte = String((await extractText(pdf, { mergePages: true })).text).replace(/[ \t]+/g, " ").trim();
  } catch {
    throw new ErreurUtilisateur(`« ${nom} » est abîmé ou protégé par un mot de passe. Réenregistre-le, ou prends les pages en photo.`);
  }
  if (texte.length >= 80) return { texte, pages: [] };
  if (placeImages <= 0) throw new ErreurUtilisateur(`${MAX_IMAGES} photos ou pages scannées maximum à la fois.`);
  return { texte: "", pages: await pagesScannees(buffer, nom, placeImages) };
}

async function texteWord(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

/** Lit le texte d'un fichier bureautique ; une erreur de lecture devient un message pour l'élève. */
async function lireBureautique(lecture: () => Promise<string> | string, nom: string): Promise<string> {
  try {
    const texte = await lecture();
    if (!texte.trim()) throw new ErreurUtilisateur(`« ${nom} » ne contient pas de texte lisible.`);
    return texte;
  } catch (e) {
    if (e instanceof ErreurUtilisateur) throw e;
    throw new ErreurUtilisateur(e instanceof Error && e.message.startsWith("«") ? e.message : `« ${nom} » n'a pas pu être lu. Réenregistre-le en PDF ou en .docx.`);
  }
}

/** Assemble le texte final et vérifie qu'il y a de quoi faire un QCM. */
export function finaliser(morceaux: string[], images: string[]): { texte: string; tronque: boolean } {
  let texte = morceaux.filter(Boolean).join("\n\n---\n\n");
  let tronque = false;
  if (texte.length > MAX_CARACTERES) {
    texte = texte.slice(0, MAX_CARACTERES);
    tronque = true;
  }
  if (!texte && images.length === 0) throw new ErreurUtilisateur("Ajoute un cours : un fichier, des photos, un lien ou du texte collé.");
  if (texte && texte.length < 150 && images.length === 0) {
    throw new ErreurUtilisateur("Le cours est trop court pour en tirer un QCM. Ajoute un peu plus de contenu.");
  }
  return { texte, tronque };
}

type Lecture = { morceaux: string[]; images: string[]; originaux: Original[]; noms: string[] };

/** Ajoute un fichier (envoyé ou téléchargé depuis un lien) à la lecture en cours. */
async function lireUnFichier(l: Lecture, nom: string, typeMime: string, contenu: Buffer) {
  let ext = extensionDe(nom);
  const type = typeMime.split(";")[0].trim().toLowerCase();
  if (ext === "pdf" || type === "application/pdf") {
    const { texte, pages } = await lirePdf(contenu, nom, MAX_IMAGES - l.images.length);
    if (texte) l.morceaux.push(texte);
    for (const p of pages) {
      l.images.push(`data:image/png;base64,${p.png.toString("base64")}`);
      l.originaux.push({ nom: `${nom.replace(/\.pdf$/i, "")} - page ${p.page}.png`, extension: "png", contenu: p.png });
    }
    ext = "pdf";
  } else if (ext === "docx") {
    l.morceaux.push(await lireBureautique(() => texteWord(contenu), nom));
  } else if (ext === "pptx") {
    l.morceaux.push(await lireBureautique(() => textePptx(contenu, nom), nom));
  } else if (ext === "odt" || ext === "odp") {
    l.morceaux.push(await lireBureautique(() => texteOdf(contenu, nom), nom));
  } else if (ext === "rtf") {
    l.morceaux.push(await lireBureautique(() => texteRtf(contenu.toString("latin1")), nom));
  } else if (ext === "html" || ext === "htm" || type === "text/html" || type === "application/xhtml+xml") {
    const html = contenu.toString("utf8");
    l.morceaux.push(await lireBureautique(() => texteHtml(html), nom));
    ext = "html";
  } else if (ext === "doc" || ext === "ppt") {
    throw new ErreurUtilisateur(`« ${nom} » est un ancien format Office (.${ext}). Réenregistre-le en .${ext}x ou en PDF.`);
  } else if (["txt", "md"].includes(ext) || type.startsWith("text/")) {
    ext = ext === "md" ? "md" : "txt";
    l.morceaux.push(contenu.toString("utf8").trim());
  } else if (TYPES_IMAGES[type] || EXTENSIONS_IMAGES[ext]) {
    if (l.images.length >= MAX_IMAGES) throw new ErreurUtilisateur(`${MAX_IMAGES} photos ou pages scannées maximum à la fois.`);
    const mime = TYPES_IMAGES[type] ? type : EXTENSIONS_IMAGES[ext];
    ext = TYPES_IMAGES[mime];
    l.images.push(`data:${mime};base64,${contenu.toString("base64")}`);
  } else if (type === "image/heic" || type === "image/heif" || ext === "heic" || ext === "heif") {
    throw new ErreurUtilisateur(`« ${nom} » est une photo au format HEIC (iPhone). Dans Réglages → Appareil photo → Formats, choisis « Le plus compatible », ou envoie une capture d'écran.`);
  } else {
    throw new ErreurUtilisateur(`Je ne sais pas lire « ${nom} ». Envoie un ${FORMATS_ACCEPTES}.`);
  }
  l.noms.push(nom);
  l.originaux.push({ nom, extension: ext, contenu });
}

/** Nom de fichier lisible pour une page téléchargée. */
function nomDepuisLien(url: string, extension: string): string {
  const u = new URL(url);
  const dernier = decodeURIComponent(u.pathname.split("/").filter(Boolean).at(-1) ?? "").replace(/\.[a-z0-9]+$/i, "");
  return `${(dernier || u.hostname).slice(0, 60)}.${extension}`;
}

export async function extraireContenu(fichiers: File[], texteColle: string, lien = ""): Promise<Contenu> {
  if (fichiers.length > MAX_FICHIERS) throw new ErreurUtilisateur(`${MAX_FICHIERS} fichiers maximum à la fois.`);
  const l: Lecture = { morceaux: [], images: [], originaux: [], noms: [] };
  let titre: string | undefined;

  for (const f of fichiers) {
    if (f.size === 0) continue;
    if (f.size > MAX_OCTETS_FICHIER) throw new ErreurUtilisateur(`« ${f.name} » est trop lourd (15 Mo maximum).`);
    await lireUnFichier(l, f.name, f.type, Buffer.from(await f.arrayBuffer()));
  }

  if (lien.trim()) {
    let page;
    try {
      page = await telechargerPage(lien);
    } catch (e) {
      throw new ErreurUtilisateur(e instanceof ErreurLien ? e.message : "La page n'a pas pu être ouverte. Vérifie le lien.");
    }
    const type = page.type.split(";")[0];
    const extension = type === "application/pdf" ? "pdf" : type.startsWith("text/html") || type === "application/xhtml+xml" ? "html" : type.startsWith("text/") ? "txt" : "";
    if (!extension) throw new ErreurUtilisateur("Ce lien ne mène pas à une page de cours lisible (page web, PDF ou texte).");
    if (extension === "html") titre = titreHtml(page.contenu.toString("utf8")) || undefined;
    await lireUnFichier(l, nomDepuisLien(page.url, extension), page.type, page.contenu);
    l.morceaux[l.morceaux.length - 1] = `Source : ${page.url}\n\n${l.morceaux.at(-1) ?? ""}`;
  }

  if (texteColle.trim()) l.morceaux.push(texteColle.trim());
  const { texte, tronque } = finaliser(l.morceaux, l.images);
  return { texte, images: l.images, noms: l.noms, tronque, originaux: l.originaux, titre };
}
