import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireQuiz } from "@/lib/db";
import { BoutonImprimer } from "@/components/bouton-imprimer";

const LETTRES = ["A", "B", "C", "D"];

/** Version papier d'un QCM : le sujet avec des cases à cocher, puis le corrigé sur une nouvelle page. */
export default async function ImprimerQcm({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const q = lireQuiz(u.id, (await params).id);
  if (!q) notFound();
  const questions = q.quiz.questions.filter((x) => !x.signalee);

  return (
    <main className="page-imprimee">
      <div className="non-imprime barre-impression">
        <BoutonImprimer />
        <span className="discret petit">Dans la fenêtre d&apos;impression, choisis « Enregistrer au format PDF » pour garder un PDF.</span>
      </div>
      <header className="sujet-entete">
        <h1>{q.quiz.titre}</h1>
        <p>
          {q.quiz.matiere && `${q.quiz.matiere} · `}
          {questions.length} questions · une seule bonne réponse par question
        </p>
        <p className="sujet-nom">Nom : ______________________ &nbsp;&nbsp; Note : ______ / 20</p>
      </header>
      <ol className="sujet-questions">
        {questions.map((x, i) => (
          <li key={i}>
            <p className="sujet-enonce">{x.question}</p>
            <ul>
              {x.choix.map((c, j) => (
                <li key={j}>
                  <span className="case-papier" aria-hidden="true" /> {LETTRES[j]}. {c}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <section className="corrige">
        <h2>Corrigé</h2>
        <ol>
          {questions.map((x, i) => (
            <li key={i}>
              <strong>
                {LETTRES[x.bonne_reponse]}. {x.choix[x.bonne_reponse]}
              </strong>
              <span> — {x.explication}</span>
              {x.page && <span className="discret"> (cours, page {x.page})</span>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
