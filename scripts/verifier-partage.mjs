import { readdirSync, readFileSync, lstatSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const racineProjet = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dossiersPublics = new Set(["app", "components", "lib", "public", "scripts", "tests", "docs"]);
const fichiersRacine = new Set([
  "README.md", "PROMPTS_ILLUSTRATIONS.md", "package.json", "package-lock.json",
  "tsconfig.json", "next.config.ts", ".gitignore", ".gitattributes", ".env.example",
  "LICENSE", "LICENSE.md", "CONTRIBUTING.md", "SECURITY.md",
]);
const repertoirePrive = /^(?:node_modules|data|\.next[^/]*|\.git|\.claude|\.codex|\.idea|\.vscode|private|backups|coverage|deploiement)$/i;
const fichierPrive = /(?:^\.env(?!\.example$)|\.(?:db(?:-.*)?|sqlite3?|pem|key|p12|pfx|log|tgz|zip|reponses|reprise|tsbuildinfo)$|^next-env\.d\.ts$|^AGENTS\.md$|^\.DS_Store$|^Thumbs\.db$)/i;
const formatsSecrets = [
  /\bAIza[\w-]{30,}\b/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{25,}\b/,
  /\bgithub_pat_[a-zA-Z0-9_]{30,}\b/,
  /\bsk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{30,}\b/,
  new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"].join("")),
];
const sensible = /(?:SECRET|TOKEN|API_KEY|CLIENT_ID|ACCOUNT_ID|COMPAT_KEY)$/;

export function valeursEnv(contenu) {
  return contenu.split(/\r?\n/).filter(l => l.trim() && !l.trimStart().startsWith("#")).map(l => {
    const m = l.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m) throw new Error("Ligne de configuration non reconnue.");
    return [m[1], m[2].trim().replace(/^(["'])(.*)\1$/, "$2")];
  });
}

export function verifierPartage(racine = racineProjet) {
  const fichiers = [], problemes = [];
  function visiter(rel) {
    const absolu = path.join(racine, rel), etat = lstatSync(absolu);
    if (etat.isSymbolicLink()) { problemes.push(`${rel} : lien symbolique non partageable automatiquement`); return; }
    const nom = path.basename(rel);
    if (etat.isDirectory()) {
      if (repertoirePrive.test(nom)) return;
      for (const entree of readdirSync(absolu)) visiter(path.join(rel, entree));
      return;
    }
    if (fichierPrive.test(nom)) return;
    fichiers.push(rel.replaceAll(path.sep, "/"));
    if (/\.(?:webp|png|jpe?g|gif|ico|woff2?|ttf|otf)$/i.test(nom)) return;
    const contenu = readFileSync(absolu, "utf8");
    if (formatsSecrets.some(p => p.test(contenu))) problemes.push(`${rel} : format de secret potentiel`);
    if (/[A-Z]:[\\/]+Users[\\/]+[^\s"']+/i.test(contenu)) problemes.push(`${rel} : chemin utilisateur personnel`);
    if (nom === ".env.example") {
      for (const [cle, valeur] of valeursEnv(contenu)) {
        if (sensible.test(cle) && valeur) problemes.push(`${rel} : ${cle} doit rester vide`);
      }
    }
  }
  for (const nom of readdirSync(racine)) {
    if (fichiersRacine.has(nom) || dossiersPublics.has(nom)) visiter(nom);
    else if (!repertoirePrive.test(nom) && !fichierPrive.test(nom)) problemes.push(`${nom} : fichier non prévu dans la distribution, à vérifier`);
  }
  const git = spawnSync("git", ["-C", racine, "ls-files", "-z"], { encoding: "utf8", windowsHide: true });
  if (git.status === 0) {
    for (const nom of git.stdout.split("\0").filter(Boolean)) {
      const parties = nom.split("/");
      if (parties.slice(0, -1).some(p => repertoirePrive.test(p)) || fichierPrive.test(parties.at(-1))) {
        problemes.push(`${nom} : fichier privé déjà suivi par Git`);
      }
    }
  }
  // Le .env local n’est jamais versionné ; l’archive accepte seulement un modèle entièrement vide.
  if (existsSync(path.join(racine, ".env"))) {
    const vide = valeursEnv(readFileSync(path.join(racine, ".env"), "utf8")).every(([, valeur]) => valeur === "");
    if (vide) fichiers.push(".env");
  }
  if (problemes.length) throw new Error(problemes.join("\n"));
  return fichiers.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const fichiers = verifierPartage();
    console.log(`Partage vérifié : ${fichiers.length} fichiers de distribution ; aucune alerte détectée. Configurations privées et données exclues.`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
