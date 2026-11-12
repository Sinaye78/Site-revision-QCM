import { setTimeout as attendre } from "node:timers/promises";

async function main() {
if (process.env.NODE_ENV !== "production") {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
}
const { traiterUneTache } = await import("../lib/traiter-taches");
const arret = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => arret.abort());
console.log("[traitements] Service démarré.");
async function boucle() {
while (!arret.signal.aborted) {
  try {
    if (!await traiterUneTache(arret.signal)) await attendre(1500, undefined, { signal: arret.signal });
  } catch (e) {
    if (arret.signal.aborted) break;
    console.error("[traitements]", e instanceof Error ? e.message : "échec temporaire");
    await attendre(5000, undefined, { signal: arret.signal }).catch(() => {});
  }
}
}
// Les appels API restent disponibles pendant une génération locale plus longue.
await Promise.all([boucle(), boucle()]);
console.log("[traitements] Service arrêté ; travaux conservés.");

}
main().catch(e => { console.error("[traitements]", e instanceof Error ? e.message : "erreur"); process.exitCode = 1; });
