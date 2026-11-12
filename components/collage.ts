/**
 * Collage d'un cours (page web, Word, Google Docs, capture d'écran) : on garde
 * le texte ET les images. Chaque image est remplacée dans le texte par un
 * repère « [Image N] », pour que l'IA sache où elle était.
 */
export const MAX_IMAGES_COLLEES = 5;

const TYPES_ACCEPTES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const COTE_MAX = 2000;
const OCTETS_MAX = 3 * 1024 * 1024;

export const repere = (n: number) => `[Image ${n}]`;

/** Remet une image dans un format accepté par le site, et pas trop lourde. */
async function normaliser(blob: Blob, nom: string): Promise<File | null> {
  if (!blob.type.startsWith("image/")) return null;
  if (TYPES_ACCEPTES.includes(blob.type) && blob.size <= OCTETS_MAX) {
    const ext = blob.type.split("/")[1].replace("jpeg", "jpg");
    return new File([blob], `${nom}.${ext}`, { type: blob.type });
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const k = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const sortie = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return sortie ? new File([sortie], `${nom}.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}

/** Récupère une image d'une page collée (data:, blob: ou adresse web si le site l'autorise). */
async function telecharger(src: string, nom: string): Promise<File | null> {
  try {
    const rep = await fetch(src);
    if (!rep.ok) return null;
    return await normaliser(await rep.blob(), nom);
  } catch {
    return null;
  }
}

const BLOCS = new Set(["P", "DIV", "SECTION", "ARTICLE", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TR", "TABLE", "UL", "OL", "BLOCKQUOTE", "PRE", "FIGURE", "FIGCAPTION", "HEADER", "FOOTER"]);
const IGNORES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK"]);

/**
 * Transforme le HTML collé en texte, en mettant un repère à la place de chaque
 * image. Le HTML est seulement lu (DOMParser), jamais affiché ni exécuté.
 */
function texteDepuisHtml(html: string, premierNumero: number, places: number): { texte: string; sources: string[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sources: string[] = [];
  let texte = "";
  const finDeLigne = () => {
    if (texte && !texte.endsWith("\n")) texte += "\n";
  };

  function parcourir(n: Node) {
    if (n.nodeType === Node.TEXT_NODE) {
      texte += (n.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    if (IGNORES.has(el.tagName)) return;
    if (el.tagName === "BR") return void (texte += "\n");
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src") ?? "";
      // Les toutes petites images (icônes, puces) ne servent à rien pour réviser.
      const l = Number(el.getAttribute("width") || 0);
      const h = Number(el.getAttribute("height") || 0);
      if (src && !(l && l < 40) && !(h && h < 40) && sources.length < places) {
        sources.push(src);
        finDeLigne();
        texte += `${repere(premierNumero + sources.length - 1)}\n`;
      }
      return;
    }
    const bloc = BLOCS.has(el.tagName);
    if (bloc) finDeLigne();
    if (el.tagName === "LI") texte += "- ";
    el.childNodes.forEach(parcourir);
    if (el.tagName === "TD" || el.tagName === "TH") texte += " | ";
    if (bloc) finDeLigne();
  }

  doc.body.childNodes.forEach(parcourir);
  const propre = texte
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { texte: propre, sources };
}

export type ResultatCollage = { texte: string; images: File[]; perdues: number } | null;

export type Colle = { html: string; fichiers: File[] };

/**
 * À appeler PENDANT l'événement « paste » (après, le presse-papiers n'est plus
 * lisible). Renvoie null s'il n'y a aucune image : le navigateur colle alors
 * le texte normalement.
 */
export function lirePressePapiers(donnees: DataTransfer): Colle | null {
  const html = donnees.getData("text/html");
  const fichiers = Array.from(donnees.files).filter((f) => f.type.startsWith("image/"));
  if ((html && /<img[\s>]/i.test(html)) || fichiers.length > 0) return { html, fichiers };
  return null;
}

/** Retire le repère de l'image n°numero et renumérote les suivantes. */
export function retirerRepere(texte: string, numero: number): string {
  return texte
    .replace(new RegExp(`\\[Image ${numero}\\]\\n?`, "g"), "")
    .replace(/\[Image (\d+)\]/g, (m, n: string) => (Number(n) > numero ? repere(Number(n) - 1) : m));
}

export async function lireCollage({ html, fichiers }: Colle, dejaCollees: number): Promise<ResultatCollage> {
  const places = MAX_IMAGES_COLLEES - dejaCollees;

  // Une page web ou un document : texte + images à leur place.
  if (html && /<img[\s>]/i.test(html)) {
    const { texte, sources } = texteDepuisHtml(html, dejaCollees + 1, Math.max(0, places));
    const recuperees = await Promise.all(sources.map((src, i) => telecharger(src, `image-collee-${dejaCollees + i + 1}`)));
    const images = recuperees.filter((f): f is File => f !== null);
    // Les images qu'on n'a pas pu récupérer : on enlève leur repère, et on renumérote les autres.
    let numero = dejaCollees;
    let k = 0;
    const final = texte
      .replace(/\[Image \d+\]\n?/g, () => (recuperees[k++] ? `${repere(++numero)}\n` : ""))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { texte: final, images, perdues: sources.length - images.length };
  }

  // Une capture d'écran ou une image copiée seule.
  if (fichiers.length > 0) {
    const images: File[] = [];
    for (const f of fichiers.slice(0, Math.max(0, places))) {
      const n = await normaliser(f, `image-collee-${dejaCollees + images.length + 1}`);
      if (n) images.push(n);
    }
    const texte = images.map((_, i) => repere(dejaCollees + i + 1)).join("\n");
    return { texte, images, perdues: fichiers.length - images.length };
  }
  return null;
}
