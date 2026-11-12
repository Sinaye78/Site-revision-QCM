import { QuizSchema, type Difficulte, type Quiz } from "./quiz";
import { consigneSysteme, consigneSystemeFiche, consigneUtilisateur, consigneUtilisateurFiche } from "./consignes-ia";
import { FicheSchema, ficheDemo, type Fiche } from "./fiche";
import { quizDemo } from "./demo";
import { CODES_IA, estCodeIA, type CodeIA } from "./codes-ia";
import { noterUsageIA } from "./usage-ia";
import { createHash } from "node:crypto";
import { decouperCours, repondreOllama } from "./ollama";
import type { ExecutionIA, ModeIA } from "./taches-types";
import type { ZodType } from "zod";
import { ErreurQcmLocal, genererQcmOllama } from "./qcm-ollama";

/**
 * Fournisseurs d'IA, tous appelés au format « chat completions » compatible
 * OpenAI. On essaie dans l'ordre de IA_ORDRE ; si l'un
 * échoue, on passe au suivant. Changer d'IA = changer le .env.
 */
type Fournisseur = {
  id: string;
  nom: string;
  url: string;
  cle: string;
  modele: string;
  vision: boolean;
  formatJson: "json_object" | "aucun";
};

function fournisseursConfigures(env = process.env): Fournisseur[] {
  const ancienneLocale = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):11434(?:\/|$)/.test(env.IA_COMPAT_URL || "");
  const adresseLocale = env.OLLAMA_URL || (ancienneLocale ? new URL(env.IA_COMPAT_URL!).origin : "");
  const ollama: Fournisseur | null = adresseLocale ? { id: "ollama", nom: "Ollama", url: adresseLocale,
    cle: "", modele: env.OLLAMA_MODEL || (ancienneLocale ? env.IA_COMPAT_MODEL : "") || "qwen2.5:3b",
    vision: env.OLLAMA_VISION === "1", formatJson: "json_object" } : null;
  const tous: Record<string, Fournisseur | null> = {
    ollama,
    gemini: env.GEMINI_API_KEY
      ? {
          id: "gemini",
          nom: "Gemini",
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          cle: env.GEMINI_API_KEY,
          modele: env.GEMINI_MODEL || "gemini-2.5-flash",
          vision: true,
          formatJson: "json_object",
        }
      : null,
    grok: env.GROK_API_KEY
      ? {
          id: "grok",
          nom: "Grok",
          url: "https://api.x.ai/v1/chat/completions",
          cle: env.GROK_API_KEY,
          modele: env.GROK_MODEL || "grok-4-fast-non-reasoning",
          vision: true,
          formatJson: "json_object",
        }
      : null,
    mistral: env.MISTRAL_API_KEY
      ? {
          id: "mistral",
          nom: "Mistral",
          url: "https://api.mistral.ai/v1/chat/completions",
          cle: env.MISTRAL_API_KEY,
          modele: env.MISTRAL_MODEL || "mistral-small-latest",
          vision: true,
          formatJson: "json_object",
        }
      : null,
    groq: env.GROQ_API_KEY
      ? {
          id: "groq",
          nom: "Groq",
          url: "https://api.groq.com/openai/v1/chat/completions",
          cle: env.GROQ_API_KEY,
          modele: env.GROQ_MODEL || "llama-3.3-70b-versatile",
          vision: false,
          formatJson: "json_object",
        }
      : null,
    cloudflare:
      env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN
        ? {
            id: "cloudflare",
            nom: "Cloudflare Workers AI",
            url: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
            cle: env.CLOUDFLARE_AI_TOKEN,
            modele: env.CLOUDFLARE_AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct",
            vision: false,
            formatJson: "json_object",
          }
        : null,
    // N'importe quel serveur compatible OpenAI (Ollama, LM Studio, OpenRouter…).
    compat: ancienneLocale ? ollama :
      env.IA_COMPAT_URL && env.IA_COMPAT_MODEL
        ? {
            id: "compat",
            nom: "Serveur compatible OpenAI",
            url: env.IA_COMPAT_URL,
            cle: env.IA_COMPAT_KEY || "aucune",
            modele: env.IA_COMPAT_MODEL,
            vision: env.IA_COMPAT_VISION === "1",
            formatJson: "json_object",
          }
        : null,
  };
  const ordre = (env.IA_ORDRE || "gemini,grok,mistral,groq,cloudflare,ollama,compat").split(",").map((s) => s.trim());
  const configures = ordre.map((id) => tous[id]).filter((f): f is Fournisseur => Boolean(f));
  // Le secours local passe après toutes les IA externes, même si l'ancien ordre le plaçait avant.
  return [...configures.filter(f => f.id !== "ollama"), ...configures.filter(f => f.id === "ollama").slice(0, 1)];
}

/** Etat public des fournisseurs : les cles et les URL privees restent sur le serveur. */
export function etatFournisseursIA() {
  return fournisseursConfigures().map(({ id, nom, modele, vision }) => ({ id, nom, modele, vision }));
}

type Partie = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Message = { role: "system" | "user" | "assistant"; content: string | Partie[] };

/** Erreur à montrer à l'élève. « code » est rempli quand l'IA a renvoyé un code (01, 02…). */
export class ErreurIA extends Error {
  constructor(
    message: string,
    public code?: CodeIA
  ) {
    super(message);
  }
}

async function appeler(f: Fournisseur, messages: Message[], avecFormat: boolean, execution: ExecutionIA = {}): Promise<{ ok: true; texte: string } | { ok: false; statut: number | null; detail: string }> {
  if (f.id === "ollama") {
    try { return { ok: true, texte: await repondreOllama(f.url, f.modele, messages, execution) }; }
    catch (e) { if (execution.signal?.aborted) throw e; return { ok: false, statut: null, detail: e instanceof Error ? e.message : "Ollama indisponible" }; }
  }
  const corps: Record<string, unknown> = { model: f.modele, messages, temperature: 0.4, max_tokens: 10000 };
  if (avecFormat && f.formatJson === "json_object") corps.response_format = { type: "json_object" };
  let statut: number | null = null;
  let reussite = false;
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; neurons?: number } = {};
  try {
    const rep = await fetch(f.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${f.cle}` },
      body: JSON.stringify(corps),
      signal: execution.signal ? AbortSignal.any([execution.signal, AbortSignal.timeout(150_000)]) : AbortSignal.timeout(150_000),
    });
    statut = rep.status;
    if (!rep.ok) return { ok: false, statut: rep.status, detail: (await rep.text().catch(() => "")).slice(0, 400) };
    const json = (await rep.json()) as { choices?: { message?: { content?: unknown } }[]; usage?: typeof usage };
    usage = json.usage || {};
    const contenu = json.choices?.[0]?.message?.content;
    if (typeof contenu !== "string" || !contenu.trim()) return { ok: false, statut: null, detail: "réponse vide" };
    reussite = true;
    return { ok: true, texte: contenu };
  } catch (e) {
    if (execution.signal?.aborted) throw e;
    return { ok: false, statut: null, detail: e instanceof Error ? e.message : String(e) };
  } finally {
    noterUsageIA({ fournisseur: f.id, modele: f.modele, statut, reussite,
      tokensEntree: usage.prompt_tokens, tokensSortie: usage.completion_tokens,
      tokensTotal: usage.total_tokens, neurones: usage.neurons });
  }
}

/** Récupère l'objet JSON même si l'IA l'a entouré de ```json ou de texte. */
export function extraireJson(texte: string): unknown {
  const sansBalises = texte.replace(/```(?:json)?/gi, "").trim();
  const debut = sansBalises.indexOf("{");
  const fin = sansBalises.lastIndexOf("}");
  if (debut < 0 || fin <= debut) throw new Error("aucun objet JSON trouvé");
  return JSON.parse(sansBalises.slice(debut, fin + 1));
}

type Refus = { code: CodeIA; commentaire: string };

/** Message montré à l'élève : le commentaire de l'IA s'il y en a un, sinon le message prévu pour le code. */
function messageRefus(r: Refus): string {
  return r.commentaire || CODES_IA[r.code].message;
}

/** Résultat de la vérification d'une réponse de l'IA. */
type Verif<T> = { ok: T } | Refus | { erreur: string };

/** Lit la réponse de l'IA : soit un refus (code + commentaire), soit l'objet attendu, vérifié par « verifier ». */
function lireReponse<T>(texte: string, verifier: (brut: unknown) => { ok: T } | { erreur: string }): Verif<T> {
  let brut: unknown;
  try {
    brut = extraireJson(texte);
  } catch (e) {
    return { erreur: `JSON illisible (${e instanceof Error ? e.message : "?"})` };
  }
  // L'IA a refusé avec un code prévu dans sa documentation (lib/codes-ia.ts).
  const refus = brut as { erreur?: unknown; commentaire?: unknown } | null;
  if (refus && refus.erreur !== undefined) {
    const commentaire = typeof refus.commentaire === "string" ? refus.commentaire.trim().slice(0, 300) : "";
    // Un code inconnu avec un commentaire compte comme « autre raison ».
    if (estCodeIA(refus.erreur)) return { code: refus.erreur, commentaire };
    if (commentaire) return { code: "00", commentaire };
  }
  return verifier(brut);
}

/**
 * Envoie une demande à l'IA et attend un objet JSON. Essaie chaque fournisseur
 * configuré ; si la réponse est mal formée, montre l'erreur à l'IA pour une
 * seconde chance. Un refus (code) arrête tout : il concerne le document.
 */
export async function demanderJson<T>(opts: {
  systeme: string;
  consigne: string;
  images: string[];
  verifier: (brut: unknown) => { ok: T } | { erreur: string };
  echec: string;
  execution?: ExecutionIA;
  local?: (f: Fournisseur) => Promise<T>;
}): Promise<{ resultat: T; fournisseur: string }> {
  let candidats = fournisseursConfigures();
  if (opts.execution?.mode === "local") {
    candidats = candidats.filter(f => f.id === "ollama");
    if (!candidats.length) throw new ErreurIA("Le mode sans quota n’est pas disponible pour le moment. Choisis le mode rapide ou réessaie plus tard.");
  }
  if (candidats.length === 0) throw new ErreurIA("Aucune clé d'IA n'est configurée sur le serveur (fichier .env).");
  if (opts.images.length > 0) {
    candidats = candidats.filter((f) => f.vision);
    if (candidats.length === 0) throw new ErreurIA(opts.execution?.mode === "local" ? "Le mode sans quota ne peut pas lire ces photos. Utilise un document contenant du texte ou essaie le mode rapide." : "La lecture des photos n’est pas disponible avec les IA actuellement configurées.");
  }

  const contenuUtilisateur: string | Partie[] =
    opts.images.length > 0
      ? [{ type: "text", text: opts.consigne }, ...opts.images.map((url) => ({ type: "image_url" as const, image_url: { url } }))]
      : opts.consigne;
  const messages: Message[] = [
    { role: "system", content: opts.systeme },
    { role: "user", content: contenuUtilisateur },
  ];

  const erreurs: string[] = [];
  for (const f of candidats) {
    if (opts.execution?.signal?.aborted) throw new Error("Traitement interrompu.");
    opts.execution?.suivi?.({ fournisseur: f.nom, phase: "generation" });
    if (f.id === "ollama" && opts.local && !opts.images.length) {
      try { return { resultat: await opts.local(f), fournisseur: f.nom }; }
      catch (e) {
        if (opts.execution?.signal?.aborted || (e instanceof ErreurIA && e.code)) throw e;
        if (e instanceof ErreurQcmLocal) throw new ErreurIA(e.message);
        erreurs.push(`${f.nom} : ${e instanceof Error ? e.message : "échec"}`); continue;
      }
    }
    let rep = await appeler(f, messages, true, opts.execution);
    // Certains modèles refusent l'option « JSON forcé » : on réessaie sans.
    if (!rep.ok && rep.statut === 400) rep = await appeler(f, messages, false, opts.execution);
    if (!rep.ok) {
      erreurs.push(`${f.nom} : ${rep.statut ?? "réseau"} ${rep.detail}`);
      continue;
    }

    let resultat = lireReponse(rep.texte, opts.verifier);
    if ("code" in resultat) throw new ErreurIA(messageRefus(resultat), resultat.code);
    if ("erreur" in resultat) {
      opts.execution?.suivi?.({ fournisseur: f.nom, phase: "correction" });
      const correction = await appeler(
        f,
        [
          ...messages,
          { role: "assistant", content: rep.texte },
          { role: "user", content: `Ta réponse n'est pas valide (${resultat.erreur}). Renvoie uniquement le JSON corrigé, au format demandé.` },
        ],
        true, opts.execution
      );
      if (correction.ok) resultat = lireReponse(correction.texte, opts.verifier);
      if ("code" in resultat) throw new ErreurIA(messageRefus(resultat), resultat.code);
    }
    if ("ok" in resultat) return { resultat: resultat.ok, fournisseur: f.nom };
    erreurs.push(`${f.nom} : ${resultat.erreur}`);
  }

  console.error("[ia] tous les fournisseurs ont échoué :", erreurs);
  throw new ErreurIA(opts.echec);
}

export function premiersProblemes(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".")} : ${i.message}`)
    .join(" ; ");
}

async function jsonLocal<T>(f: Fournisseur, systeme: string, consigne: string, schema: ZodType<T>, numero: number, execution: ExecutionIA): Promise<T> {
  const empreinte = createHash("sha256").update(`${f.modele}:v1:${systeme}:${consigne}`).digest("hex");
  const precedent = schema.safeParse(execution.reprise?.lire(numero, empreinte));
  if (precedent.success) return precedent.data;
  const messages: Message[] = [{ role: "system", content: systeme }, { role: "user", content: consigne }];
  for (let essai = 0; essai < 2; essai++) {
    const texte = await repondreOllama(f.url, f.modele, messages, execution);
    const lu = lireReponse<T>(texte, brut => {
      const r = schema.safeParse(brut);
      return r.success ? { ok: r.data } : { erreur: premiersProblemes(r.error.issues) };
    });
    if ("code" in lu) throw new ErreurIA(messageRefus(lu), lu.code);
    if ("ok" in lu) { execution.reprise?.ecrire(numero, empreinte, lu.ok); return lu.ok; }
    execution.suivi?.({ fournisseur: "Ollama", phase: "correction" });
    messages.push({ role: "assistant", content: texte }, { role: "user", content: `Corrige uniquement le format JSON : ${lu.erreur}. Conserve le contenu du cours.` });
  }
  throw new ErreurIA("L’IA locale n’a pas réussi à préparer cette partie du cours. Tu peux relancer le traitement.");
}

async function ficheLocale(f: Fournisseur, opts: { texte: string } & ExecutionIA): Promise<Fiche> {
  const morceaux = decouperCours(opts.texte);
  const fiches: Fiche[] = [];
  const systeme = `Tu mets en page un cours en français. Le texte a déjà été extrait du document. Conserve chaque information, date, définition et exemple. Corrige les coquilles et sépare les paragraphes, sans inventer ni résumer. Le site assemble les parties et replace les images ; ne produis pas de bloc image. Réponds avec un objet JSON contenant titre, matiere, resume (vide), sections et mots_cles. Chaque section contient titre et blocs. Chaque bloc contient type="paragraphe" et texte. Structure attendue : {"titre":"Sujet réel du cours","matiere":"Matière","resume":"","sections":[{"titre":"Titre lié au contenu","blocs":[{"type":"paragraphe","texte":"Texte du cours remis au propre"}]}],"mots_cles":[]}. Remplis cette structure avec le contenu reçu.`;
  for (let i = 0; i < morceaux.length; i++) {
    opts.suivi?.({ fournisseur: "Ollama", phase: "lecture", partiesFaites: i, partiesTotal: morceaux.length });
    const execution: ExecutionIA = { ...opts, suivi: a => opts.suivi?.({ ...a, partiesFaites: i, partiesTotal: morceaux.length }) };
    fiches.push(await jsonLocal(f, systeme, `Partie ${i + 1}/${morceaux.length}. Remets au propre tout ce texte :\n${morceaux[i]}`, FicheSchema, i, execution));
    opts.suivi?.({ fournisseur: "Ollama", phase: "generation", partiesFaites: i + 1, partiesTotal: morceaux.length });
  }
  let sections = fiches.flatMap(p => p.sections);
  if (sections.length > 40) {
    const blocs = sections.flatMap(s => [{ type: "important" as const, texte: s.titre }, ...s.blocs]);
    sections = [];
    for (let i = 0; i < blocs.length; i += 80) sections.push({ titre: `Le cours — partie ${sections.length + 1}`, blocs: blocs.slice(i, i + 80) });
  }
  return FicheSchema.parse({ ...fiches[0], sections, illustrations: [], mots_cles: [...new Set(fiches.flatMap(p => p.mots_cles))].slice(0, 30) });
}

/* ---------------- QCM ---------------- */

export async function genererQuiz(opts: {
  texte: string;
  titre?: string;
  matiere?: string;
  images: string[];
  nombre: number;
  difficulte: Difficulte;
  /** Énoncés déjà posés sur ce cours, à ne pas répéter. */
  eviter?: string[];
} & ExecutionIA): Promise<{ quiz: Quiz; fournisseur: string }> {
  if (process.env.IA_DEMO === "1") {
    await new Promise((r) => setTimeout(r, 2500));
    return { quiz: quizDemo(opts.nombre), fournisseur: "démo" };
  }
  const { resultat, fournisseur } = await demanderJson<Quiz>({
    systeme: consigneSysteme(),
    consigne: consigneUtilisateur({ ...opts, aDesImages: opts.images.length > 0 }),
    images: opts.images,
    echec: "L'IA n'a pas réussi à préparer le QCM. Réessaie dans une minute.",
    execution: opts,
    local: f => genererQcmOllama(f.url, process.env.OLLAMA_QCM_MODEL || f.modele, opts),
    verifier: (brut) => {
      const res = QuizSchema.safeParse(brut);
      if (!res.success) return { erreur: `format incorrect : ${premiersProblemes(res.error.issues)}` };
      const quiz = { ...res.data, questions: res.data.questions.slice(0, opts.nombre) };
      if (quiz.questions.length < Math.min(3, opts.nombre)) return { erreur: "pas assez de questions" };
      return { ok: quiz };
    },
  });
  return { quiz: resultat, fournisseur };
}

/* ---------------- Fiche (cours mis au propre) ---------------- */

/** Vrai si au moins une des IA configurées sait regarder des images. */
export function iaLitLesImages(mode?: ModeIA): boolean {
  return fournisseursConfigures().some(f => f.vision && (mode !== "local" || f.id === "ollama"));
}

/** `images` : les images jointes dans l'ordre, avec ce qu'elles sont (photo du cours ou illustration). */
export async function genererFiche(opts: {
  texte: string;
  images: { url?: string; photo: boolean; nom: string; avant?: string; apres?: string }[];
} & ExecutionIA): Promise<{ fiche: Fiche; fournisseur: string }> {
  if (process.env.IA_DEMO === "1") {
    await new Promise((r) => setTimeout(r, 2500));
    return { fiche: ficheDemo(opts.texte), fournisseur: "démo" };
  }
  const { resultat, fournisseur } = await demanderJson<Fiche>({
    systeme: consigneSystemeFiche(),
    consigne: consigneUtilisateurFiche({ texte: opts.texte, images: opts.images.map(i => ({ ...i, visible: Boolean(i.url) })) }),
    images: opts.images.flatMap((i) => i.url ? [i.url] : []),
    echec: "L'IA n'a pas réussi à mettre ton cours au propre. Réessaie dans une minute.",
    execution: opts,
    local: f => ficheLocale(f, opts),
    verifier: (brut) => {
      const res = FicheSchema.safeParse(brut);
      if (!res.success) return { erreur: `format incorrect : ${premiersProblemes(res.error.issues)}` };
      // Le texte valide ne doit pas être jeté pour une image oubliée ou un numéro
      // incorrect : placerImages filtre les références, déduplique et utilise les
      // repères source pour replacer les illustrations manquantes.
      return { ok: res.data };
    },
  });
  return { fiche: resultat, fournisseur };
}
