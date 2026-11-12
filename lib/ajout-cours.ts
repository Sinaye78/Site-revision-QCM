import { creerCours, type Cours } from "./db";
import { extraireContenu } from "./extraction";
import { lireFichier, rangerFichier, supprimerFichier, type FichierCours } from "./fichiers";

/** Titre provisoire : le nom du premier fichier, sinon le début du texte. L'IA le remplacera. */
/** Images collées avec le texte d'un cours (voir components/collage.ts). */
export const estImageCollee = (nom: string) => /^image-collee-\d+\./.test(nom);

function titreProvisoire(noms: string[], texte: string): string {
  noms = noms.filter((n) => !estImageCollee(n));
  if (noms.length > 0) return noms[0].replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Mon cours";
  const premiere = texte.split("\n").find((l) => l.trim())?.trim() ?? "";
  return premiere.length > 60 ? `${premiere.slice(0, 57)}…` : premiere || "Mon cours";
}

/**
 * Range un nouveau cours envoyé par l'élève (fichiers et/ou texte collé) dans
 * « Mes cours ». Renvoie aussi ce qu'il faut donner à l'IA.
 */
export async function ajouterCours(
  u: string,
  form: FormData
): Promise<{ coursId: string; texte: string; images: string[]; tronque: boolean }> {
  const fichiers = form.getAll("fichiers").filter((f): f is File => f instanceof File);
  const contenu = await extraireContenu(fichiers, String(form.get("texte") ?? ""), String(form.get("lien") ?? ""));

  const ranges: FichierCours[] = [];
  try {
    for (const o of contenu.originaux) {
      const fichier = rangerFichier(o.contenu, o.extension);
      if (fichier) ranges.push({ nom: o.nom, fichier, type: lireFichier(fichier)?.type ?? "" });
    }
    const titreDonne = String(form.get("titre") ?? "").trim().slice(0, 120);
    const coursId = creerCours(u, {
      titre: titreDonne || contenu.titre || titreProvisoire(contenu.noms, contenu.texte),
      titreAuto: !titreDonne,
      source: String(form.get("lien") ?? "").trim() && contenu.noms.length === 1 ? sourceDu([], String(form.get("lien"))) : sourceDu(contenu.noms),
      texte: contenu.texte,
      fichiers: ranges,
      dossierId: String(form.get("dossier") ?? "") || null,
    });
    return { coursId, texte: contenu.texte, images: contenu.images, tronque: contenu.tronque };
  } catch (e) {
    ranges.forEach((f) => supprimerFichier(f.fichier));
    throw e;
  }
}

function sourceDu(noms: string[], lien = ""): string {
  if (lien.trim()) return lien.trim().slice(0, 300);
  const collees = noms.filter(estImageCollee).length;
  const autres = noms.filter((n) => !estImageCollee(n));
  if (autres.length > 0) return autres.join(", ");
  return collees > 0 ? `Texte collé avec ${collees} image${collees > 1 ? "s" : ""}` : "Texte collé";
}

/** Les photos d'un cours déjà rangé, prêtes à être envoyées à l'IA. */
export function imagesDuCours(cours: Cours): string[] {
  return cours.fichiers.flatMap((f) => {
    if (!f.type.startsWith("image/")) return [];
    const lu = lireFichier(f.fichier);
    return lu ? [`data:${lu.type};base64,${lu.contenu.toString("base64")}`] : [];
  });
}
