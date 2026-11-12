import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.local")) {
  console.log(".env.local existe déjà : configuration conservée.");
} else {
  const modele = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const configuration = modele.replace(/^AUTH_SECRET=$/m, `AUTH_SECRET=${randomBytes(32).toString("hex")}`);
  writeFileSync(".env.local", configuration, { flag: "wx", mode: 0o600 });
  console.log(".env.local créé avec un secret unique et le mode démo activé. Lancer : npm run dev");
}
