import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Quiz } from "./quiz";
import type { Fiche } from "./fiche";
import { supprimerFichier, type FichierCours } from "./fichiers";

/**
 * Base SQLite intégrée à Node (node:sqlite) : un seul fichier dans DATA_DIR,
 * aucun serveur de base de données à installer. Mise en cache sur globalThis pour survivre aux
 * rechargements à chaud de `next dev`.
 *
 * Organisation :
 *   compte ─┬─ dossiers ── cours ── QCM ── tentatives
 *           └─ cours sans dossier
 * Toutes les fonctions prennent le compte en premier paramètre et ne voient
 * que ses données.
 */
const g = globalThis as unknown as { __qcmDbV5?: DatabaseSync };

function ajouterColonne(base: DatabaseSync, table: string, colonne: string, definition: string) {
  const colonnes = base.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!colonnes.some((c) => c.name === colonne)) base.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`);
}

export function db(): DatabaseSync {
  if (g.__qcmDbV5) return g.__qcmDbV5;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const base = new DatabaseSync(path.join(dir, "qcm.db"));
  base.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id TEXT PRIMARY KEY,
      fournisseur TEXT NOT NULL,
      fournisseur_id TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      nom TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      cree_le INTEGER NOT NULL,
      vu_le INTEGER NOT NULL,
      UNIQUE (fournisseur, fournisseur_id)
    );
    CREATE TABLE IF NOT EXISTS dossiers (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      couleur TEXT NOT NULL DEFAULT 'bleu',
      image TEXT,
      cree_le INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cours (
      id TEXT PRIMARY KEY,
      utilisateur_id TEXT REFERENCES utilisateurs(id) ON DELETE CASCADE,
      dossier_id TEXT REFERENCES dossiers(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      titre_auto INTEGER NOT NULL DEFAULT 1,
      matiere TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      texte TEXT NOT NULL DEFAULT '',
      fichiers TEXT NOT NULL DEFAULT '[]',
      fiche TEXT,
      fiche_le INTEGER,
      cree_le INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      titre TEXT NOT NULL,
      matiere TEXT NOT NULL DEFAULT '',
      difficulte TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      fournisseur TEXT NOT NULL DEFAULT '',
      donnees TEXT NOT NULL,
      cree_le INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tentatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      reponses TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      fait_le INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tentatives_quiz ON tentatives(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_cours_utilisateur ON cours(utilisateur_id);
    -- Répétition espacée : une ligne par question déjà répondue (boîte 1 à 5, jour où la revoir).
    CREATE TABLE IF NOT EXISTS revisions (
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question INTEGER NOT NULL,
      boite INTEGER NOT NULL,
      jour_prochain TEXT NOT NULL,
      vu_le INTEGER NOT NULL,
      erreurs INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (quiz_id, question)
    );
    CREATE INDEX IF NOT EXISTS idx_revisions_jour ON revisions(jour_prochain);
    -- Anciennes versions d'une fiche (pour annuler une modification), 10 au maximum par cours.
    CREATE TABLE IF NOT EXISTS fiches_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cours_id TEXT NOT NULL REFERENCES cours(id) ON DELETE CASCADE,
      fiche TEXT NOT NULL,
      origine TEXT NOT NULL,
      cree_le INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fiches_versions_cours ON fiches_versions(cours_id, id);
    -- Jours où l'élève a révisé (pour la série de jours d'affilée).
    CREATE TABLE IF NOT EXISTS activite (
      utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      jour TEXT NOT NULL,
      PRIMARY KEY (utilisateur_id, jour)
    );
  `);
  // Colonnes ajoutées au fil des versions.
  ajouterColonne(base, "quizzes", "dossier_id", "TEXT REFERENCES dossiers(id) ON DELETE SET NULL");
  ajouterColonne(base, "quizzes", "cours_texte", "TEXT NOT NULL DEFAULT ''");
  ajouterColonne(base, "quizzes", "fichiers", "TEXT NOT NULL DEFAULT '[]'");
  ajouterColonne(base, "quizzes", "utilisateur_id", "TEXT REFERENCES utilisateurs(id) ON DELETE CASCADE");
  ajouterColonne(base, "quizzes", "cours_id", "TEXT REFERENCES cours(id) ON DELETE SET NULL");
  ajouterColonne(base, "dossiers", "utilisateur_id", "TEXT REFERENCES utilisateurs(id) ON DELETE CASCADE");
  ajouterColonne(base, "cours", "fiche_origine", "TEXT NOT NULL DEFAULT 'ia'");
  // Version retouchée par l'IA, en attente : l'élève la garde ou la refuse.
  ajouterColonne(base, "cours", "fiche_proposee", "TEXT");
  ajouterColonne(base, "cours", "proposition_consigne", "TEXT NOT NULL DEFAULT ''");
  base.exec("CREATE INDEX IF NOT EXISTS idx_quizzes_utilisateur ON quizzes(utilisateur_id)");
  base.exec("CREATE INDEX IF NOT EXISTS idx_quizzes_cours ON quizzes(cours_id)");
  base.exec("CREATE INDEX IF NOT EXISTS idx_dossiers_utilisateur ON dossiers(utilisateur_id)");
  migrerCoursDesQcm(base);
  g.__qcmDbV5 = base;
  return base;
}

/**
 * Avant, le cours était rangé dans le QCM. On sort chaque cours dans la table
 * « cours » (avec son dossier) et on relie le QCM à ce cours. Ne fait rien si
 * c'est déjà fait.
 */
function migrerCoursDesQcm(base: DatabaseSync) {
  const anciens = base
    .prepare(
      `SELECT id, titre, matiere, source, cours_texte, fichiers, dossier_id, utilisateur_id, cree_le
         FROM quizzes WHERE cours_id IS NULL AND (cours_texte <> '' OR fichiers <> '[]')`
    )
    .all() as {
    id: string;
    titre: string;
    matiere: string;
    source: string;
    cours_texte: string;
    fichiers: string;
    dossier_id: string | null;
    utilisateur_id: string | null;
    cree_le: number;
  }[];
  if (anciens.length === 0) return;
  base.exec("BEGIN");
  try {
    for (const q of anciens) {
      const coursId = randomUUID().slice(0, 8);
      base
        .prepare(
          `INSERT INTO cours (id, utilisateur_id, dossier_id, titre, titre_auto, matiere, source, texte, fichiers, cree_le)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
        )
        .run(coursId, q.utilisateur_id, q.dossier_id, q.titre, q.matiere, q.source, q.cours_texte, q.fichiers, q.cree_le);
      base.prepare("UPDATE quizzes SET cours_id = ?, cours_texte = '', fichiers = '[]', dossier_id = NULL WHERE id = ?").run(coursId, q.id);
    }
    base.exec("COMMIT");
  } catch (e) {
    base.exec("ROLLBACK");
    throw e;
  }
}

/* ======================= Comptes ======================= */

export type Utilisateur = { id: string; fournisseur: string; email: string; nom: string; avatar: string };

/** Crée le compte à sa première connexion, ou met à jour son nom et son avatar. */
export function enregistrerUtilisateur(infos: { fournisseur: string; fournisseurId: string; email: string; nom: string; avatar: string }): Utilisateur {
  const maintenant = Date.now();
  const existant = db()
    .prepare("SELECT id FROM utilisateurs WHERE fournisseur = ? AND fournisseur_id = ?")
    .get(infos.fournisseur, infos.fournisseurId) as { id: string } | undefined;

  if (existant) {
    db()
      .prepare("UPDATE utilisateurs SET email = ?, nom = ?, avatar = ?, vu_le = ? WHERE id = ?")
      .run(infos.email, infos.nom, infos.avatar, maintenant, existant.id);
    return lireUtilisateur(existant.id)!;
  }

  const id = randomUUID();
  const premier = (db().prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE fournisseur <> 'invite'").get() as { n: number }).n === 0;
  db()
    .prepare("INSERT INTO utilisateurs (id, fournisseur, fournisseur_id, email, nom, avatar, cree_le, vu_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, infos.fournisseur, infos.fournisseurId, infos.email, infos.nom, infos.avatar, maintenant, maintenant);
  // Le tout premier compte récupère ce qui a été créé avant les comptes.
  if (premier) {
    for (const table of ["quizzes", "dossiers", "cours"]) {
      db().prepare(`UPDATE ${table} SET utilisateur_id = ? WHERE utilisateur_id IS NULL`).run(id);
    }
  }
  return lireUtilisateur(id)!;
}

/** Compte « sans compte » : lié à un seul navigateur par son cookie. Nettoie au passage les invités inactifs depuis 90 jours. */
export function creerInvite(): Utilisateur {
  const limite = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const vieux = db().prepare("SELECT id FROM utilisateurs WHERE fournisseur = 'invite' AND vu_le < ?").all(limite) as { id: string }[];
  vieux.forEach((v) => supprimerUtilisateur(v.id));
  const id = randomUUID();
  const maintenant = Date.now();
  db()
    .prepare("INSERT INTO utilisateurs (id, fournisseur, fournisseur_id, email, nom, avatar, cree_le, vu_le) VALUES (?, 'invite', ?, '', 'Sans compte', '', ?, ?)")
    .run(id, id, maintenant, maintenant);
  return lireUtilisateur(id)!;
}

export function noterVisite(id: string) {
  db().prepare("UPDATE utilisateurs SET vu_le = ? WHERE id = ?").run(Date.now(), id);
}

/** Quand un invité se connecte à un compte : ses cours, QCM et dossiers passent sur le compte. */
export function transfererDonnees(deId: string, versId: string) {
  if (deId === versId) return;
  const b = db(); b.exec("BEGIN IMMEDIATE");
  try {
    for (const table of ["quizzes", "dossiers", "cours"]) b.prepare(`UPDATE ${table} SET utilisateur_id = ? WHERE utilisateur_id = ?`).run(versId, deId);
    b.prepare("UPDATE OR IGNORE activite SET utilisateur_id = ? WHERE utilisateur_id = ?").run(versId, deId);
    b.prepare("DELETE FROM activite WHERE utilisateur_id = ?").run(deId);
    if (b.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='controles'").get()) {
      b.prepare("UPDATE controles SET utilisateur_id = ? WHERE utilisateur_id = ?").run(versId, deId);
    }
    if (b.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='taches'").get()) {
      b.prepare("UPDATE taches SET utilisateur_id=?,statut=CASE WHEN statut='en_cours' THEN 'en_attente' ELSE statut END,jeton=NULL,bail=NULL WHERE utilisateur_id=?").run(versId, deId);
    }
    b.prepare("DELETE FROM utilisateurs WHERE id = ? AND fournisseur = 'invite'").run(deId);
    b.exec("COMMIT");
  } catch (e) { b.exec("ROLLBACK"); throw e; }
}

/** Supprime un compte, ses données et ses fichiers. */
function supprimerUtilisateur(id: string) {
  const cours = db().prepare("SELECT id, fichiers FROM cours WHERE utilisateur_id = ?").all(id) as { id: string; fichiers: string }[];
  cours.forEach((c) => {
    (JSON.parse(c.fichiers) as FichierCours[]).forEach((f) => supprimerFichier(f.fichier));
    illustrationsDuCours(c.id).forEach(supprimerFichier);
  });
  const dossiers = db().prepare("SELECT image FROM dossiers WHERE utilisateur_id = ?").all(id) as { image: string | null }[];
  dossiers.forEach((d) => supprimerFichier(d.image));
  for (const table of ["quizzes", "cours", "dossiers", "activite"]) db().prepare(`DELETE FROM ${table} WHERE utilisateur_id = ?`).run(id);
  db().prepare("DELETE FROM utilisateurs WHERE id = ?").run(id);
}

export function lireUtilisateur(id: string): Utilisateur | null {
  const l = db().prepare("SELECT id, fournisseur, email, nom, avatar FROM utilisateurs WHERE id = ?").get(id) as Utilisateur | undefined;
  return l ? { ...l } : null;
}

/* ======================= Cours ======================= */

export type Cours = {
  id: string;
  titre: string;
  titreAuto: boolean;
  matiere: string;
  dossierId: string | null;
  source: string;
  texte: string;
  fichiers: FichierCours[];
  fiche: Fiche | null;
  ficheLe: number | null;
  creeLe: number;
};

export type LigneCours = {
  id: string;
  titre: string;
  matiere: string;
  dossierId: string | null;
  source: string;
  aUneFiche: boolean;
  nbFichiers: number;
  nbPhotos: number;
  nbQcm: number;
  meilleur: number | null;
  creeLe: number;
};

export function creerCours(
  u: string,
  infos: { titre: string; titreAuto: boolean; source: string; texte: string; fichiers: FichierCours[]; dossierId: string | null }
): string {
  const id = randomUUID().slice(0, 8);
  const dossierId = infos.dossierId && lireDossier(u, infos.dossierId) ? infos.dossierId : null;
  db()
    .prepare(
      `INSERT INTO cours (id, utilisateur_id, dossier_id, titre, titre_auto, matiere, source, texte, fichiers, cree_le)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?)`
    )
    .run(id, u, dossierId, infos.titre, infos.titreAuto ? 1 : 0, infos.source, infos.texte, JSON.stringify(infos.fichiers), Date.now());
  return id;
}

export function lireCours(u: string, id: string): Cours | null {
  const l = db()
    .prepare(
      "SELECT id, titre, titre_auto, matiere, dossier_id, source, texte, fichiers, fiche, fiche_le, cree_le FROM cours WHERE id = ? AND utilisateur_id = ?"
    )
    .get(id, u) as
    | {
        id: string;
        titre: string;
        titre_auto: number;
        matiere: string;
        dossier_id: string | null;
        source: string;
        texte: string;
        fichiers: string;
        fiche: string | null;
        fiche_le: number | null;
        cree_le: number;
      }
    | undefined;
  if (!l) return null;
  return {
    id: l.id,
    titre: l.titre,
    titreAuto: l.titre_auto === 1,
    matiere: l.matiere,
    dossierId: l.dossier_id,
    source: l.source,
    texte: l.texte,
    fichiers: JSON.parse(l.fichiers) as FichierCours[],
    fiche: l.fiche ? (JSON.parse(l.fiche) as Fiche) : null,
    ficheLe: l.fiche_le,
    creeLe: l.cree_le,
  };
}

/** dossierId : un id = ce dossier ; null = les cours rangés nulle part ; undefined = tous. */
export function listerCours(u: string, dossierId?: string | null): LigneCours[] {
  const filtre = dossierId === undefined ? "" : dossierId === null ? "AND c.dossier_id IS NULL" : "AND c.dossier_id = ?";
  const lignes = db()
    .prepare(
      `SELECT c.id, c.titre, c.matiere, c.dossier_id, c.source, c.fichiers, c.cree_le,
              c.fiche IS NOT NULL AS a_fiche,
              (SELECT COUNT(*) FROM quizzes q WHERE q.cours_id = c.id) AS nb_qcm,
              (SELECT MAX(CAST(t.score AS REAL) / t.total) FROM quizzes q JOIN tentatives t ON t.quiz_id = q.id WHERE q.cours_id = c.id) AS meilleur
         FROM cours c
        WHERE c.utilisateur_id = ? ${filtre}
        ORDER BY c.cree_le DESC`
    )
    .all(u, ...(dossierId ? [dossierId] : [])) as {
    id: string;
    titre: string;
    matiere: string;
    dossier_id: string | null;
    source: string;
    fichiers: string;
    cree_le: number;
    a_fiche: number;
    nb_qcm: number;
    meilleur: number | null;
  }[];
  return lignes.map((l) => ({
    id: l.id,
    titre: l.titre,
    matiere: l.matiere,
    dossierId: l.dossier_id,
    source: l.source,
    aUneFiche: Number(l.a_fiche) === 1,
    nbFichiers: (JSON.parse(l.fichiers) as unknown[]).length,
    nbPhotos: (JSON.parse(l.fichiers) as FichierCours[]).filter((f) => f.type.startsWith("image/")).length,
    nbQcm: Number(l.nb_qcm),
    meilleur: l.meilleur,
    creeLe: l.cree_le,
  }));
}

/** Changement fait par l'élève : un titre choisi à la main n'est plus remplacé par l'IA. */
export function modifierCours(u: string, id: string, champs: { titre?: string; dossierId?: string | null }): boolean {
  if (!lireCours(u, id)) return false;
  if (champs.titre !== undefined) db().prepare("UPDATE cours SET titre = ?, titre_auto = 0 WHERE id = ?").run(champs.titre, id);
  if (champs.dossierId !== undefined) {
    const cible = champs.dossierId && lireDossier(u, champs.dossierId) ? champs.dossierId : null;
    db().prepare("UPDATE cours SET dossier_id = ? WHERE id = ?").run(cible, id);
  }
  return true;
}

/** Ce que l'IA a compris du cours : remplace le titre provisoire (nom du fichier) et complète la matière. */
export function completerCours(u: string, id: string, infos: { titre: string; matiere: string }) {
  const c = lireCours(u, id);
  if (!c) return;
  if (c.titreAuto && infos.titre) db().prepare("UPDATE cours SET titre = ?, titre_auto = 0 WHERE id = ?").run(infos.titre, id);
  if (!c.matiere && infos.matiere) db().prepare("UPDATE cours SET matiere = ? WHERE id = ?").run(infos.matiere, id);
}

/* ---------- Fiche : versions, modifications, proposition de l'IA ---------- */

export type OrigineFiche = "ia" | "main" | "retouche";
export const VERSIONS_MAX = 10;

/** Toutes les illustrations rangées pour ce cours (fiche actuelle, proposition, anciennes versions). */
function illustrationsDuCours(coursId: string): Set<string> {
  const l = db().prepare("SELECT fiche, fiche_proposee FROM cours WHERE id = ?").get(coursId) as { fiche: string | null; fiche_proposee: string | null } | undefined;
  const versions = db().prepare("SELECT fiche FROM fiches_versions WHERE cours_id = ?").all(coursId) as { fiche: string }[];
  const fichiers = new Set<string>();
  for (const brut of [l?.fiche, l?.fiche_proposee, ...versions.map((v) => v.fiche)]) {
    if (brut) (JSON.parse(brut) as Fiche).illustrations?.forEach((i) => fichiers.add(i.fichier));
  }
  return fichiers;
}

/**
 * Enregistre une nouvelle fiche et garde l'ancienne dans l'historique.
 * Les illustrations qui ne servent plus à aucune version sont effacées.
 */
export function enregistrerFiche(u: string, id: string, fiche: Fiche, origine: OrigineFiche = "ia") {
  const actuelle = db().prepare("SELECT fiche, fiche_origine, fiche_le FROM cours WHERE id = ? AND utilisateur_id = ?").get(id, u) as
    | { fiche: string | null; fiche_origine: string; fiche_le: number | null }
    | undefined;
  if (!actuelle) return;
  const avant = illustrationsDuCours(id);
  const b = db();
  // Un point de sauvegarde marche seul ou à l'intérieur d'une transaction (fin d'un traitement).
  b.exec("SAVEPOINT enregistrer_fiche");
  try {
    if (actuelle.fiche) {
      b.prepare("INSERT INTO fiches_versions (cours_id, fiche, origine, cree_le) VALUES (?, ?, ?, ?)").run(id, actuelle.fiche, actuelle.fiche_origine, actuelle.fiche_le ?? Date.now());
      b.prepare(
        `DELETE FROM fiches_versions WHERE cours_id = ? AND id NOT IN (SELECT id FROM fiches_versions WHERE cours_id = ? ORDER BY id DESC LIMIT ${VERSIONS_MAX})`
      ).run(id, id);
    }
    b.prepare("UPDATE cours SET fiche = ?, fiche_le = ?, fiche_origine = ? WHERE id = ?").run(JSON.stringify(fiche), Date.now(), origine, id);
    b.exec("RELEASE enregistrer_fiche");
  } catch (e) {
    b.exec("ROLLBACK TO enregistrer_fiche");
    b.exec("RELEASE enregistrer_fiche");
    throw e;
  }
  const apres = illustrationsDuCours(id);
  avant.forEach((f) => !apres.has(f) && supprimerFichier(f));
}

export type VersionFiche = { id: number; origine: OrigineFiche; creeLe: number; nbSections: number; titre: string };

export function listerVersionsFiche(u: string, coursId: string): VersionFiche[] {
  const lignes = db()
    .prepare("SELECT v.id, v.origine, v.cree_le, v.fiche FROM fiches_versions v JOIN cours c ON c.id = v.cours_id WHERE v.cours_id = ? AND c.utilisateur_id = ? ORDER BY v.id DESC")
    .all(coursId, u) as { id: number; origine: OrigineFiche; cree_le: number; fiche: string }[];
  return lignes.map((l) => {
    const f = JSON.parse(l.fiche) as Fiche;
    return { id: Number(l.id), origine: l.origine, creeLe: l.cree_le, nbSections: f.sections.length, titre: f.titre };
  });
}

/** Remet une ancienne version ; la fiche actuelle part à son tour dans l'historique. */
export function restaurerVersionFiche(u: string, coursId: string, versionId: number): boolean {
  const v = db()
    .prepare("SELECT v.fiche, v.origine FROM fiches_versions v JOIN cours c ON c.id = v.cours_id WHERE v.id = ? AND v.cours_id = ? AND c.utilisateur_id = ?")
    .get(versionId, coursId, u) as { fiche: string; origine: OrigineFiche } | undefined;
  if (!v) return false;
  db().prepare("DELETE FROM fiches_versions WHERE id = ?").run(versionId);
  enregistrerFiche(u, coursId, JSON.parse(v.fiche) as Fiche, v.origine);
  return true;
}

export function lireProposition(u: string, coursId: string): { fiche: Fiche; consigne: string } | null {
  const l = db().prepare("SELECT fiche_proposee, proposition_consigne FROM cours WHERE id = ? AND utilisateur_id = ?").get(coursId, u) as
    | { fiche_proposee: string | null; proposition_consigne: string }
    | undefined;
  return l?.fiche_proposee ? { fiche: JSON.parse(l.fiche_proposee) as Fiche, consigne: l.proposition_consigne } : null;
}

export function enregistrerProposition(u: string, coursId: string, fiche: Fiche, consigne: string) {
  db().prepare("UPDATE cours SET fiche_proposee = ?, proposition_consigne = ? WHERE id = ? AND utilisateur_id = ?").run(JSON.stringify(fiche), consigne.slice(0, 500), coursId, u);
}

/** L'élève garde (true) ou refuse (false) la version proposée par l'IA. */
export function deciderProposition(u: string, coursId: string, garder: boolean): boolean {
  const p = lireProposition(u, coursId);
  if (!p) return false;
  const avant = illustrationsDuCours(coursId);
  db().prepare("UPDATE cours SET fiche_proposee = NULL, proposition_consigne = '' WHERE id = ?").run(coursId);
  if (garder) enregistrerFiche(u, coursId, p.fiche, "retouche");
  else {
    const apres = illustrationsDuCours(coursId);
    avant.forEach((f) => !apres.has(f) && supprimerFichier(f));
  }
  return true;
}

/** Corrige le texte d'origine du cours (faute de lecture d'une photo, passage en trop…). */
export function modifierTexteCours(u: string, id: string, texte: string): boolean {
  return Number(db().prepare("UPDATE cours SET texte = ? WHERE id = ? AND utilisateur_id = ?").run(texte, id, u).changes) === 1;
}

/** Met à jour le placement d'une ancienne fiche sans changer sa date ni écraser une régénération. */
export function enregistrerPlacementImages(u: string, id: string, fiche: Fiche, ficheLe: number | null) {
  db().prepare("UPDATE cours SET fiche = ? WHERE id = ? AND utilisateur_id = ? AND fiche_le IS ?")
    .run(JSON.stringify(fiche), id, u, ficheLe);
}

/** Supprime le cours et ses fichiers. Ses QCM restent (ils ont leurs questions), mais sans cours. */
export function supprimerCours(u: string, id: string): boolean {
  const c = lireCours(u, id);
  if (!c) return false;
  const illustrations = illustrationsDuCours(id);
  db().prepare("DELETE FROM cours WHERE id = ?").run(id);
  c.fichiers.forEach((f) => supprimerFichier(f.fichier));
  illustrations.forEach(supprimerFichier);
  return true;
}

/* ======================= QCM ======================= */

export type QuizEnregistre = {
  id: string;
  difficulte: string;
  creeLe: number;
  coursId: string | null;
  coursTitre: string | null;
  quiz: Quiz;
};

export type LigneQcm = {
  id: string;
  titre: string;
  matiere: string;
  difficulte: string;
  coursId: string | null;
  coursTitre: string | null;
  nbQuestions: number;
  creeLe: number;
  tentatives: number;
  meilleur: number | null;
};

export function creerQuiz(u: string, quiz: Quiz, infos: { difficulte: string; fournisseur: string; coursId: string | null }): string {
  const id = randomUUID().slice(0, 8);
  db()
    .prepare(
      `INSERT INTO quizzes (id, titre, matiere, difficulte, fournisseur, donnees, cree_le, cours_id, utilisateur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, quiz.titre, quiz.matiere, infos.difficulte, infos.fournisseur, JSON.stringify(quiz), Date.now(), infos.coursId, u);
  return id;
}

export function lireQuiz(u: string, id: string): QuizEnregistre | null {
  const l = db()
    .prepare(
      `SELECT q.id, q.titre, q.difficulte, q.donnees, q.cree_le, q.cours_id, c.titre AS cours_titre
         FROM quizzes q LEFT JOIN cours c ON c.id = q.cours_id
        WHERE q.id = ? AND q.utilisateur_id = ?`
    )
    .get(id, u) as
    | { id: string; titre: string; difficulte: string; donnees: string; cree_le: number; cours_id: string | null; cours_titre: string | null }
    | undefined;
  if (!l) return null;
  const quiz = JSON.parse(l.donnees) as Quiz;
  return { id: l.id, difficulte: l.difficulte, creeLe: l.cree_le, coursId: l.cours_id, coursTitre: l.cours_titre, quiz: { ...quiz, titre: l.titre } };
}

/** coursId : les QCM de ce cours ; undefined : tous les QCM du compte. */
export function listerQuiz(u: string, coursId?: string): LigneQcm[] {
  const lignes = db()
    .prepare(
      `SELECT q.id, q.titre, q.matiere, q.difficulte, q.cours_id, c.titre AS cours_titre, q.donnees, q.cree_le,
              COUNT(t.id) AS tentatives,
              MAX(CAST(t.score AS REAL) / t.total) AS meilleur
         FROM quizzes q
         LEFT JOIN cours c ON c.id = q.cours_id
         LEFT JOIN tentatives t ON t.quiz_id = q.id
        WHERE q.utilisateur_id = ? ${coursId ? "AND q.cours_id = ?" : ""}
        GROUP BY q.id
        ORDER BY q.cree_le DESC`
    )
    .all(u, ...(coursId ? [coursId] : [])) as {
    id: string;
    titre: string;
    matiere: string;
    difficulte: string;
    cours_id: string | null;
    cours_titre: string | null;
    donnees: string;
    cree_le: number;
    tentatives: number;
    meilleur: number | null;
  }[];
  return lignes.map((l) => ({
    id: l.id,
    titre: l.titre,
    matiere: l.matiere,
    difficulte: l.difficulte,
    coursId: l.cours_id,
    coursTitre: l.cours_titre,
    nbQuestions: (JSON.parse(l.donnees) as Quiz).questions.length,
    creeLe: l.cree_le,
    tentatives: Number(l.tentatives),
    meilleur: l.meilleur,
  }));
}

export function modifierQuiz(u: string, id: string, champs: { titre?: string }): boolean {
  if (!lireQuiz(u, id)) return false;
  if (champs.titre !== undefined) db().prepare("UPDATE quizzes SET titre = ? WHERE id = ? AND utilisateur_id = ?").run(champs.titre, id, u);
  return true;
}

/**
 * L'élève signale qu'une question est fausse (erreur de l'IA) : elle ne compte
 * plus dans la note ni dans les révisions. `valeur` à false annule le signalement.
 */
export function signalerQuestion(u: string, id: string, index: number, valeur: boolean): boolean {
  const l = db().prepare("SELECT donnees FROM quizzes WHERE id = ? AND utilisateur_id = ?").get(id, u) as { donnees: string } | undefined;
  if (!l) return false;
  const quiz = JSON.parse(l.donnees) as Quiz;
  const q = quiz.questions[index];
  if (!q) return false;
  if (valeur) q.signalee = true;
  else delete q.signalee;
  db().prepare("UPDATE quizzes SET donnees = ? WHERE id = ?").run(JSON.stringify(quiz), id);
  if (valeur) db().prepare("DELETE FROM revisions WHERE quiz_id = ? AND question = ?").run(id, index);
  return true;
}

/** Remplace les données d'un QCM (questions complétées par le site, ex. les pages du PDF). */
export function enregistrerDonneesQuiz(u: string, id: string, quiz: Quiz) {
  db().prepare("UPDATE quizzes SET donnees = ? WHERE id = ? AND utilisateur_id = ?").run(JSON.stringify(quiz), id, u);
}

/** Les énoncés des QCM déjà faits sur ce cours, pour que l'IA ne les repose pas. */
export function questionsDejaPosees(u: string, coursId: string): string[] {
  const lignes = db().prepare("SELECT donnees FROM quizzes WHERE utilisateur_id = ? AND cours_id = ? ORDER BY cree_le DESC").all(u, coursId) as { donnees: string }[];
  const vues = new Set<string>();
  for (const l of lignes) for (const q of (JSON.parse(l.donnees) as Quiz).questions) if (!q.signalee) vues.add(q.question.trim());
  return [...vues];
}

/** Moyenne des meilleures notes par matière (sur 1), pour l'accueil. */
export function moyennesParMatiere(u: string): { matiere: string; moyenne: number; nbQcm: number }[] {
  const lignes = db()
    .prepare(
      `SELECT matiere, AVG(m) AS moyenne, COUNT(*) AS nb FROM (
         SELECT COALESCE(NULLIF(q.matiere, ''), 'Autre') AS matiere, MAX(CAST(t.score AS REAL) / t.total) AS m
           FROM quizzes q JOIN tentatives t ON t.quiz_id = q.id
          WHERE q.utilisateur_id = ? AND t.total > 0 GROUP BY q.id)
        GROUP BY matiere ORDER BY nb DESC, matiere`
    )
    .all(u) as { matiere: string; moyenne: number; nb: number }[];
  return lignes.map((l) => ({ matiere: l.matiere, moyenne: l.moyenne, nbQcm: Number(l.nb) }));
}

/** Les fiches « au propre » du compte (pour les cartes mémoire). */
export function fichesDuCompte(u: string): { id: string; titre: string; matiere: string; fiche: Fiche }[] {
  const lignes = db()
    .prepare("SELECT id, titre, matiere, fiche FROM cours WHERE utilisateur_id = ? AND fiche IS NOT NULL ORDER BY cree_le DESC")
    .all(u) as { id: string; titre: string; matiere: string; fiche: string }[];
  return lignes.map((l) => ({ id: l.id, titre: l.titre, matiere: l.matiere, fiche: JSON.parse(l.fiche) as Fiche }));
}

export function enregistrerTentative(quizId: string, reponses: number[], score: number, total: number) {
  db()
    .prepare("INSERT INTO tentatives (quiz_id, reponses, score, total, fait_le) VALUES (?, ?, ?, ?, ?)")
    .run(quizId, JSON.stringify(reponses), score, total, Date.now());
}

export function supprimerQuiz(u: string, id: string): boolean {
  if (!lireQuiz(u, id)) return false;
  db().prepare("DELETE FROM quizzes WHERE id = ? AND utilisateur_id = ?").run(id, u);
  return true;
}

/* ======================= Fichiers ======================= */

/** Vrai si ce fichier rangé appartient au compte (fichier ou illustration d'un de ses cours, image d'un de ses dossiers). */
export function fichierAppartientA(u: string, nom: string): boolean {
  const motif = `%"fichier":"${nom.replace(/[%_"\\]/g, "")}"%`;
  // Les illustrations sorties d'un PDF ou d'un Word sont rangées dans la fiche du cours.
  if (db().prepare("SELECT 1 FROM cours WHERE utilisateur_id = ? AND (fichiers LIKE ? OR fiche LIKE ? OR fiche_proposee LIKE ?) LIMIT 1").get(u, motif, motif, motif)) return true;
  if (db().prepare("SELECT 1 FROM fiches_versions v JOIN cours c ON c.id = v.cours_id WHERE c.utilisateur_id = ? AND v.fiche LIKE ? LIMIT 1").get(u, motif)) return true;
  return Boolean(db().prepare("SELECT 1 FROM dossiers WHERE utilisateur_id = ? AND image = ? LIMIT 1").get(u, nom));
}

/* ======================= Dossiers ======================= */

export const COULEURS_DOSSIER = ["bleu", "rouge", "vert", "jaune", "violet", "orange"] as const;
export type CouleurDossier = (typeof COULEURS_DOSSIER)[number];

export type Dossier = {
  id: string;
  nom: string;
  couleur: CouleurDossier;
  image: string | null;
  nbCours: number;
  moyenne: number | null;
};

function couleurValide(c: string | undefined): CouleurDossier {
  return (COULEURS_DOSSIER as readonly string[]).includes(c ?? "") ? (c as CouleurDossier) : "bleu";
}

export function listerDossiers(u: string): Dossier[] {
  const lignes = db()
    .prepare(
      `SELECT d.id, d.nom, d.couleur, d.image,
              (SELECT COUNT(*) FROM cours c WHERE c.dossier_id = d.id) AS nb,
              (SELECT AVG(m) FROM (
                 SELECT MAX(CAST(t.score AS REAL) / t.total) AS m
                   FROM cours c JOIN quizzes q ON q.cours_id = c.id JOIN tentatives t ON t.quiz_id = q.id
                  WHERE c.dossier_id = d.id GROUP BY q.id)) AS moyenne
         FROM dossiers d
        WHERE d.utilisateur_id = ?
        ORDER BY d.nom COLLATE NOCASE`
    )
    .all(u) as { id: string; nom: string; couleur: string; image: string | null; nb: number; moyenne: number | null }[];
  return lignes.map((l) => ({ id: l.id, nom: l.nom, couleur: couleurValide(l.couleur), image: l.image, nbCours: Number(l.nb), moyenne: l.moyenne }));
}

export function lireDossier(u: string, id: string): Dossier | null {
  return listerDossiers(u).find((d) => d.id === id) ?? null;
}

export function creerDossier(u: string, nom: string, couleur: string, image: string | null): string {
  const id = randomUUID().slice(0, 8);
  db()
    .prepare("INSERT INTO dossiers (id, nom, couleur, image, cree_le, utilisateur_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, nom, couleurValide(couleur), image, Date.now(), u);
  return id;
}

export function modifierDossier(u: string, id: string, champs: { nom?: string; couleur?: string; image?: string | null }): boolean {
  const d = lireDossier(u, id);
  if (!d) return false;
  if (champs.nom !== undefined) db().prepare("UPDATE dossiers SET nom = ? WHERE id = ?").run(champs.nom, id);
  if (champs.couleur !== undefined) db().prepare("UPDATE dossiers SET couleur = ? WHERE id = ?").run(couleurValide(champs.couleur), id);
  if (champs.image !== undefined) {
    db().prepare("UPDATE dossiers SET image = ? WHERE id = ?").run(champs.image, id);
    if (d.image && d.image !== champs.image) supprimerFichier(d.image);
  }
  return true;
}

/** Supprime le dossier ; ses cours ne sont pas effacés, ils sortent du dossier. */
export function supprimerDossier(u: string, id: string): boolean {
  const d = lireDossier(u, id);
  if (!d) return false;
  db().prepare("UPDATE cours SET dossier_id = NULL WHERE dossier_id = ?").run(id);
  db().prepare("DELETE FROM dossiers WHERE id = ?").run(id);
  supprimerFichier(d.image);
  return true;
}
