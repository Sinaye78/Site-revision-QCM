import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireControle } from "@/lib/controles-db";
import { formaterNote } from "@/lib/quiz";
import { BoutonImprimer } from "@/components/bouton-imprimer";

const LETTRES = ["A", "B", "C", "D"];
const pts = (p: number) => `${formaterNote(p)} pt${p > 1 ? "s" : ""}`;

/** Version papier d'un contrôle : le sujet avec le barème et des lignes pour rédiger, puis le corrigé. */
export default async function ImprimerControle({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const k = lireControle(u.id, (await params).id);
  if (!k) notFound();
  const c = k.controle;
  const total = c.questions.reduce((n, q) => n + q.points, 0);

  return (
    <main className="page-imprimee">
      <div className="non-imprime barre-impression">
        <BoutonImprimer />
        <span className="discret petit">Dans la fenêtre d&apos;impression, choisis « Enregistrer au format PDF » pour garder un PDF.</span>
      </div>
      <header className="sujet-entete">
        <h1>{c.titre}</h1>
        <p>
          {c.matiere && `${c.matiere} · `}Contrôle sur {formaterNote(total)} points{k.dureeMin ? ` · ${k.dureeMin} minutes` : ""}
        </p>
        <p className="sujet-nom">Nom : ______________________ &nbsp;&nbsp; Note : ______ / 20</p>
      </header>
      <ol className="sujet-questions">
        {c.questions.map((q, i) => (
          <li key={i}>
            <p className="sujet-enonce">
              {q.type === "trous" ? "Complète le texte." : q.type === "vrai_faux" ? "Vrai ou faux ?" : q.enonce} <span className="sujet-points">({pts(q.points)})</span>
            </p>
            {q.type === "qcm" && (
              <ul>
                {q.choix.map((ch, j) => (
                  <li key={j}>
                    <span className="case-papier" aria-hidden="true" /> {LETTRES[j]}. {ch}
                  </li>
                ))}
              </ul>
            )}
            {q.type === "vrai_faux" && (
              <p>
                {q.enonce} &nbsp; <span className="case-papier" /> Vrai &nbsp; <span className="case-papier" /> Faux
              </p>
            )}
            {q.type === "trous" && <p>{q.enonce.replace(/_{3,}/g, "________________")}</p>}
            {(q.type === "courte" || q.type === "redigee") && <div className={`lignes-ecriture lignes-${q.type}`} aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <section className="corrige">
        <h2>Corrigé et barème</h2>
        <ol>
          {c.questions.map((q, i) => (
            <li key={i}>
              <strong>({pts(q.points)}) </strong>
              {q.type === "qcm" && `${LETTRES[q.bonne_reponse]}. ${q.choix[q.bonne_reponse]}`}
              {q.type === "vrai_faux" && (q.reponse ? "Vrai" : "Faux")}
              {q.type === "trous" && q.reponses.map((r) => r.join(" / ")).join(" ; ")}
              {(q.type === "courte" || q.type === "redigee") && (
                <>
                  {q.reponse_modele}
                  <ul className="elements-papier">
                    {q.elements_attendus.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
              {"explication" in q && q.explication && <span className="discret"> — {q.explication}</span>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
