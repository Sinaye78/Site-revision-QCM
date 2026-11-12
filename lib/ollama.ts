import { availableParallelism } from "node:os";
import { noterUsageIA } from "./usage-ia";
import type { ExecutionIA } from "./taches-types";

/** Les morceaux couvrent tout le texte, sans perte aux frontières. */
export function decouperCours(texte: string, maximum = 16): string[] {
  const taille = Math.max(1800, Math.ceil(texte.length / maximum));
  const morceaux: string[] = []; let debut = 0;
  while (debut < texte.length) {
    let fin = Math.min(texte.length, debut + taille);
    if (fin < texte.length) {
      const coupure = texte.lastIndexOf("\n", fin);
      const espace = texte.lastIndexOf(" ", fin);
      if (coupure > debut + taille * 0.5) fin = coupure + 1;
      else if (espace > debut + taille * 0.5) fin = espace + 1;
    }
    morceaux.push(texte.slice(debut, fin)); debut = fin;
  }
  return morceaux.length ? morceaux : [""];
}

type Message = { role: string; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };
export type ReglagesOllama = { format?: Record<string, unknown>; contexte?: number; maximumTokens?: number; temperature?: number; graine?: number; reflexion?: boolean };
let occupe = false;
const attente: (() => void)[] = [];
async function reserver(execution: ExecutionIA): Promise<() => void> {
  execution.signal?.throwIfAborted();
  if (occupe) {
    execution.suivi?.({ fournisseur: "Ollama", phase: "attente_locale" });
    await new Promise<void>((resolve, reject) => {
      const commencer = () => { execution.signal?.removeEventListener("abort", annuler); resolve(); };
      const annuler = () => { const i = attente.indexOf(commencer); if (i >= 0) attente.splice(i, 1); reject(execution.signal?.reason ?? new Error("Traitement interrompu.")); };
      attente.push(commencer);
      execution.signal?.addEventListener("abort", annuler, { once: true });
    });
  } else occupe = true;
  return () => { const suivant = attente.shift(); if (suivant) suivant(); else occupe = false; };
}
export async function repondreOllama(url: string, modele: string, messages: Message[], execution: ExecutionIA = {}, reglages: ReglagesOllama = {}): Promise<string> {
  const liberer = await reserver(execution);
  const configured = Number(process.env.OLLAMA_DELAI_MS || 900000);
  const delai = Math.min(3600000, Math.max(1000, Number.isFinite(configured) ? configured : 900000));
  const signal = execution.signal ? AbortSignal.any([execution.signal, AbortSignal.timeout(delai)]) : AbortSignal.timeout(delai);
  let statut: number | null = null; let reussite = false;
  let usage: { prompt_eval_count?: number; eval_count?: number } = {};
  try {
    execution.suivi?.({ fournisseur: "Ollama", phase: "lecture" });
    const natifs = messages.map(m => typeof m.content === "string" ? m : {
      role: m.role, content: m.content.flatMap(p => p.type === "text" ? [p.text] : []).join("\n"),
      images: m.content.flatMap(p => p.type === "image_url" ? [p.image_url.url.split(",").at(-1)!] : []),
    });
    const r = await fetch(`${url.replace(/\/+$/, "")}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ model: modele, messages: natifs, stream: true, format: reglages.format ?? "json", keep_alive: "5m", ...(reglages.reflexion === undefined ? {} : { think: reglages.reflexion }),
        options: { num_ctx: reglages.contexte ?? 16384, num_predict: reglages.maximumTokens ?? 10000, num_thread: Math.max(1, availableParallelism() - 1), temperature: reglages.temperature ?? 0.2, ...(reglages.graine === undefined ? {} : { seed: reglages.graine }) } }),
    });
    statut = r.status;
    if (!r.ok || !r.body) throw new Error(`Ollama indisponible (${r.status}).`);
    const reader = r.body.getReader(); const decoder = new TextDecoder();
    let pending = "", texte = "", fin = false, tronque = false;
    const ligne = (l: string) => {
      if (!l.trim()) return;
      const event = JSON.parse(l) as { error?: string; message?: { content?: string }; done?: boolean; done_reason?: string } & typeof usage;
      if (event.error) throw new Error("Ollama n’a pas pu traiter cette demande.");
      texte += event.message?.content ?? "";
      if (texte.length > 500000) throw new Error("La réponse locale est trop longue.");
      if (event.message?.content) execution.suivi?.({ fournisseur: "Ollama", phase: "generation", caracteres: texte.length });
      if (event.done) { usage = event; fin = true; tronque = event.done_reason === "length"; }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let index: number;
        while ((index = pending.indexOf("\n")) >= 0) { ligne(pending.slice(0, index)); pending = pending.slice(index + 1); }
      }
      pending += decoder.decode(); if (pending.trim()) ligne(pending);
    } finally { await reader.cancel().catch(() => {}); }
    if (!fin || tronque || !texte.trim()) throw new Error("Ollama a interrompu sa réponse avant la fin.");
    reussite = true; return texte;
  } finally {
    liberer();
    noterUsageIA({ fournisseur: "ollama", modele, statut, reussite, tokensEntree: usage.prompt_eval_count,
      tokensSortie: usage.eval_count, tokensTotal: usage.prompt_eval_count !== undefined && usage.eval_count !== undefined ? usage.prompt_eval_count + usage.eval_count : undefined });
  }
}
