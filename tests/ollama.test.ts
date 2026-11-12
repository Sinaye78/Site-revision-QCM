import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decouperCours, repondreOllama } from "../lib/ollama";
import { genererFiche, genererQuiz, iaLitLesImages } from "../lib/ia";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-ollama-"));
function flux(content: string, done = true) {
  const events = [{ message: { content: content.slice(0, 15) }, done: false }, { message: { content: content.slice(15) }, done: false }, ...(done ? [{ message: { content: "" }, done: true, prompt_eval_count: 20, eval_count: 30 }] : [])];
  const bytes = new TextEncoder().encode(events.map(e => JSON.stringify(e)).join("\n") + "\n");
  return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 13) c.enqueue(bytes.slice(i, i + 13)); c.close(); } }), { status: 200 });
}
test("le découpage couvre tout le texte, sans inventer un avancement temporel", () => {
  const texte = ("Un paragraphe avec des accents : éruption et préhistoire.\n\n").repeat(110);
  const parties = decouperCours(texte); assert.ok(parties.length > 1); assert.equal(parties.join(""), texte);
});
test("le mode sans quota ne contacte aucune API, même si Ollama échoue", async () => {
  const noms = ["IA_ORDRE", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN", "OLLAMA_URL", "OLLAMA_MODEL", "IA_DEMO"];
  const precedents = Object.fromEntries(noms.map(k => [k, process.env[k]])); const ancien = globalThis.fetch;
  Object.assign(process.env, { IA_ORDRE: "cloudflare,ollama", CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_AI_TOKEN: "test", OLLAMA_URL: "http://local", OLLAMA_MODEL: "test", IA_DEMO: "0" });
  const appels: string[] = []; let echec = false;
  try {
    globalThis.fetch = async url => {
      appels.push(String(url));
      assert.equal(String(url), "http://local/api/chat");
      if (echec) return new Response("Indisponible", { status: 503 });
      return flux(JSON.stringify({ titre: "Cours", matiere: "Histoire", resume: "", sections: [{ titre: "Préhistoire", blocs: [{ type: "paragraphe", texte: "Les humains fabriquent des outils." }] }], mots_cles: [] }));
    };
    assert.equal(iaLitLesImages("local"), false);
    assert.equal((await genererFiche({ texte: "Les humains fabriquent des outils.", images: [], mode: "local" })).fournisseur, "Ollama");
    echec = true;
    await assert.rejects(genererFiche({ texte: "Les humains fabriquent des outils.", images: [], mode: "local" }));
    await assert.rejects(genererQuiz({ texte: "Les humains fabriquent des outils.", images: [], nombre: 5, difficulte: "facile", mode: "local" }));
    assert.ok(appels.length >= 3); assert.ok(appels.every(url => url === "http://local/api/chat"));
  } finally { globalThis.fetch = ancien; for (const [k, v] of Object.entries(precedents)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
test("les générations locales sont sérialisées et une attente peut être annulée sans bloquer les suivantes", async () => {
  const ancien = globalThis.fetch; let terminer!: (r: Response) => void; let appels = 0;
  try {
    globalThis.fetch = async () => { appels++; return appels === 1 ? new Promise<Response>(r => { terminer = r; }) : flux("{}"); };
    const premiere = repondreOllama("http://local", "test", []);
    await new Promise(r => setImmediate(r));
    const controle = new AbortController(); const etapes: string[] = [];
    const annulee = repondreOllama("http://local", "test", [], { signal: controle.signal, suivi: a => etapes.push(a.phase) });
    const suivante = repondreOllama("http://local", "test", []);
    assert.equal(appels, 1); assert.ok(etapes.includes("attente_locale"));
    const rejet = assert.rejects(annulee); controle.abort(); await rejet;
    terminer(flux("{}")); await Promise.all([premiere, suivante]); assert.equal(appels, 2);
  } finally { globalThis.fetch = ancien; }
});
test("le flux Ollama est décodé même aux frontières UTF-8 ; une réponse coupée est refusée", async () => {
  const ancien = globalThis.fetch; const etapes: string[] = [];
  try {
    globalThis.fetch = async (_url, init) => { assert.equal(JSON.parse(String(init?.body)).format, "json"); return flux('{"texte":"La Préhistoire"}'); };
    assert.equal(await repondreOllama("http://local", "test", [], { suivi: a => etapes.push(a.phase) }), '{"texte":"La Préhistoire"}');
    assert.ok(etapes.includes("lecture")); assert.ok(etapes.includes("generation"));
    globalThis.fetch = async () => flux("incomplet", false);
    await assert.rejects(repondreOllama("http://local", "test", []), /interrompu/);
  } finally { globalThis.fetch = ancien; }
});
test("un quota externe atteint déclenche Ollama, avec pourcentage fondé sur les parties terminées et reprise", async () => {
  const noms = ["IA_ORDRE", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN", "OLLAMA_URL", "OLLAMA_MODEL", "IA_DEMO"];
  const precedents = Object.fromEntries(noms.map(k => [k, process.env[k]])); const ancien = globalThis.fetch;
  Object.assign(process.env, { IA_ORDRE: "cloudflare,ollama", CLOUDFLARE_ACCOUNT_ID: "test", CLOUDFLARE_AI_TOKEN: "test", OLLAMA_URL: "http://local", OLLAMA_MODEL: "test", IA_DEMO: "0" });
  const cache = new Map<string, unknown>(); let appelsLocaux = 0; const avancees: number[] = [];
  try {
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("api.cloudflare.com")) return new Response("Quota atteint", { status: 429 });
      appelsLocaux++;
      const body = JSON.parse(String(init?.body)); assert.ok(String(url).endsWith("/api/chat"));
      const source = body.messages[1].content.split("\n").slice(1).join("\n");
      return flux(JSON.stringify({ titre: "Préhistoire", matiere: "Histoire", resume: "", sections: [{ titre: "Le cours", blocs: [{ type: "paragraphe", texte: source }] }], mots_cles: [] }));
    };
    const texte = ("Les premiers hommes fabriquent des outils et apprennent à maîtriser le feu.\n\n").repeat(65);
    const execution = { reprise: { lire: (i: number, hash: string) => cache.get(i + hash) ?? null, ecrire: (i: number, hash: string, r: unknown) => { cache.set(i + hash, r); } }, suivi: (a: { partiesFaites?: number }) => { if (a.partiesFaites !== undefined) avancees.push(a.partiesFaites); } };
    const resultat = await genererFiche({ texte, images: [], mode: "rapide", ...execution });
    assert.equal(resultat.fournisseur, "Ollama"); assert.equal(appelsLocaux, decouperCours(texte).length);
    assert.equal(avancees.at(-1), decouperCours(texte).length);
    const avant = appelsLocaux; await genererFiche({ texte, images: [], ...execution }); assert.equal(appelsLocaux, avant);
    const contenu = resultat.fiche.sections.flatMap(s => s.blocs.flatMap(b => "texte" in b ? [b.texte] : [])).join("");
    assert.equal(contenu.replace(/\s/g, ""), texte.replace(/\s/g, ""));
  } finally { globalThis.fetch = ancien; for (const [k, v] of Object.entries(precedents)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
