/** Essai réel explicite : aucun appel aux API externes, aucun changement des cours enregistrés. */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { genererQcmOllama } from "../lib/qcm-ollama";
import type { Question } from "../lib/quiz";

async function main() {
  const fichier = process.argv[2], sortie = process.argv[3];
  if (!fichier || !sortie) throw new Error("Usage : node --import tsx scripts/bench-ollama.ts source.txt resultat.json [nombre] [modele]");
  const texte = readFileSync(fichier, "utf8"), nombre = Number(process.argv[4] || 20), modele = process.argv[5] || "qwen2.5:3b";
  const questions: Question[] = []; const debut = performance.now(); let appels = 0, tokens = 0;
  const cache = new Map<string, unknown>(existsSync(`${sortie}.reprise`) ? JSON.parse(readFileSync(`${sortie}.reprise`, "utf8")) : []);
  const origine = globalThis.fetch;
  const prefixe = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  globalThis.fetch = async (url, init) => {
    if (String(url) !== `${prefixe}/api/chat`) throw new Error("Ce benchmark interdit les API externes.");
    appels++; const r = await origine(url, init);
    // Le clone mesure les tokens sans modifier la réponse utilisée par le code de production.
    const lignes = (await r.clone().text()).trim().split("\n");
    let contenu = "";
    for (const ligne of lignes) { try { const j = JSON.parse(ligne); contenu += j.message?.content ?? ""; if (j.done) tokens += j.eval_count ?? 0; } catch { /* L'erreur sera traitée par le client natif. */ } }
    appendFileSync(`${sortie}.reponses`, JSON.stringify({ appel: appels, contenu }) + "\n", { mode: 0o600 });
    return r;
  };
  const bilan = () => ({ modele, caracteres: texte.length, demande: nombre, valides: questions.length, appels, tokens, secondes: Math.round((performance.now() - debut) / 100) / 10 });
  mkdirSync(path.dirname(sortie), { recursive: true });
  const sauver = (autres: object) => writeFileSync(sortie, JSON.stringify({ ...bilan(), ...autres }, null, 2), { mode: 0o600 });
  try {
    const quiz = await genererQcmOllama(prefixe, modele, { texte, nombre, difficulte: "difficile", titre: "Essai local", reprise: {
      lire: (i, hash) => cache.get(`${i}:${hash}`) ?? null,
      ecrire: (i, hash, q) => { cache.set(`${i}:${hash}`, q); questions[i] = q as Question; writeFileSync(`${sortie}.reprise`, JSON.stringify([...cache]), { mode: 0o600 }); sauver({ statut: "en_cours" }); },
    } });
    sauver({ statut: "termine", quiz }); console.log(JSON.stringify({ ...bilan(), statut: "termine" }));
  } catch (e) {
    sauver({ statut: "erreur", erreur: e instanceof Error ? e.message : String(e), questions });
    console.error(JSON.stringify({ ...bilan(), statut: "erreur", erreur: e instanceof Error ? e.message : String(e) })); process.exitCode = 1;
  } finally { globalThis.fetch = origine; }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
