import { z } from "zod";

/**
 * Le « contrôle » : un sujet comme en classe, avec plusieurs types de
 * questions et un barème. Les questions fermées (QCM, vrai/faux, texte à
 * trous) sont corrigées par le site ; les réponses rédigées par l'IA, en
 * comparant la copie aux éléments attendus prévus dès la création du sujet.
 */
const Enonce = z.string().trim().min(3).max(1500);
const Points = z.coerce.number().min(0.5).max(10).transform((p) => Math.round(p * 2) / 2);
const Explication = z.string().trim().max(1000).default("");

export const QuestionControleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("qcm"), enonce: Enonce, choix: z.array(z.string().trim().min(1).max(300)).length(4), bonne_reponse: z.coerce.number().int().min(0).max(3), points: Points, explication: Explication }),
  z.object({
    type: z.literal("vrai_faux"),
    enonce: Enonce,
    // Certaines IA écrivent « vrai » ou "true" au lieu de true.
    reponse: z.preprocess((v) => (typeof v === "string" ? (/^(vrai|true|oui)$/i.test(v.trim()) ? true : /^(faux|false|non)$/i.test(v.trim()) ? false : v) : v), z.boolean()),
    points: Points,
    explication: Explication,
  }),
  z.object({
    type: z.literal("trous"),
    // Le texte avec un « ___ » par trou ; `reponses[i]` = les réponses acceptées pour le trou i.
    enonce: Enonce.refine((t) => /_{3,}/.test(t), "le texte doit contenir au moins un trou ___"),
    reponses: z.array(z.array(z.string().trim().min(1).max(80)).min(1).max(5)).min(1).max(4),
    points: Points,
    explication: Explication,
  }),
  z.object({ type: z.literal("courte"), enonce: Enonce, reponse_modele: z.string().trim().min(1).max(1500), elements_attendus: z.array(z.string().trim().min(2).max(300)).min(1).max(4), points: Points }),
  z.object({ type: z.literal("redigee"), enonce: Enonce, reponse_modele: z.string().trim().min(1).max(3000), elements_attendus: z.array(z.string().trim().min(2).max(300)).min(2).max(6), points: Points }),
]);

export const ControleSchema = z.object({
  titre: z.string().trim().min(1).max(120),
  matiere: z.string().trim().max(40).default(""),
  questions: z
    .array(QuestionControleSchema)
    .min(3)
    .max(15)
    .refine((qs) => qs.every((q) => q.type !== "trous" || q.reponses.length === nombreDeTrous(q.enonce)), "chaque trou ___ doit avoir ses réponses acceptées"),
});

export type QuestionControle = z.infer<typeof QuestionControleSchema>;
export type Controle = z.infer<typeof ControleSchema>;
export type TypeQuestion = QuestionControle["type"];

export const TYPES_QUESTIONS: { id: TypeQuestion; libelle: string; detail: string }[] = [
  { id: "qcm", libelle: "QCM", detail: "4 propositions" },
  { id: "vrai_faux", libelle: "Vrai ou faux", detail: "une affirmation" },
  { id: "trous", libelle: "Texte à trous", detail: "compléter des mots" },
  { id: "courte", libelle: "Réponse courte", detail: "une phrase" },
  { id: "redigee", libelle: "Question rédigée", detail: "quelques phrases, corrigée par l'IA" },
];
export const DUREES = [0, 10, 20, 30, 45, 60] as const;
export const NOMBRES_CONTROLE = [5, 8, 12] as const;

export function nombreDeTrous(texte: string): number {
  return (texte.match(/_{3,}/g) ?? []).length;
}

export function aCorrigerParIA(q: QuestionControle): boolean {
  return q.type === "courte" || q.type === "redigee";
}

export function totalPoints(c: Controle): number {
  return c.questions.reduce((n, q) => n + q.points, 0);
}

/* ---------------- Réponses de l'élève ---------------- */

/** Ce que l'élève a répondu : un numéro (QCM), oui/non, des mots (trous) ou un texte. null = pas répondu. */
export type Reponse = number | boolean | string[] | string | null;

/** Garde uniquement des réponses du bon type pour chaque question (le navigateur n'est pas fiable). */
export function nettoyerReponses(c: Controle, brutes: unknown): Reponse[] {
  const liste = Array.isArray(brutes) ? brutes : [];
  return c.questions.map((q, i) => {
    const r = liste[i];
    switch (q.type) {
      case "qcm":
        return Number.isInteger(r) && (r as number) >= 0 && (r as number) <= 3 ? (r as number) : null;
      case "vrai_faux":
        return typeof r === "boolean" ? r : null;
      case "trous":
        return Array.isArray(r) ? q.reponses.map((_, k) => String(r[k] ?? "").slice(0, 120)) : null;
      default:
        return typeof r === "string" && r.trim() ? r.slice(0, q.type === "courte" ? 1500 : 6000) : null;
    }
  });
}

/* ---------------- Correction ---------------- */

export type CorrectionQuestion = {
  points: number;
  max: number;
  /** Indices des éléments attendus présents dans la réponse (questions rédigées). */
  elements_trouves?: number[];
  /** Pour un texte à trous : chaque trou juste ou non. */
  trous_justes?: boolean[];
  commentaire: string;
  /** « site » = corrigée automatiquement ; « ia » = par l'IA ; « attente » = pas encore corrigée. */
  par: "site" | "ia" | "attente";
};
export type Correction = { questions: CorrectionQuestion[]; appreciation: string };

export function simplifierMot(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Un mot de texte à trous est juste s'il correspond à une réponse acceptée (accents, majuscules et une petite faute tolérés). */
export function trouJuste(donnee: string, acceptees: string[]): boolean {
  const r = simplifierMot(donnee);
  if (!r) return false;
  return acceptees.some((a) => {
    const s = simplifierMot(a);
    return s === r || (s.length >= 5 && distance(s, r) <= 1);
  });
}

const arrondi = (n: number) => Math.round(n * 2) / 2;

/** Corrige ce que le site sait corriger seul ; les réponses rédigées restent « en attente » de l'IA. */
export function corrigerAutomatiquement(c: Controle, reponses: Reponse[]): CorrectionQuestion[] {
  return c.questions.map((q, i) => {
    const r = reponses[i];
    const max = q.points;
    if (r === null || r === undefined || (Array.isArray(r) && r.every((x) => !String(x).trim()))) {
      return { points: 0, max, commentaire: "Pas de réponse.", par: "site", ...(q.type === "trous" ? { trous_justes: q.reponses.map(() => false) } : {}) };
    }
    switch (q.type) {
      case "qcm": {
        const juste = r === q.bonne_reponse;
        return { points: juste ? max : 0, max, commentaire: juste ? "Juste." : `La bonne réponse était : ${q.choix[q.bonne_reponse]}.`, par: "site" };
      }
      case "vrai_faux": {
        const juste = r === q.reponse;
        return { points: juste ? max : 0, max, commentaire: juste ? "Juste." : `C'était ${q.reponse ? "vrai" : "faux"}.`, par: "site" };
      }
      case "trous": {
        const mots = r as string[];
        const justes = q.reponses.map((acceptees, k) => trouJuste(mots[k] ?? "", acceptees));
        const n = justes.filter(Boolean).length;
        return {
          points: arrondi((max * n) / q.reponses.length),
          max,
          trous_justes: justes,
          commentaire: n === justes.length ? "Tout est juste." : `${n} trou${n > 1 ? "s" : ""} juste${n > 1 ? "s" : ""} sur ${justes.length}.`,
          par: "site",
        };
      }
      default:
        return { points: 0, max, commentaire: "", par: "attente" };
    }
  });
}

/** Les points donnés par l'IA restent dans le barème, par demi-points. */
export function bornerPoints(points: unknown, max: number): number {
  const p = Number(points);
  return Number.isFinite(p) ? Math.min(max, Math.max(0, arrondi(p))) : 0;
}

/**
 * Correction de secours sans IA (mode démo, ou IA indisponible) : un élément
 * attendu compte comme trouvé si la plupart de ses mots importants sont dans la réponse.
 */
export function corrigerParMotsCles(q: Extract<QuestionControle, { type: "courte" | "redigee" }>, reponse: string): CorrectionQuestion {
  const texte = ` ${simplifierMot(reponse)} `;
  const trouves: number[] = [];
  q.elements_attendus.forEach((el, i) => {
    const mots = simplifierMot(el).split(" ").filter((m) => m.length > 3);
    if (!mots.length) return;
    const presents = mots.filter((m) => texte.includes(` ${m}`)).length;
    if (presents / mots.length >= 0.5) trouves.push(i);
  });
  const points = arrondi((q.points * trouves.length) / q.elements_attendus.length);
  const manquants = q.elements_attendus.filter((_, i) => !trouves.includes(i));
  return {
    points,
    max: q.points,
    elements_trouves: trouves,
    commentaire: manquants.length ? `Il manque : ${manquants.join(" ; ")}.` : "Tous les éléments attendus y sont.",
    par: "ia",
  };
}

export function noteSur20Controle(corrections: CorrectionQuestion[]): number {
  const max = corrections.reduce((n, q) => n + q.max, 0);
  const obtenus = corrections.reduce((n, q) => n + q.points, 0);
  return max > 0 ? arrondi((obtenus / max) * 20) : 0;
}

/* ---------------- Démo ---------------- */

export function controleDemo(): Controle {
  return {
    titre: "La Révolution française (démo)",
    matiere: "Histoire",
    questions: [
      { type: "qcm", enonce: "En quelle année a lieu la prise de la Bastille ?", choix: ["1789", "1792", "1799", "1804"], bonne_reponse: 0, points: 2, explication: "Le 14 juillet 1789." },
      { type: "vrai_faux", enonce: "Les privilèges sont abolis dans la nuit du 4 août 1789.", reponse: true, points: 2, explication: "C'est bien la nuit du 4 août 1789." },
      { type: "trous", enonce: "En juin 1791, la famille royale est arrêtée à ___. La République est proclamée en ___ 1792.", reponses: [["Varennes"], ["septembre"]], points: 4, explication: "Arrestation à Varennes, République proclamée le 21 septembre 1792." },
      { type: "courte", enonce: "Quel texte l'Assemblée adopte-t-elle le 26 août 1789 ?", reponse_modele: "La Déclaration des droits de l'homme et du citoyen.", elements_attendus: ["Déclaration des droits de l'homme et du citoyen"], points: 4 },
      {
        type: "redigee",
        enonce: "Explique en quelques phrases pourquoi l'année 1789 marque la fin de l'Ancien Régime.",
        reponse_modele: "En 1789, la prise de la Bastille montre la révolte du peuple, l'abolition des privilèges met fin à la société d'ordres et la Déclaration des droits affirme l'égalité des citoyens.",
        elements_attendus: ["prise de la Bastille", "abolition des privilèges", "Déclaration des droits de l'homme", "égalité des citoyens"],
        points: 8,
      },
    ],
  };
}

/* ---------------- Ce que voit l'élève pendant le contrôle ---------------- */

/** Le sujet sans les réponses : c'est tout ce qui est envoyé au navigateur avant que la copie soit rendue. */
export type QuestionSujet = { type: TypeQuestion; enonce: string; points: number; choix?: string[] };

export function sujetPourEleve(c: Controle): QuestionSujet[] {
  return c.questions.map((q) => ({ type: q.type, enonce: q.enonce, points: q.points, ...(q.type === "qcm" ? { choix: q.choix } : {}) }));
}

/** Découpe un texte à trous en morceaux de texte, autour de chaque « ___ ». */
export function morceauxTrous(enonce: string): string[] {
  return enonce.split(/_{3,}/);
}
