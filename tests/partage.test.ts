import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
// @ts-expect-error Utilitaire JavaScript également exécuté directement par Node.
import { verifierPartage } from "../scripts/verifier-partage.mjs";

function dossier() {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), "revision-partage-"));
  fs.writeFileSync(path.join(racine, "README.md"), "Projet de test.");
  fs.writeFileSync(path.join(racine, ".env.example"), "AUTH_SECRET=\nGEMINI_API_KEY=\nSITE_URL=http://localhost:3000\n");
  return racine;
}

test("le partage exclut données et configuration remplie, mais accepte le .env entièrement vide", () => {
  const racine = dossier();
  try {
    fs.mkdirSync(path.join(racine, "data"));
    fs.writeFileSync(path.join(racine, "data", "cours.db"), "données privées");
    fs.writeFileSync(path.join(racine, ".env.local"), "AUTH_SECRET=valeur-locale-privee\n");
    fs.writeFileSync(path.join(racine, "AGENTS.md"), "Métadonnées générées localement au démarrage.");
    fs.writeFileSync(path.join(racine, ".env"), "AUTH_SECRET=\nSITE_URL=\n");
    assert.deepEqual(verifierPartage(racine), [".env", ".env.example", "README.md"]);
    fs.writeFileSync(path.join(racine, ".env"), "AUTH_SECRET=valeur-locale-privee\n");
    assert.equal(verifierPartage(racine).includes(".env"), false);
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test("le partage refuse une clé dans l’exemple ou le code sans afficher sa valeur", () => {
  const racine = dossier();
  const cle = ["AIza", "a".repeat(35)].join("");
  try {
    fs.writeFileSync(path.join(racine, ".env.example"), "GEMINI_API_KEY=valeur-interdite\n");
    assert.throws(() => verifierPartage(racine), /GEMINI_API_KEY doit rester vide/);
    fs.writeFileSync(path.join(racine, ".env.example"), "GEMINI_API_KEY=\n");
    fs.mkdirSync(path.join(racine, "lib"));
    fs.writeFileSync(path.join(racine, "lib", "exemple.ts"), `const cle = '${cle}';`);
    assert.throws(() => verifierPartage(racine), (e: Error) => e.message.includes("secret potentiel") && !e.message.includes(cle));
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test("setup génère un secret unique, active la démo et préserve la configuration existante", () => {
  const a = dossier(), b = dossier();
  const script = path.resolve("scripts/configurer-local.mjs");
  try {
    for (const racine of [a, b]) {
      fs.writeFileSync(path.join(racine, ".env"), "AUTH_SECRET=\n");
      const r = spawnSync(process.execPath, [script], { cwd: racine, encoding: "utf8", windowsHide: true });
      assert.equal(r.status, 0, r.stderr);
    }
    const premier = fs.readFileSync(path.join(a, ".env.local"), "utf8");
    assert.match(premier, /^AUTH_SECRET=[a-f0-9]{64}$/m);
    assert.match(premier, /^IA_DEMO=1$/m);
    assert.notEqual(premier, fs.readFileSync(path.join(b, ".env.local"), "utf8"));
    assert.equal(spawnSync(process.execPath, [script], { cwd: a, windowsHide: true }).status, 0);
    assert.equal(fs.readFileSync(path.join(a, ".env.local"), "utf8"), premier);
    assert.equal(fs.readFileSync(path.join(a, ".env"), "utf8"), "AUTH_SECRET=\n");
  } finally { for (const racine of [a, b]) fs.rmSync(racine, { recursive: true, force: true }); }
});
