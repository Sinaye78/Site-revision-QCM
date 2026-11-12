import { z } from "zod";

/**
 * « Fiche » : le cours remis au propre par l'IA. Ce n'est pas du HTML mais des
 * blocs typés, que le site dessine lui-même dans la DA du cahier
 * (components/fiche-cours.tsx). Dans les textes, **mot** = mot surligné.
 */
const Texte = z.string().trim().min(1).max(4000);
/** Bloc ajouté par l’IA lors d’une retouche (exemple inventé…) : affiché à part, pour ne pas le confondre avec le cours du prof. */
const AjoutIA = { ajout_ia: z.boolean().optional().catch(undefined) };

export const BlocSchema = z.discriminatedUnion("type", [
  z.object({ ...AjoutIA, type: z.literal("paragraphe"), texte: Texte }),
  z.object({ ...AjoutIA, type: z.literal("liste"), elements: z.array(Texte).min(1).max(40) }),
  z.object({ ...AjoutIA, type: z.literal("definition"), terme: z.string().trim().min(1).max(200), texte: Texte }),
  z.object({ ...AjoutIA, type: z.literal("important"), texte: Texte }),
  z.object({ ...AjoutIA, type: z.literal("date"), date: z.string().trim().min(1).max(60), texte: Texte }),
  z.object({ ...AjoutIA, type: z.literal("formule"), texte: Texte, explication: z.string().trim().max(1000).default("") }),
  z.object({ ...AjoutIA, type: z.literal("exemple"), texte: Texte }),
  // L'IA donne le numéro de l'image jointe (« image ») ; le site le remplace par le fichier rangé (« fichier »).
  z.object({
    ...AjoutIA,
    type: z.literal("image"),
    image: z.coerce.number().int().optional(),
    fichier: z.string().optional(),
    legende: z.string().trim().max(300).default(""),
  }),
]);

export const FicheSchema = z.object({
  titre: z.string().trim().min(1).max(120),
  matiere: z.string().trim().max(40).default(""),
  resume: z.string().trim().max(1200).default(""),
  sections: z
    .array(
      z.object({
        titre: z.string().trim().min(1).max(160),
        blocs: z.array(BlocSchema).min(1).max(80),
      })
    )
    .min(1)
    .max(40),
  mots_cles: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  // Images sorties du PDF ou du Word d'origine (ajoutées par le site, pas par l'IA).
  illustrations: z.array(z.object({
    fichier: z.string(), nom: z.string(), avant: z.string().optional(), apres: z.string().optional(),
    page: z.number().int().positive().optional(), positionConnue: z.boolean().optional(),
  })).default([]),
});

export type Bloc = z.infer<typeof BlocSchema>;
export type Fiche = z.infer<typeof FicheSchema>;

/**
 * Remplace les numéros d'images donnés par l'IA par les fichiers rangés,
 * et retire les images qui n'existent pas. `jointes` = les images envoyées à
 * l'IA, dans l'ordre (n°1 = la première).
 */
export function placerImages(fiche: Fiche, jointes: string[], illustrations: Fiche["illustrations"]): Fiche {
  const autorisees = new Set([...jointes, ...illustrations.map(i => i.fichier)]);
  const dejaPlacees = new Set<string>();
  const sections = fiche.sections
    .map((s) => ({
      ...s,
      blocs: s.blocs.flatMap((b): Bloc[] => {
        if (b.type !== "image") return [b];
        const fichier = b.image !== undefined ? jointes[b.image - 1] : b.fichier && autorisees.has(b.fichier) ? b.fichier : undefined;
        if (!fichier || dejaPlacees.has(fichier)) return [];
        dejaPlacees.add(fichier);
        return [{ type: "image", fichier, legende: b.legende }];
      }),
    }))
    .filter((s) => s.blocs.length > 0);
  return repartirIllustrations({ ...fiche, sections, illustrations });
}

const MOTS_COURANTS = new Set("les des une dans pour avec sont est sur par aux pas plus qui que cette ces ses son leur leurs comme entre mais elle elles il ils nous vous ce cet dont aussi du de la le un et en ou au se sa ne a d l".split(" "));
function normaliser(texte: string) { return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function mots(texte: string) { return new Set(normaliser(texte).split(" ").filter(m => m.length > 2 && !MOTS_COURANTS.has(m))); }
function texteBloc(b: Bloc): string {
  if (b.type === "image") return "";
  if (b.type === "liste") return b.elements.join(" ");
  if (b.type === "definition") return `${b.terme} ${b.texte}`;
  if (b.type === "date") return `${b.date} ${b.texte}`;
  return b.texte;
}

/** Secours pour les anciennes fiches : associe les repères source au texte réellement présent. */
export function repartirIllustrations(fiche: Fiche): Fiche {
  const restantes = illustrationsNonPlacees(fiche);
  if (!restantes.length) return fiche;
  const candidats = fiche.sections.flatMap((s, section) => s.blocs.flatMap((b, bloc) => {
    const texte = texteBloc(b);
    return texte ? [{ section, bloc, texte, titre: s.titre, mots: mots(texte) }] : [];
  }));
  const frequences = new Map<string, number>();
  candidats.forEach(c => c.mots.forEach(m => frequences.set(m, (frequences.get(m) ?? 0) + 1)));
  const ajouts = new Map<string, { avant: Bloc[]; apres: Bloc[] }>();
  for (const image of restantes) {
    let meilleur: { section: number; bloc: number; avant: boolean; score: number } | undefined;
    for (const [ancre, avant] of [[image.avant, false], [image.apres, true]] as const) {
      if (!ancre) continue;
      const termes = mots(ancre);
      for (const c of candidats) {
        const communs = [...termes].filter(m => c.mots.has(m));
        if (communs.length < 2) continue;
        const poids = (m: string) => 1 + Math.log(1 + candidats.length / (frequences.get(m) ?? 1));
        const commun = communs.reduce((n, m) => n + poids(m), 0);
        const total = [...termes].reduce((n, m) => n + poids(m), 0);
        const score = commun / Math.sqrt(total * [...c.mots].reduce((n, m) => n + poids(m), 0));
        if (score >= 0.28 && (!meilleur || score > meilleur.score)) meilleur = { section: c.section, bloc: c.bloc, avant, score };
      }
    }
    // Sans correspondance fiable, ne pas inventer une position dans une autre notion.
    if (!meilleur) continue;
    const cle = `${meilleur.section}:${meilleur.bloc}`;
    const ajout = ajouts.get(cle) ?? { avant: [], apres: [] };
    ajout[meilleur.avant ? "avant" : "apres"].push({ type: "image", fichier: image.fichier, legende: image.nom });
    ajouts.set(cle, ajout);
  }
  return { ...fiche, sections: fiche.sections.map((s, si) => ({ ...s, blocs: s.blocs.flatMap((b, bi) => {
    const ajout = ajouts.get(`${si}:${bi}`);
    return ajout ? [...ajout.avant, b, ...ajout.apres] : [b];
  }) })) };
}

/** Les illustrations que l'IA n'a placées nulle part (montrées à la fin de la fiche). */
export function illustrationsNonPlacees(fiche: Fiche): Fiche["illustrations"] {
  const placees = new Set(fiche.sections.flatMap((s) => s.blocs.flatMap((b) => (b.type === "image" && b.fichier ? [b.fichier] : []))));
  return (fiche.illustrations ?? []).filter((i) => !placees.has(i.fichier));
}

/** Fiche factice pour le mode démo (IA_DEMO=1) : découpe le texte en paragraphes. */
export function ficheDemo(texte: string): Fiche {
  const paragraphes = texte
    .split(/\n\s*\n|(?<=\.)\s+(?=[A-ZÀ-Ý])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 12);
  const [premier, ...reste] = paragraphes.length > 0 ? paragraphes : ["Cours vide."];
  return {
    titre: premier.slice(0, 80),
    matiere: "",
    resume: "Fiche de démonstration : sans clé d'IA, le cours est seulement découpé en morceaux.",
    sections: [
      {
        titre: "L'essentiel",
        blocs: [
          { type: "important", texte: premier },
          ...(reste.length > 0 ? [{ type: "liste" as const, elements: reste }] : []),
        ],
      },
    ],
    mots_cles: [],
    illustrations: [],
  };
}
