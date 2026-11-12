import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Fichiers gardés sur le serveur : cours d'origine (PDF, Word, photos) et
 * images des dossiers. Rangés dans DATA_DIR/fichiers sous un nom au hasard.
 */
export type FichierCours = { nom: string; fichier: string; type: string };

const NOM_VALIDE = /^[a-f0-9-]{36}\.(pdf|docx|pptx|odt|odp|rtf|html|txt|md|jpg|jpeg|png|webp|gif)$/;

export const TYPES_PAR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  // Une page web gardée n'est jamais servie comme page du site (elle pourrait contenir des scripts).
  html: "text/plain; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function dossierFichiers(): string {
  const dir = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "fichiers");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function extensionDe(nom: string): string {
  const i = nom.lastIndexOf(".");
  return i >= 0 ? nom.slice(i + 1).toLowerCase() : "";
}

/** Range un fichier et renvoie son nom de stockage, ou null si l'extension est refusée. */
export function rangerFichier(contenu: Buffer, extension: string): string | null {
  const ext = extension.toLowerCase();
  if (!TYPES_PAR_EXTENSION[ext]) return null;
  const nom = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(dossierFichiers(), nom), contenu);
  return nom;
}

export function lireFichier(nom: string): { contenu: Buffer; type: string } | null {
  if (!NOM_VALIDE.test(nom)) return null;
  const chemin = path.join(dossierFichiers(), nom);
  if (!fs.existsSync(chemin)) return null;
  return { contenu: fs.readFileSync(chemin), type: TYPES_PAR_EXTENSION[extensionDe(nom)] };
}

export function supprimerFichier(nom: string | null | undefined) {
  if (!nom || !NOM_VALIDE.test(nom)) return;
  fs.rmSync(path.join(dossierFichiers(), nom), { force: true });
}

/** Copie un fichier déjà rangé (quand on refait un QCM à partir d'un cours). */
export function copierFichier(nom: string): string | null {
  const f = lireFichier(nom);
  return f ? rangerFichier(f.contenu, extensionDe(nom)) : null;
}
