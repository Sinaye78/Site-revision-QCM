import type { Fiche } from "./fiche";

/**
 * Cartes mémoire tirées d'une fiche « au propre », sans IA : les définitions,
 * les dates et les formules expliquées sont déjà rangées dans des blocs.
 */
export type Carte = { type: "definition" | "date" | "formule"; recto: string; verso: string; section: string };

const sansEtoiles = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "$1").trim();

export function cartesDeLaFiche(fiche: Fiche): Carte[] {
  const cartes: Carte[] = [];
  const vues = new Set<string>();
  for (const s of fiche.sections) {
    for (const b of s.blocs) {
      let carte: Carte | null = null;
      if (b.type === "definition") carte = { type: "definition", recto: sansEtoiles(b.terme), verso: sansEtoiles(b.texte), section: s.titre };
      else if (b.type === "date") carte = { type: "date", recto: sansEtoiles(b.date), verso: sansEtoiles(b.texte), section: s.titre };
      else if (b.type === "formule" && b.explication.trim()) carte = { type: "formule", recto: sansEtoiles(b.explication), verso: b.texte.trim(), section: s.titre };
      if (!carte || !carte.recto || !carte.verso) continue;
      const cle = `${carte.recto}|${carte.verso}`.toLowerCase();
      if (vues.has(cle)) continue;
      vues.add(cle);
      cartes.push(carte);
    }
  }
  return cartes;
}

export const CONSIGNES_CARTES: Record<Carte["type"], string> = {
  definition: "Que veut dire ce mot ?",
  date: "Que s'est-il passé ?",
  formule: "Quelle est la formule ?",
};
