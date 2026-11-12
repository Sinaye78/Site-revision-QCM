import { createHash } from "node:crypto";
import zlib from "node:zlib";
import type { Cours } from "./db";
import { extensionDe, lireFichier, rangerFichier } from "./fichiers";

/**
 * Illustrations d'un cours : les schémas, photos et dessins rangés DANS un PDF
 * ou un Word. On les sort du document pour que la fiche « au propre » puisse
 * les remettre à leur place (sinon l'IA ne garde que le texte).
 */
export type ContexteIllustration = { avant?: string; apres?: string; page?: number; positionConnue?: boolean };
export type Illustration = { fichier: string; nom: string } & ContexteIllustration;
type ImageExtraite = { png: Buffer; nom: string; ext: string } & ContexteIllustration;

export const MAX_ILLUSTRATIONS = 10;
const COTE_MAX = 1400;

/* ---------------- Petit encodeur PNG (pixels bruts → fichier) ---------------- */

function morceau(type: string, donnees: Buffer): Buffer {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(corps) >>> 0);
  return Buffer.concat([longueur, corps, crc]);
}

export function encoderPng(pixels: Uint8Array | Uint8ClampedArray, largeur: number, hauteur: number, canaux: number): Buffer {
  const typeCouleur = canaux === 1 ? 0 : canaux === 3 ? 2 : 6;
  const tete = Buffer.alloc(13);
  tete.writeUInt32BE(largeur, 0);
  tete.writeUInt32BE(hauteur, 4);
  tete[8] = 8;
  tete[9] = typeCouleur;
  const ligne = largeur * canaux;
  const brut = Buffer.alloc((ligne + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (ligne + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * ligne, ligne).copy(brut, y * (ligne + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", tete),
    morceau("IDAT", zlib.deflateSync(brut, { level: 8 })),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

/** Réduit une image trop grande (moyenne de blocs de pixels). */
export function reduire(pixels: Uint8ClampedArray, l: number, h: number, c: number, coteMax = COTE_MAX) {
  const k = Math.ceil(Math.max(l, h) / coteMax);
  if (k <= 1) return { pixels, l, h };
  const nl = Math.floor(l / k);
  const nh = Math.floor(h / k);
  const sortie = new Uint8ClampedArray(nl * nh * c);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nl; x++) {
      for (let can = 0; can < c; can++) {
        let somme = 0;
        for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) somme += pixels[((y * k + dy) * l + (x * k + dx)) * c + can];
        sortie[(y * nl + x) * c + can] = somme / (k * k);
      }
    }
  }
  return { pixels: sortie, l: nl, h: nh };
}

/** Écarte les petits logos, les traits et les fonds unis (rien d'utile pour réviser). */
function vautLaPeine(pixels: Uint8ClampedArray, l: number, h: number, c: number): boolean {
  if (l < 120 || h < 80 || l * h < 25_000) return false;
  if (l / h > 8 || h / l > 8) return false;
  // Écart-type de la luminosité sur ~2000 points : presque nul = fond uni.
  const pas = Math.max(1, Math.floor((l * h) / 2000));
  let n = 0;
  let somme = 0;
  let carres = 0;
  for (let i = 0; i < l * h; i += pas) {
    // Un pixel transparent compte comme du blanc (le fond de la page).
    const transparent = c === 4 && pixels[i * c + 3] < 128;
    const v = transparent ? 255 : c >= 3 ? (pixels[i * c] + pixels[i * c + 1] + pixels[i * c + 2]) / 3 : pixels[i * c];
    somme += v;
    carres += v * v;
    n++;
  }
  const moyenne = somme / n;
  return Math.sqrt(Math.max(0, carres / n - moyenne * moyenne)) > 6;
}

/* ---------------- Lecture des documents ---------------- */

async function imagesPdf(contenu: Buffer, nom: string, place: number): Promise<ImageExtraite[]> {
  const { extractImages, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(contenu));
  const trouvees: ImageExtraite[] = [];
  for (let page = 1; page <= pdf.numPages && trouvees.length < place; page++) {
    const images = await extractImages(pdf, page).catch(() => []);
    const p = await pdf.getPage(page);
    const viewport = p.getViewport({ scale: 1 });
    const texte = await p.getTextContent();
    const lignes: { x: number; fin: number; y: number; texte: string }[] = [];
    for (const item of texte.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const ligne = lignes.find(l => Math.abs(l.y - y) < 4 && x <= l.fin + 35 && x + item.width >= l.x - 35);
      if (ligne) { ligne.texte += ` ${item.str}`; ligne.fin = Math.max(ligne.fin, x + item.width); }
      else lignes.push({ x, fin: x + item.width, y, texte: item.str });
    }
    lignes.sort((a, b) => a.y - b.y || a.x - b.x);
    const voisinage = (selection: typeof lignes, avant: boolean) => {
      const ordonnees = avant ? [...selection].reverse() : selection;
      const proches: (typeof lignes)[number][] = [];
      for (const ligne of ordonnees) {
        if (proches.length >= 4 || (proches.length && Math.abs(ligne.y - proches.at(-1)!.y) > 26)) break;
        proches.push(ligne);
      }
      return (avant ? proches.reverse() : proches).map(l => l.texte).join(" ").slice(0, 600);
    };
    const position = (img: (typeof images)[number]) => {
      const b = img.bounds;
      const coins = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
        .map(([x, y]) => viewport.convertToViewportPoint(x, y));
      return { x: Math.min(...coins.map(p => p[0])), droite: Math.max(...coins.map(p => p[0])), haut: Math.min(...coins.map(p => p[1])), bas: Math.max(...coins.map(p => p[1])) };
    };
    // L'ordre de peinture du PDF n'est pas forcément son ordre de lecture.
    images.sort((a, b) => position(a).haut - position(b).haut || position(a).x - position(b).x);
    for (const img of images) {
      if (trouvees.length >= place) break;
      // unpdf donne toujours des pixels RGBA (4 octets par pixel).
      const c = 4;
      const pixels = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length);
      if (!vautLaPeine(pixels, img.width, img.height, c)) continue;
      const r = reduire(pixels, img.width, img.height, c);
      const { x, droite, haut, bas } = position(img);
      const colonne = lignes.filter(l => l.fin >= x - 12 && l.x <= droite + 12);
      const voisines = colonne.length ? colonne : lignes;
      const avant = voisinage(voisines.filter(l => l.y <= haut + 4), true);
      const apres = voisinage(voisines.filter(l => l.y >= bas - 4), false);
      trouvees.push({ png: encoderPng(r.pixels, r.l, r.h, c), ext: "png", nom: `${nom}, page ${page}`, page, avant, apres, positionConnue: true });
    }
  }
  return trouvees;
}

const EXTENSIONS_WORD: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

async function imagesWord(contenu: Buffer, nom: string, place: number): Promise<ImageExtraite[]> {
  const mammoth = await import("mammoth");
  const trouvees: ImageExtraite[] = [];
  const { value } = await mammoth.convertToHtml(
    { buffer: contenu },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const ext = EXTENSIONS_WORD[image.contentType];
        if (ext && trouvees.length < place) {
          const octets = Buffer.from(await image.read("base64"), "base64");
          // Moins de 3 Ko : une puce ou une icône.
          if (octets.length > 3000) {
            const numero = trouvees.length + 1;
            trouvees.push({ png: octets, nom: `${nom}, image ${numero}`, ext, positionConnue: true });
            return { src: `illustration-cours-${numero}` };
          }
        }
        return { src: "" };
      }),
    }
  );
  const texteHtml = (html: string) => html.replace(/<\/(?:p|h[1-6]|li|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ").trim();
  trouvees.forEach((image, i) => {
    const repere = new RegExp(`<img\\b[^>]*src="illustration-cours-${i + 1}"[^>]*>`, "i").exec(value);
    if (!repere) return;
    image.avant = texteHtml(value.slice(0, repere.index)).split(/\n+/).map(s => s.trim()).filter(Boolean).at(-1)?.slice(-600) ?? "";
    image.apres = texteHtml(value.slice(repere.index + repere[0].length)).split(/\n+/).map(s => s.trim()).filter(Boolean)[0]?.slice(0, 600) ?? "";
  });
  return trouvees;
}

/**
 * Sort les illustrations des PDF et Word d'un cours et les range comme
 * fichiers. Ne lance jamais d'erreur : sans illustration, la fiche se fait quand même.
 */
async function collecterImages(cours: Cours): Promise<ImageExtraite[]> {
  const resultat: ImageExtraite[] = [];
  const dejaVues = new Set<string>();
  for (const f of cours.fichiers) {
    const place = MAX_ILLUSTRATIONS - resultat.length;
    if (place <= 0) break;
    const ext = extensionDe(f.fichier);
    if (ext !== "pdf" && ext !== "docx") continue;
    const lu = lireFichier(f.fichier);
    if (!lu) continue;
    try {
      const trouvees =
        ext === "pdf"
          ? await imagesPdf(lu.contenu, f.nom, place)
          : await imagesWord(lu.contenu, f.nom, place);
      for (const t of trouvees) {
        const empreinte = createHash("sha1").update(t.png).digest("hex");
        if (dejaVues.has(empreinte)) continue;
        dejaVues.add(empreinte);
        resultat.push(t);
      }
    } catch (e) {
      console.error("[illustrations]", f.nom, e);
    }
  }
  return resultat;
}

export async function extraireIllustrations(cours: Cours): Promise<Illustration[]> {
  return (await collecterImages(cours)).flatMap(({ png, ext, ...contexte }) => {
    const fichier = rangerFichier(png, ext);
    return fichier ? [{ fichier, ...contexte }] : [];
  });
}

/** Retrouve les repères des anciennes fiches sans remplacer leurs fichiers ni appeler une IA. */
export async function contextualiserIllustrations(cours: Cours, illustrations: Illustration[]): Promise<Illustration[]> {
  if (illustrations.every(i => i.positionConnue)) return illustrations;
  const sources = await collecterImages(cours);
  const parEmpreinte = new Map(sources.map(({ png, ext: _ext, ...contexte }) => [createHash("sha1").update(png).digest("hex"), contexte]));
  return illustrations.map(i => {
    if (i.positionConnue) return i;
    const lu = lireFichier(i.fichier);
    const contexte = lu ? parEmpreinte.get(createHash("sha1").update(lu.contenu).digest("hex")) : undefined;
    return { ...i, ...contexte, positionConnue: true };
  });
}
