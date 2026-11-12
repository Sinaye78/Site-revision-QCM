import type { Cours } from "./db";
import { extensionDe, lireFichier } from "./fichiers";
import type { Question } from "./quiz";

/**
 * Relie une citation du cours à la page du PDF d'origine où elle se trouve,
 * pour que l'élève puisse ouvrir le PDF directement au bon endroit.
 * La recherche se fait sur un texte simplifié (sans accents ni ponctuation).
 */
export function simplifier(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function textesDesPages(contenu: Buffer): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(contenu));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map(String);
}

/** Numéro de page (à partir de 1) qui contient l'extrait, ou null. Essaie la citation entière, puis des morceaux. */
export function trouverPage(pages: string[], extrait: string): number | null {
  const cible = simplifier(extrait);
  if (cible.length < 12) return null;
  const simples = pages.map(simplifier);
  const chercher = (morceau: string) => {
    const i = simples.findIndex((p) => p.includes(morceau));
    return i >= 0 ? i + 1 : null;
  };
  const entiere = chercher(cible);
  if (entiere) return entiere;
  // La citation peut chevaucher deux pages ou avoir été un peu retouchée : on cherche des fenêtres de 6 mots.
  const mots = cible.split(" ");
  for (let debut = 0; debut + 6 <= mots.length; debut += 3) {
    const trouve = chercher(mots.slice(debut, debut + 6).join(" "));
    if (trouve) return trouve;
  }
  return null;
}

/** Le PDF principal du cours (le premier envoyé), s'il y en a un. */
export function pdfDuCours(cours: Pick<Cours, "fichiers">): { fichier: string; nom: string } | null {
  const f = cours.fichiers.find((x) => extensionDe(x.fichier) === "pdf");
  return f ? { fichier: f.fichier, nom: f.nom } : null;
}

/** Ajoute à chaque question la page du PDF qui contient son extrait. Ne lance jamais d'erreur. */
export async function ajouterPages(cours: Pick<Cours, "fichiers">, questions: Question[]): Promise<Question[]> {
  const pdf = pdfDuCours(cours);
  if (!pdf || !questions.some((q) => q.extrait)) return questions;
  try {
    const lu = lireFichier(pdf.fichier);
    if (!lu) return questions;
    const pages = await textesDesPages(lu.contenu);
    if (pages.length < 2) return questions;
    return questions.map((q) => {
      const page = q.extrait ? trouverPage(pages, q.extrait) : null;
      const { page: _donneeParLIA, ...reste } = q;
      return page ? { ...reste, page } : reste;
    });
  } catch (e) {
    console.error("[pages-pdf]", e instanceof Error ? e.message : e);
    return questions;
  }
}
