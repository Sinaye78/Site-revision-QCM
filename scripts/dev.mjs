import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev"], { stdio: "inherit" });
const worker = spawn(process.execPath, ["--import", "tsx", "scripts/traiter-taches.ts"], { stdio: "inherit" });
let arret = false;
function fermer() { if (arret) return; arret = true; web.kill("SIGTERM"); worker.kill("SIGTERM"); }
process.on("SIGINT", fermer); process.on("SIGTERM", fermer);
web.on("exit", fermer); worker.on("exit", fermer);
