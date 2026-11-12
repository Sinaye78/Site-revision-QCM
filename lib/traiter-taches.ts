import { lireCours, enregistrerFiche, completerCours, creerQuiz, questionsDejaPosees, enregistrerProposition } from "./db";
import { retoucherFiche } from "./retouche";
import { calculerCorrection, genererControle } from "./controle-ia";
import { creerControle, enregistrerCorrection } from "./controles-db";
import type { TypeQuestion } from "./controle";
import { prendreTache, signalerTache, finirTache, echouerTache, rendreTache, lirePartie, garderPartie } from "./taches-db";
import { ErreurIA, genererFiche, genererQuiz, iaLitLesImages } from "./ia";
import { extraireIllustrations, type Illustration } from "./illustrations";
import { lireFichier, supprimerFichier } from "./fichiers";
import { imagesDuCours } from "./ajout-cours";
import { finaliser } from "./extraction";
import { placerImages } from "./fiche";
import { melangerChoix, type Difficulte } from "./quiz";
import { ajouterPages } from "./pages-pdf";
import type { AvancementIA, ExecutionIA, ModeIA } from "./taches-types";

export async function traiterUneTache(arret?: AbortSignal): Promise<boolean> {
  const t = prendreTache();
  if (!t || !t.jeton) return false;
  const jeton = t.jeton; const controle = new AbortController();
  const signal = arret ? AbortSignal.any([arret, controle.signal]) : controle.signal;
  const heartbeat = setInterval(() => { if (!signalerTache(t.id, jeton)) controle.abort(); }, 15000);
  let illustrations: Illustration[] = []; let termine = false; let dernier = 0; let phase = "";
  const suivi = (a: AvancementIA) => {
    const cle = `${a.phase}:${a.fournisseur}:${a.partiesFaites}`;
    if (cle === phase && Date.now() - dernier < 1500) return;
    phase = cle; dernier = Date.now();
    if (!signalerTache(t.id, jeton, a)) { controle.abort(); throw new Error("Traitement interrompu."); }
  };
  const parametres = JSON.parse(t.parametres) as { mode?: ModeIA; nombre: number; difficulte: Difficulte; demande?: string; section?: number; types?: TypeQuestion[]; duree?: number; copie?: string };
  const mode = parametres.mode === "local" || parametres.mode === "rapide" ? parametres.mode : undefined;
  const execution: ExecutionIA = { mode, signal, suivi, reprise: {
    lire: (numero, empreinte) => lirePartie(t.id, numero, empreinte),
    ecrire: (numero, empreinte, resultat) => garderPartie(t.id, jeton, numero, empreinte, resultat),
  } };
  try {
    suivi({ phase: "lecture" });
    const cours = lireCours(t.utilisateur_id, t.cours_id);
    if (!cours) throw new Error("Ce cours n’existe plus.");
    if (t.type === "correction") {
      const copieId = String(parametres.copie ?? "");
      const { correction, note } = await calculerCorrection(copieId, execution);
      suivi({ phase: "enregistrement" });
      finirTache(t.id, jeton, () => {
        enregistrerCorrection(copieId, correction, note);
        return copieId;
      });
      termine = true;
    } else if (t.type === "controle") {
      const images = imagesDuCours(cours);
      const texte = finaliser([cours.texte], images).texte;
      const types = (parametres.types ?? []).length ? parametres.types! : (["qcm", "vrai_faux", "trous", "courte", "redigee"] as TypeQuestion[]);
      const { controle, fournisseur } = await genererControle({
        texte, images, titre: cours.titre, matiere: cours.matiere, nombre: parametres.nombre, types, difficulte: parametres.difficulte,
        eviter: questionsDejaPosees(t.utilisateur_id, cours.id), ...execution,
      });
      suivi({ phase: "enregistrement", fournisseur });
      finirTache(t.id, jeton, () => creerControle(t.utilisateur_id, controle, { coursId: cours.id, difficulte: parametres.difficulte, dureeMin: parametres.duree ?? 0, fournisseur }));
      termine = true;
    } else if (t.type === "retouche") {
      if (!cours.fiche) throw new ErreurIA("Ce cours n’a pas encore de fiche à retoucher.");
      const { fiche, fournisseur } = await retoucherFiche({ fiche: cours.fiche, demande: parametres.demande ?? "", section: parametres.section, texteCours: cours.texte, ...execution });
      suivi({ phase: "enregistrement", fournisseur });
      finirTache(t.id, jeton, () => {
        const actuelle = lireCours(t.utilisateur_id, cours.id);
        if (!actuelle || actuelle.ficheLe !== cours.ficheLe) throw new Error("La fiche a été modifiée pendant la retouche : relance-la.");
        enregistrerProposition(t.utilisateur_id, cours.id, fiche, parametres.demande ?? "");
        return cours.id;
      });
      termine = true;
    } else if (t.type === "fiche") {
      illustrations = await extraireIllustrations(cours);
      signal.throwIfAborted();
      const photos = cours.fichiers.filter(f => f.type.startsWith("image/")).map(f => ({ fichier: f.fichier, nom: f.nom, photo: true }));
      const vision = iaLitLesImages(mode);
      const references = [...photos, ...illustrations.map(i => ({ ...i, photo: false }))].flatMap(j => {
        const lu = j.photo || vision ? lireFichier(j.fichier) : null;
        if ((j.photo || vision) && !lu) return [];
        return [{ ...j, url: lu ? `data:${lu.type};base64,${lu.contenu.toString("base64")}` : undefined }];
      });
      const { fiche, fournisseur } = await genererFiche({ texte: cours.texte, images: references, ...execution });
      suivi({ phase: "validation", fournisseur }); signal.throwIfAborted();
      const reconstruite = placerImages(fiche, references.map(j => j.fichier), illustrations);
      suivi({ phase: "enregistrement", fournisseur });
      finirTache(t.id, jeton, () => {
        const actuelle = lireCours(t.utilisateur_id, cours.id);
        if (!actuelle || actuelle.ficheLe !== cours.ficheLe) throw new Error("Une version plus récente du cours a été conservée.");
        enregistrerFiche(t.utilisateur_id, cours.id, reconstruite);
        if (fournisseur !== "démo") completerCours(t.utilisateur_id, cours.id, { titre: fiche.titre, matiere: fiche.matiere });
        return cours.id;
      });
      // Les anciennes illustrations restent tant qu'une version de l'historique les utilise.
      termine = true;
    } else {
      const p = parametres;
      const images = imagesDuCours(cours); const texte = finaliser([cours.texte], images).texte;
      const eviter = questionsDejaPosees(t.utilisateur_id, cours.id);
      const { quiz, fournisseur } = await genererQuiz({ texte, images, titre: cours.titre, matiere: cours.matiere, nombre: p.nombre, difficulte: p.difficulte, eviter, ...execution });
      suivi({ phase: "validation", fournisseur }); signal.throwIfAborted();
      const avecPages = { ...quiz, questions: await ajouterPages(cours, quiz.questions), pages_verifiees: true };
      suivi({ phase: "enregistrement", fournisseur });
      finirTache(t.id, jeton, () => {
        const id = creerQuiz(t.utilisateur_id, melangerChoix(avecPages), { difficulte: p.difficulte, fournisseur, coursId: cours.id });
        if (fournisseur !== "démo") completerCours(t.utilisateur_id, cours.id, { titre: quiz.titre, matiere: quiz.matiere });
        return id;
      });
      termine = true;
    }
  } catch (e) {
    if (!termine) {
      if (signal.aborted) rendreTache(t.id, jeton);
      else echouerTache(t.id, jeton, e instanceof ErreurIA ? `${e.code ? `Code ${e.code} : ` : ""}${e.message}` : "Le traitement n’a pas pu se terminer. Tu peux le relancer depuis ton cours.");
    }
    console.error("[traitement]", t.id, e instanceof Error ? e.message : "échec");
  } finally {
    clearInterval(heartbeat);
    if (!termine) illustrations.forEach(i => supprimerFichier(i.fichier));
  }
  return true;
}
