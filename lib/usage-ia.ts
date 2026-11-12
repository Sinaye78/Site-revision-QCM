import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

type Mesure = {
  fournisseur: string; modele: string; statut: number | null; reussite: boolean;
  tokensEntree?: number; tokensSortie?: number; tokensTotal?: number; neurones?: number;
};
const globalUsage = globalThis as unknown as { __usageIA?: DatabaseSync };
function base() {
  if (globalUsage.__usageIA) return globalUsage.__usageIA;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "usage-ia.db"));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS appels (
      id INTEGER PRIMARY KEY, date INTEGER NOT NULL, fournisseur TEXT NOT NULL,
      modele TEXT NOT NULL, statut INTEGER, reussite INTEGER NOT NULL,
      entree INTEGER, sortie INTEGER, total INTEGER, neurones REAL
    );
    CREATE INDEX IF NOT EXISTS appels_date ON appels(date);`);
  globalUsage.__usageIA = db;
  return db;
}
function nombre(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
/** Aucun cours, aucune cle et aucune donnee personnelle n'est enregistre. */
export function noterUsageIA(m: Mesure) {
  try {
    base().prepare(`INSERT INTO appels(date,fournisseur,modele,statut,reussite,entree,sortie,total,neurones)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(Date.now(), m.fournisseur, m.modele, m.statut, Number(m.reussite),
      nombre(m.tokensEntree), nombre(m.tokensSortie), nombre(m.tokensTotal), nombre(m.neurones));
  } catch (e) { console.error("[usage-ia] Impossible d'enregistrer la consommation", e); }
}
export type BilanIA = {
  fournisseur: string; appels: number; reussites: number; erreurs: number; limites: number;
  entree: number | null; sortie: number | null; total: number | null; neurones: number | null;
};
export function lireUsageIA() {
  const maintenant = new Date();
  const jour = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  const mois = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1);
  const bilan = (depuis: number) => base().prepare(`SELECT fournisseur, COUNT(*) appels,
    SUM(reussite) reussites, SUM(1-reussite) erreurs, SUM(CASE WHEN statut=429 THEN 1 ELSE 0 END) limites,
    SUM(entree) entree, SUM(sortie) sortie, SUM(total) total, SUM(neurones) neurones
    FROM appels WHERE date>=? GROUP BY fournisseur`).all(depuis) as BilanIA[];
  const debut = base().prepare("SELECT MIN(date) debut FROM appels").get() as { debut: number | null };
  return { jour: bilan(jour), mois: bilan(mois), debut: debut.debut };
}
