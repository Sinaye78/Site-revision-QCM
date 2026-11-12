import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { enregistrerDonneesQuiz, lireCours, lireQuiz } from "@/lib/db";
import { ajouterPages, pdfDuCours } from "@/lib/pages-pdf";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { Joueur } from "@/components/joueur";
import { MenuExport } from "@/components/menu-export";

export default async function PageQcm({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const { id } = await params;
  const enregistre = lireQuiz(u.id, id);
  if (!enregistre) notFound();
  // Anciens QCM : on cherche une seule fois la page du PDF de chaque extrait.
  if (!enregistre.quiz.pages_verifiees && enregistre.coursId) {
    const cours = lireCours(u.id, enregistre.coursId);
    if (cours) {
      const questions = pdfDuCours(cours) ? await ajouterPages(cours, enregistre.quiz.questions) : enregistre.quiz.questions;
      const { titre: _titre, ...sansTitre } = enregistre.quiz;
      enregistrerDonneesQuiz(u.id, id, { ...sansTitre, titre: enregistre.quiz.titre, questions, pages_verifiees: true });
      enregistre.quiz = { ...enregistre.quiz, questions, pages_verifiees: true };
    }
  }

  return (
    <main className="feuille">
      <Entete />
      <div className="barre-qcm">
        {enregistre.coursId ? (
          <Link href={`/cours/${enregistre.coursId}`} className="bouton fantome">
            <Icone nom="fichier" /> Revoir le cours : {enregistre.coursTitre}
          </Link>
        ) : (
          <span />
        )}
        <MenuExport api={`/api/qcm/${enregistre.id}/export`} imprimer={`/qcm/${enregistre.id}/imprimer`} />
      </div>
      <Joueur
        type="copie"
        quizId={enregistre.id}
        coursId={enregistre.coursId}
        titre={enregistre.quiz.titre}
        matiere={enregistre.quiz.matiere}
        difficulte={enregistre.difficulte}
        items={enregistre.quiz.questions.map((question, index) => ({ quizId: enregistre.id, index, question }))}
      />
    </main>
  );
}
