import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import type { AvancementIA, TachePublique, TypeTache } from "./taches-types";

type Ligne = {
  id: string; utilisateur_id: string; cours_id: string; type: TypeTache; parametres: string;
  statut: TachePublique["statut"]; avancement: string | null; resultat_id: string | null; erreur: string | null;
  cree_le: number; modifie_le: number; jeton: string | null; bail: number | null; essais: number;
  quota_cle: string | null; quota_jour: string | null; rembourse: number; titre?: string;
};
let initialisee: ReturnType<typeof db> | undefined;
function base() {
  const b = db();
  if (initialisee === b) return b;
  b.exec(`CREATE TABLE IF NOT EXISTS taches (
    id TEXT PRIMARY KEY, utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    cours_id TEXT NOT NULL REFERENCES cours(id) ON DELETE CASCADE, type TEXT NOT NULL, parametres TEXT NOT NULL,
    statut TEXT NOT NULL, avancement TEXT, resultat_id TEXT, erreur TEXT,
    cree_le INTEGER NOT NULL, modifie_le INTEGER NOT NULL, jeton TEXT, bail INTEGER, essais INTEGER NOT NULL DEFAULT 0,
    quota_cle TEXT, quota_jour TEXT, rembourse INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS tache_active_parametres ON taches(cours_id,type,parametres) WHERE statut IN ('en_attente','en_cours');
  DROP INDEX IF EXISTS tache_active_cours;
  CREATE INDEX IF NOT EXISTS taches_utilisateur ON taches(utilisateur_id,cree_le);
  CREATE TABLE IF NOT EXISTS quotas_invites (cle TEXT NOT NULL, jour TEXT NOT NULL, nombre INTEGER NOT NULL, PRIMARY KEY(cle,jour));
  CREATE TABLE IF NOT EXISTS taches_parties (tache_id TEXT NOT NULL REFERENCES taches(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL, empreinte TEXT NOT NULL, resultat TEXT NOT NULL, PRIMARY KEY(tache_id,numero));`);
  initialisee = b; return b;
}
function transaction<T>(action: () => T): T {
  const b = base(); b.exec("BEGIN IMMEDIATE");
  try { const r = action(); b.exec("COMMIT"); return r; } catch (e) { b.exec("ROLLBACK"); throw e; }
}
function publique(l: Ligne): TachePublique {
  const mode = (JSON.parse(l.parametres) as { mode?: unknown }).mode;
  return { id: l.id, coursId: l.cours_id, titre: l.titre || "Mon cours", type: l.type, mode: mode === "local" || mode === "rapide" ? mode : null, statut: l.statut,
    avancement: l.avancement ? JSON.parse(l.avancement) : null, resultatId: l.resultat_id, erreur: l.erreur,
    creeLe: l.cree_le, modifieLe: l.modifie_le };
}
export class QuotaTaches extends Error {}
export function enqueuerTache(u: string, cours: string, type: TypeTache, parametres: object, invite: boolean, ip: string): TachePublique {
  return transaction(() => {
    const b = base();
    if (!b.prepare("SELECT id FROM cours WHERE id=? AND utilisateur_id=?").get(cours, u)) throw new Error("Cours introuvable.");
    const active = b.prepare("SELECT t.*,c.titre FROM taches t JOIN cours c ON c.id=t.cours_id WHERE t.utilisateur_id=? AND t.cours_id=? AND t.type=? AND t.parametres=? AND t.statut IN ('en_attente','en_cours')").get(u, cours, type, JSON.stringify(parametres)) as Ligne | undefined;
    if (active) return publique(active);
    const sansQuota = (parametres as { mode?: unknown }).mode === "local";
    const cle = invite && !sansQuota ? createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${ip}`).digest("hex") : null;
    const jour = cle ? new Date().toISOString().slice(0, 10) : null;
    if (cle && jour) {
      const q = b.prepare("SELECT nombre FROM quotas_invites WHERE cle=? AND jour=?").get(cle, jour) as { nombre: number } | undefined;
      const limite = Number(process.env.INVITE_QCM_PAR_JOUR || 10);
      if ((q?.nombre ?? 0) >= limite) throw new QuotaTaches("Tu as atteint la limite du jour sans compte. Connecte-toi avec Discord ou Google pour continuer.");
      b.prepare("INSERT INTO quotas_invites VALUES(?,?,1) ON CONFLICT(cle,jour) DO UPDATE SET nombre=nombre+1").run(cle, jour);
    }
    const id = randomUUID(); const maintenant = Date.now();
    b.prepare("INSERT INTO taches(id,utilisateur_id,cours_id,type,parametres,statut,cree_le,modifie_le,quota_cle,quota_jour) VALUES(?,?,?,?,?,'en_attente',?,?,?,?)")
      .run(id, u, cours, type, JSON.stringify(parametres), maintenant, maintenant, cle, jour);
    const ancienne = b.prepare("SELECT id FROM taches WHERE utilisateur_id=? AND cours_id=? AND type=? AND parametres=? AND statut='erreur' ORDER BY cree_le DESC LIMIT 1")
      .get(u, cours, type, JSON.stringify(parametres)) as { id: string } | undefined;
    if (ancienne) b.prepare("INSERT INTO taches_parties SELECT ?,numero,empreinte,resultat FROM taches_parties WHERE tache_id=?").run(id, ancienne.id);
    return lireTache(u, id)!;
  });
}
export function lireTache(u: string, id: string): TachePublique | null {
  const l = base().prepare("SELECT t.*,c.titre FROM taches t JOIN cours c ON c.id=t.cours_id WHERE t.id=? AND t.utilisateur_id=?").get(id, u) as Ligne | undefined;
  return l ? publique(l) : null;
}
export function listerTaches(u: string): TachePublique[] {
  return (base().prepare("SELECT t.*,c.titre FROM taches t JOIN cours c ON c.id=t.cours_id WHERE t.utilisateur_id=? ORDER BY CASE WHEN t.statut IN ('en_attente','en_cours') THEN 0 ELSE 1 END,t.cree_le DESC LIMIT 100").all(u) as Ligne[]).map(publique);
}
export function tacheActive(u: string, cours: string, type: TypeTache): TachePublique | null {
  const l = base().prepare("SELECT t.*,c.titre FROM taches t JOIN cours c ON c.id=t.cours_id WHERE t.utilisateur_id=? AND t.cours_id=? AND t.type=? AND t.statut IN ('en_attente','en_cours')").get(u, cours, type) as Ligne | undefined;
  return l ? publique(l) : null;
}
function rembourser(l: Ligne) {
  if (!l.rembourse && l.quota_cle && l.quota_jour) {
    base().prepare("UPDATE quotas_invites SET nombre=MAX(0,nombre-1) WHERE cle=? AND jour=?").run(l.quota_cle, l.quota_jour);
    base().prepare("UPDATE taches SET rembourse=1 WHERE id=?").run(l.id);
  }
}
export function prendreTache(): Ligne | null {
  return transaction(() => {
    const b = base(); const maintenant = Date.now();
    for (const l of b.prepare("SELECT * FROM taches WHERE statut='en_cours' AND bail<?").all(maintenant) as Ligne[]) {
      if (l.essais >= 3) {
        b.prepare("UPDATE taches SET statut='erreur',erreur=?,modifie_le=?,jeton=NULL,bail=NULL WHERE id=?").run("Le traitement a été interrompu plusieurs fois. Tu peux le relancer.", maintenant, l.id); rembourser(l);
      } else b.prepare("UPDATE taches SET statut='en_attente',jeton=NULL,bail=NULL,avancement=NULL,modifie_le=? WHERE id=?").run(maintenant, l.id);
    }
    const l = b.prepare(`SELECT * FROM taches WHERE statut='en_attente'
      AND (json_extract(parametres,'$.mode') IS NOT 'local' OR NOT EXISTS
        (SELECT 1 FROM taches a WHERE a.statut='en_cours' AND json_extract(a.parametres,'$.mode')='local'))
      ORDER BY CASE WHEN json_extract(parametres,'$.mode')='local' THEN 1 ELSE 0 END,cree_le,id LIMIT 1`).get() as Ligne | undefined;
    if (!l) return null;
    const jeton = randomUUID();
    b.prepare("UPDATE taches SET statut='en_cours',jeton=?,bail=?,essais=essais+1,modifie_le=? WHERE id=?").run(jeton, maintenant + 90000, maintenant, l.id);
    return { ...l, statut: "en_cours", jeton, essais: l.essais + 1 };
  });
}
export function signalerTache(id: string, jeton: string, avancement?: AvancementIA): boolean {
  const maintenant = Date.now();
  return Number(base().prepare("UPDATE taches SET bail=?,modifie_le=?,avancement=COALESCE(?,avancement) WHERE id=? AND jeton=? AND statut='en_cours'")
    .run(maintenant + 90000, maintenant, avancement ? JSON.stringify(avancement) : null, id, jeton).changes) === 1;
}
export function finirTache(id: string, jeton: string, enregistrer: () => string) {
  transaction(() => {
    const b = base();
    if (!b.prepare("SELECT id FROM taches WHERE id=? AND jeton=? AND statut='en_cours'").get(id, jeton)) throw new Error("Traitement repris par un autre service.");
    const resultat = enregistrer();
    b.prepare("UPDATE taches SET statut='termine',resultat_id=?,avancement=?,modifie_le=?,jeton=NULL,bail=NULL WHERE id=?")
      .run(resultat, JSON.stringify({ phase: "enregistrement" }), Date.now(), id);
  });
}
export function echouerTache(id: string, jeton: string, erreur: string) {
  transaction(() => {
    const b = base(); const l = b.prepare("SELECT * FROM taches WHERE id=? AND jeton=? AND statut='en_cours'").get(id, jeton) as Ligne | undefined;
    if (!l) return;
    b.prepare("UPDATE taches SET statut='erreur',erreur=?,modifie_le=?,jeton=NULL,bail=NULL WHERE id=?").run(erreur.slice(0, 600), Date.now(), id); rembourser(l);
  });
}
export function rendreTache(id: string, jeton: string) {
  base().prepare("UPDATE taches SET statut='en_attente',jeton=NULL,bail=NULL,modifie_le=? WHERE id=? AND jeton=? AND statut='en_cours'").run(Date.now(), id, jeton);
}
export function lirePartie(id: string, numero: number, empreinte: string): unknown | null {
  const r = base().prepare("SELECT resultat FROM taches_parties WHERE tache_id=? AND numero=? AND empreinte=?").get(id, numero, empreinte) as { resultat: string } | undefined;
  return r ? JSON.parse(r.resultat) : null;
}
export function garderPartie(id: string, jeton: string, numero: number, empreinte: string, resultat: unknown) {
  transaction(() => {
    if (!base().prepare("SELECT id FROM taches WHERE id=? AND jeton=? AND statut='en_cours'").get(id, jeton)) throw new Error("Traitement interrompu.");
    base().prepare("INSERT INTO taches_parties VALUES(?,?,?,?) ON CONFLICT(tache_id,numero) DO UPDATE SET empreinte=excluded.empreinte,resultat=excluded.resultat")
      .run(id, numero, empreinte, JSON.stringify(resultat));
  });
}
