import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Controle, Correction, Reponse } from "./controle";

/**
 * Contrôles (les sujets) et copies (une par passage de l'élève). Une copie
 * passe de « en_correction » à « corrigee » quand l'IA a noté les réponses
 * rédigées ; les questions fermées sont notées tout de suite.
 */
let prete: ReturnType<typeof db> | undefined;
function base() {
  const b = db();
  if (prete === b) return b;
  b.exec(`
    CREATE TABLE IF NOT EXISTS controles (
      id TEXT PRIMARY KEY,
      utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      cours_id TEXT REFERENCES cours(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      matiere TEXT NOT NULL DEFAULT '',
      difficulte TEXT NOT NULL,
      duree_min INTEGER NOT NULL DEFAULT 0,
      donnees TEXT NOT NULL,
      fournisseur TEXT NOT NULL DEFAULT '',
      cree_le INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_controles_utilisateur ON controles(utilisateur_id, cree_le);
    CREATE TABLE IF NOT EXISTS copies (
      id TEXT PRIMARY KEY,
      controle_id TEXT NOT NULL REFERENCES controles(id) ON DELETE CASCADE,
      reponses TEXT NOT NULL,
      correction TEXT NOT NULL,
      statut TEXT NOT NULL,
      note REAL,
      duree_s INTEGER,
      rendu_le INTEGER NOT NULL,
      corrige_le INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_copies_controle ON copies(controle_id, rendu_le);
  `);
  prete = b;
  return b;
}

export type ControleEnregistre = {
  id: string;
  coursId: string | null;
  coursTitre: string | null;
  difficulte: string;
  dureeMin: number;
  creeLe: number;
  controle: Controle;
};

export function creerControle(u: string, controle: Controle, infos: { coursId: string | null; difficulte: string; dureeMin: number; fournisseur: string }): string {
  const id = randomUUID().slice(0, 8);
  base()
    .prepare("INSERT INTO controles (id, utilisateur_id, cours_id, titre, matiere, difficulte, duree_min, donnees, fournisseur, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, u, infos.coursId, controle.titre, controle.matiere, infos.difficulte, infos.dureeMin, JSON.stringify(controle), infos.fournisseur, Date.now());
  return id;
}

export function lireControle(u: string, id: string): ControleEnregistre | null {
  const l = base()
    .prepare(
      `SELECT k.id, k.cours_id, c.titre AS cours_titre, k.titre, k.difficulte, k.duree_min, k.donnees, k.cree_le
         FROM controles k LEFT JOIN cours c ON c.id = k.cours_id WHERE k.id = ? AND k.utilisateur_id = ?`
    )
    .get(id, u) as { id: string; cours_id: string | null; cours_titre: string | null; titre: string; difficulte: string; duree_min: number; donnees: string; cree_le: number } | undefined;
  if (!l) return null;
  const controle = JSON.parse(l.donnees) as Controle;
  return { id: l.id, coursId: l.cours_id, coursTitre: l.cours_titre, difficulte: l.difficulte, dureeMin: Number(l.duree_min), creeLe: l.cree_le, controle: { ...controle, titre: l.titre } };
}

export type LigneControle = {
  id: string;
  titre: string;
  matiere: string;
  difficulte: string;
  dureeMin: number;
  coursId: string | null;
  coursTitre: string | null;
  nbQuestions: number;
  creeLe: number;
  nbCopies: number;
  meilleure: number | null;
  enCorrection: number;
};

export function listerControles(u: string, coursId?: string): LigneControle[] {
  const lignes = base()
    .prepare(
      `SELECT k.id, k.titre, k.matiere, k.difficulte, k.duree_min, k.cours_id, c.titre AS cours_titre, k.donnees, k.cree_le,
              COUNT(p.id) AS nb, MAX(p.note) AS meilleure, SUM(CASE WHEN p.statut = 'en_correction' THEN 1 ELSE 0 END) AS attente
         FROM controles k LEFT JOIN cours c ON c.id = k.cours_id LEFT JOIN copies p ON p.controle_id = k.id
        WHERE k.utilisateur_id = ? ${coursId ? "AND k.cours_id = ?" : ""}
        GROUP BY k.id ORDER BY k.cree_le DESC`
    )
    .all(u, ...(coursId ? [coursId] : [])) as {
    id: string; titre: string; matiere: string; difficulte: string; duree_min: number; cours_id: string | null; cours_titre: string | null;
    donnees: string; cree_le: number; nb: number; meilleure: number | null; attente: number | null;
  }[];
  return lignes.map((l) => ({
    id: l.id, titre: l.titre, matiere: l.matiere, difficulte: l.difficulte, dureeMin: Number(l.duree_min), coursId: l.cours_id, coursTitre: l.cours_titre,
    nbQuestions: (JSON.parse(l.donnees) as Controle).questions.length, creeLe: l.cree_le, nbCopies: Number(l.nb), meilleure: l.meilleure, enCorrection: Number(l.attente ?? 0),
  }));
}

export function renommerControle(u: string, id: string, titre: string): boolean {
  return Number(base().prepare("UPDATE controles SET titre = ? WHERE id = ? AND utilisateur_id = ?").run(titre, id, u).changes) === 1;
}

export function supprimerControle(u: string, id: string): boolean {
  return Number(base().prepare("DELETE FROM controles WHERE id = ? AND utilisateur_id = ?").run(id, u).changes) === 1;
}

/* ---------------- Copies ---------------- */

export type StatutCopie = "en_correction" | "corrigee";
export type Copie = {
  id: string;
  controleId: string;
  reponses: Reponse[];
  correction: Correction;
  statut: StatutCopie;
  note: number | null;
  dureeS: number | null;
  renduLe: number;
  corrigeLe: number | null;
};

type LigneCopie = { id: string; controle_id: string; reponses: string; correction: string; statut: StatutCopie; note: number | null; duree_s: number | null; rendu_le: number; corrige_le: number | null };
const versCopie = (l: LigneCopie): Copie => ({
  id: l.id, controleId: l.controle_id, reponses: JSON.parse(l.reponses), correction: JSON.parse(l.correction), statut: l.statut,
  note: l.note, dureeS: l.duree_s, renduLe: l.rendu_le, corrigeLe: l.corrige_le,
});

export function creerCopie(controleId: string, reponses: Reponse[], correction: Correction, statut: StatutCopie, note: number | null, dureeS: number | null): string {
  const id = randomUUID().slice(0, 8);
  const maintenant = Date.now();
  base()
    .prepare("INSERT INTO copies (id, controle_id, reponses, correction, statut, note, duree_s, rendu_le, corrige_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, controleId, JSON.stringify(reponses), JSON.stringify(correction), statut, note, dureeS, maintenant, statut === "corrigee" ? maintenant : null);
  return id;
}

/** La copie et son contrôle, seulement pour leur propriétaire. */
export function lireCopie(u: string, id: string): { copie: Copie; controle: ControleEnregistre } | null {
  const l = base()
    .prepare("SELECT p.* FROM copies p JOIN controles k ON k.id = p.controle_id WHERE p.id = ? AND k.utilisateur_id = ?")
    .get(id, u) as LigneCopie | undefined;
  if (!l) return null;
  const controle = lireControle(u, l.controle_id);
  return controle ? { copie: versCopie(l), controle } : null;
}

export function listerCopies(u: string, controleId: string): Copie[] {
  return (
    base()
      .prepare("SELECT p.* FROM copies p JOIN controles k ON k.id = p.controle_id WHERE p.controle_id = ? AND k.utilisateur_id = ? ORDER BY p.rendu_le DESC")
      .all(controleId, u) as LigneCopie[]
  ).map(versCopie);
}

export function enregistrerCorrection(copieId: string, correction: Correction, note: number) {
  base().prepare("UPDATE copies SET correction = ?, note = ?, statut = 'corrigee', corrige_le = ? WHERE id = ?").run(JSON.stringify(correction), note, Date.now(), copieId);
}

/** Lecture sans contrôle de propriétaire : réservée au service qui corrige (il a l'identifiant de la tâche). */
export function lireCopiePourCorrection(copieId: string): { copie: Copie; controle: Controle; utilisateurId: string; coursTexte: string } | null {
  const l = base()
    .prepare("SELECT p.*, k.donnees, k.titre AS k_titre, k.utilisateur_id, COALESCE(c.texte, '') AS cours_texte FROM copies p JOIN controles k ON k.id = p.controle_id LEFT JOIN cours c ON c.id = k.cours_id WHERE p.id = ?")
    .get(copieId) as (LigneCopie & { donnees: string; k_titre: string; utilisateur_id: string; cours_texte: string }) | undefined;
  if (!l) return null;
  return { copie: versCopie(l), controle: { ...(JSON.parse(l.donnees) as Controle), titre: l.k_titre }, utilisateurId: l.utilisateur_id, coursTexte: l.cours_texte };
}

/** Moyenne des copies corrigées (sur 20), pour l'accueil. */
export function bilanControles(u: string): { nb: number; moyenne: number | null } {
  const l = base()
    .prepare("SELECT COUNT(*) AS nb, AVG(p.note) AS moyenne FROM copies p JOIN controles k ON k.id = p.controle_id WHERE k.utilisateur_id = ? AND p.statut = 'corrigee'")
    .get(u) as { nb: number; moyenne: number | null };
  return { nb: Number(l.nb), moyenne: l.moyenne };
}

/** Le dernier traitement de correction d'une copie (pour savoir s'il a échoué). */
export function correctionDeLaCopie(u: string, copieId: string): { id: string; statut: string; erreur: string | null } | null {
  const b = base();
  if (!b.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='taches'").get()) return null;
  const l = b
    .prepare("SELECT id, statut, erreur FROM taches WHERE utilisateur_id = ? AND type = 'correction' AND json_extract(parametres, '$.copie') = ? ORDER BY cree_le DESC LIMIT 1")
    .get(u, copieId) as { id: string; statut: string; erreur: string | null } | undefined;
  return l ?? null;
}
