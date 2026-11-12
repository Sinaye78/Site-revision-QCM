import { rangerFichier } from "@/lib/fichiers";

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_OCTETS = 4 * 1024 * 1024;

/** Lit l'image envoyée pour un dossier. fichier: null si aucune image envoyée. */
export async function lireImageDossier(valeur: FormDataEntryValue | null): Promise<{ fichier: string | null } | { erreur: string }> {
  if (!(valeur instanceof File) || valeur.size === 0) return { fichier: null };
  const ext = EXTENSIONS[valeur.type];
  if (!ext) return { erreur: "L'image doit être en JPG, PNG, WebP ou GIF." };
  if (valeur.size > MAX_OCTETS) return { erreur: "L'image est trop lourde (4 Mo maximum)." };
  const fichier = rangerFichier(Buffer.from(await valeur.arrayBuffer()), ext);
  return fichier ? { fichier } : { erreur: "Image refusée." };
}
