import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, creerInvite, creerCours, creerQuiz, lireCours, transfererDonnees } from "../lib/db";
import { enqueuerTache, lireTache, listerTaches, prendreTache, signalerTache, finirTache, echouerTache, lirePartie, garderPartie, QuotaTaches } from "../lib/taches-db";
import { traiterUneTache } from "../lib/traiter-taches";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-taches-"));
process.env.AUTH_SECRET = "secret-pour-tests-uniquement";
process.env.INVITE_QCM_PAR_JOUR = "1";
beforeEach(() => { listerTaches("aucun"); db().exec("DELETE FROM taches; DELETE FROM quotas_invites;"); });
function source() {
  const u = creerInvite();
  const id = creerCours(u.id, { titre: "Cours test", titreAuto: false, source: "Texte", texte: "Les plantes vertes produisent de la matière organique grâce à la photosynthèse. Elles utilisent la lumière, l’eau et le dioxyde de carbone, puis elles libèrent du dioxygène.", fichiers: [], dossierId: null });
  return { u, id };
}
test("la demande est persistée, privée, dédupliquée et ne consomme qu'un quota", () => {
  const { u, id } = source(); const autre = creerInvite();
  const a = enqueuerTache(u.id, id, "fiche", {}, true, "test-ip");
  const b = enqueuerTache(u.id, id, "fiche", {}, true, "test-ip");
  assert.equal(a.id, b.id); assert.equal(lireTache(autre.id, a.id), null);
  assert.equal(lireTache(u.id, a.id)?.statut, "en_attente");
  assert.equal((db().prepare("SELECT nombre FROM quotas_invites").get() as { nombre: number }).nombre, 1);
  assert.throws(() => enqueuerTache(u.id, id, "qcm", { nombre: 5, difficulte: "facile" }, true, "test-ip"), QuotaTaches);
  assert.throws(() => enqueuerTache(autre.id, id, "fiche", {}, false, ""), /introuvable/);
});
test("une erreur rembourse le quota une seule fois", () => {
  const { u, id } = source(); const a = enqueuerTache(u.id, id, "fiche", {}, true, "test-ip");
  const prise = prendreTache()!; echouerTache(a.id, prise.jeton!, "Échec test"); echouerTache(a.id, prise.jeton!, "Échec test");
  assert.equal(lireTache(u.id, a.id)?.statut, "erreur");
  assert.equal((db().prepare("SELECT nombre FROM quotas_invites").get() as { nombre: number }).nombre, 0);
  assert.ok(enqueuerTache(u.id, id, "fiche", {}, true, "test-ip"));
});
test("le mode sans quota reste disponible après la limite rapide et son choix est conservé", () => {
  const { u, id } = source();
  const rapide = enqueuerTache(u.id, id, "fiche", { mode: "rapide" }, true, "modes-ip");
  assert.throws(() => enqueuerTache(u.id, id, "qcm", { mode: "rapide" }, true, "modes-ip"), QuotaTaches);
  const local = enqueuerTache(u.id, id, "fiche", { mode: "local" }, true, "modes-ip");
  assert.notEqual(local.id, rapide.id);
  assert.equal(local.mode, "local"); assert.equal(lireTache(u.id, rapide.id)?.mode, "rapide");
  assert.equal(enqueuerTache(u.id, id, "fiche", { mode: "local" }, true, "modes-ip").id, local.id);
  assert.equal((db().prepare("SELECT nombre FROM quotas_invites").get() as { nombre: number }).nombre, 1);
});
test("un traitement rapide peut démarrer pendant un traitement local, sans doubler les traitements locaux", () => {
  const { u, id } = source();
  const local = enqueuerTache(u.id, id, "fiche", { mode: "local" }, false, "");
  assert.equal(prendreTache()?.id, local.id);
  enqueuerTache(u.id, id, "qcm", { mode: "local" }, false, "");
  assert.equal(prendreTache(), null);
  const rapide = enqueuerTache(u.id, id, "qcm", { mode: "rapide" }, false, "");
  assert.equal(prendreTache()?.id, rapide.id);
  assert.equal(prendreTache(), null);
});
test("deux QCM avec des réglages différents restent deux demandes distinctes", () => {
  const { u, id } = source();
  const cinq = enqueuerTache(u.id, id, "qcm", { nombre: 5, difficulte: "facile" }, false, "");
  const dix = enqueuerTache(u.id, id, "qcm", { nombre: 10, difficulte: "facile" }, false, "");
  assert.notEqual(cinq.id, dix.id);
  assert.equal(enqueuerTache(u.id, id, "qcm", { nombre: 5, difficulte: "facile" }, false, "").id, cinq.id);
});
test("après une interruption, les parties enregistrées restent et l'ancien worker ne peut pas écrire", () => {
  const { u, id } = source(); const a = enqueuerTache(u.id, id, "fiche", {}, false, "");
  const avant = prendreTache()!; garderPartie(a.id, avant.jeton!, 0, "empreinte", { texte: "Partie faite" });
  db().prepare("UPDATE taches SET bail=0 WHERE id=?").run(a.id);
  const apres = prendreTache()!; assert.notEqual(apres.jeton, avant.jeton);
  assert.deepEqual(lirePartie(a.id, 0, "empreinte"), { texte: "Partie faite" });
  assert.equal(signalerTache(a.id, avant.jeton!), false);
  assert.throws(() => garderPartie(a.id, avant.jeton!, 1, "autre", {}), /interrompu/);
  assert.equal(signalerTache(a.id, apres.jeton!, { phase: "generation", partiesFaites: 1, partiesTotal: 3 }), true);
});
test("une relance après erreur récupère les parties validées sans réutiliser un résultat d'une autre demande", () => {
  const { u, id } = source(); const a = enqueuerTache(u.id, id, "fiche", {}, false, "");
  const prise = prendreTache()!; garderPartie(a.id, prise.jeton!, 0, "source-modele", { validee: true });
  echouerTache(a.id, prise.jeton!, "Interruption de réseau");
  const relance = enqueuerTache(u.id, id, "fiche", {}, false, "");
  assert.notEqual(a.id, relance.id); assert.deepEqual(lirePartie(relance.id, 0, "source-modele"), { validee: true });
  assert.equal(lirePartie(relance.id, 0, "source-modifiee"), null);
});
test("l'enregistrement du QCM et la fin de la tâche forment une seule transaction", () => {
  const { u, id } = source(); const a = enqueuerTache(u.id, id, "qcm", { nombre: 5, difficulte: "facile" }, false, "");
  const prise = prendreTache()!;
  const ajouter = () => creerQuiz(u.id, { titre: "QCM test", matiere: "", questions: [] }, { difficulte: "facile", fournisseur: "test", coursId: id });
  assert.throws(() => finirTache(a.id, prise.jeton!, () => { ajouter(); throw new Error("interruption"); }), /interruption/);
  assert.equal((db().prepare("SELECT COUNT(*) n FROM quizzes WHERE cours_id=?").get(id) as { n: number }).n, 0);
  finirTache(a.id, prise.jeton!, ajouter);
  assert.equal(lireTache(u.id, a.id)?.statut, "termine");
  assert.throws(() => finirTache(a.id, prise.jeton!, ajouter));
  assert.equal((db().prepare("SELECT COUNT(*) n FROM quizzes WHERE cours_id=?").get(id) as { n: number }).n, 1);
});
test("la connexion d'un invité transfère aussi son traitement en cours et ses points de reprise", () => {
  const { u, id } = source(); const compte = creerInvite();
  const a = enqueuerTache(u.id, id, "fiche", {}, false, ""); const prise = prendreTache()!;
  garderPartie(a.id, prise.jeton!, 0, "source", { conservee: true });
  transfererDonnees(u.id, compte.id);
  assert.equal(lireTache(u.id, a.id), null); assert.equal(lireTache(compte.id, a.id)?.statut, "en_attente");
  assert.equal(signalerTache(a.id, prise.jeton!), false);
  assert.deepEqual(lirePartie(a.id, 0, "source"), { conservee: true });
  assert.ok(lireCours(compte.id, id));
});
test("le service traite une tâche déjà enregistrée sans requête HTTP ni navigateur ouvert", async () => {
  const { u, id } = source(); const a = enqueuerTache(u.id, id, "fiche", {}, false, "");
  const ancien = process.env.IA_DEMO; process.env.IA_DEMO = "1";
  try {
    assert.equal(await traiterUneTache(), true);
    assert.equal(lireTache(u.id, a.id)?.statut, "termine"); assert.ok(lireCours(u.id, id)?.fiche);
  } finally { if (ancien === undefined) delete process.env.IA_DEMO; else process.env.IA_DEMO = ancien; }
});
