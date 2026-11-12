import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { correctionDeLaCopie, lireCopie } from "@/lib/controles-db";
import { morceauxTrous, type CorrectionQuestion, type QuestionControle, type Reponse } from "@/lib/controle";
import { appreciation, formaterNote } from "@/lib/quiz";
import { chemin } from "@/lib/chemin";
import { Entete } from "@/components/entete";
import { Icone, Soulignement } from "@/components/icones";
import { Confettis } from "@/components/confettis";
import { AttenteCorrection } from "@/components/attente-correction";

export const dynamic = "force-dynamic";
const LETTRES = ["A", "B", "C", "D"];

function minutes(s: number): string {
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}

/** La réponse de l'élève, annotée au stylo comme une copie rendue. */
function ReponseCorrigee({ q, r, c }: { q: QuestionControle; r: Reponse; c: CorrectionQuestion }) {
  switch (q.type) {
    case "qcm":
      return (
        <ul className="choix-corriges">
          {q.choix.map((ch, k) => (
            <li key={k} className={k === q.bonne_reponse ? "bonne" : k === r ? "fausse" : ""}>
              <span className="lettre-petite">{LETTRES[k]}</span> {ch}
              {k === r && <span className="discret petit"> ← ta réponse</span>}
            </li>
          ))}
        </ul>
      );
    case "vrai_faux":
      return (
        <p className="petit">
          Ta réponse : <strong>{r === null ? "rien" : r ? "Vrai" : "Faux"}</strong> · La bonne : <span className="surligne">{q.reponse ? "Vrai" : "Faux"}</span>
        </p>
      );
    case "trous": {
      const mots = Array.isArray(r) ? r : [];
      return (
        <p className="texte-trous">
          {morceauxTrous(q.enonce).map((m, k, tout) => (
            <span key={k}>
              {m}
              {k < tout.length - 1 &&
                (c.trous_justes?.[k] ? (
                  <span className="trou-juste">{mots[k]}</span>
                ) : (
                  <>
                    {mots[k]?.trim() && <span className="trou-faux">{mots[k]}</span>} <span className="trou-correction">{q.reponses[k][0]}</span>
                  </>
                ))}
            </span>
          ))}
        </p>
      );
    }
    default:
      return (
        <>
          <div className="reponse-eleve">{typeof r === "string" && r.trim() ? r : <span className="discret">Pas de réponse.</span>}</div>
          {c.par !== "attente" && (
            <ul className="elements-attendus">
              {q.elements_attendus.map((e, k) => {
                const ok = c.elements_trouves?.includes(k);
                return (
                  <li key={k} className={ok ? "trouve" : "manque"}>
                    <Icone nom={ok ? "coche" : "croix"} taille={16} /> {e}
                  </li>
                );
              })}
            </ul>
          )}
          <details className="recap-details">
            <summary className="petit">Réponse modèle</summary>
            <p className="petit">{q.reponse_modele}</p>
          </details>
        </>
      );
  }
}

export default async function PageCopie({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const lu = lireCopie(u.id, (await params).id);
  if (!lu) notFound();
  const { copie, controle: k } = lu;
  const corrigee = copie.statut === "corrigee";
  const tache = corrigee ? null : correctionDeLaCopie(u.id, copie.id);
  const echec = corrigee ? null : !tache ? "La correction n'a pas pu être lancée (limite du jour atteinte, ou cours supprimé)." : tache.statut === "erreur" ? tache.erreur ?? "L'IA n'a pas répondu." : null;
  const note = copie.note;
  const { tampon } = appreciation(note ?? 0);
  const totalMax = copie.correction.questions.reduce((n, q) => n + q.max, 0);
  const obtenus = copie.correction.questions.reduce((n, q) => n + q.points, 0);

  return (
    <main className="feuille">
      <Entete />
      <Link href={`/controles/${k.id}`} className="bouton fantome" style={{ marginBottom: 8 }}>
        <Icone nom="precedent" /> {k.controle.titre}
      </Link>
      <h1>
        <span className="surligne">{k.controle.titre}</span>
      </h1>
      <p className="discret">Copie rendue{copie.dureeS !== null ? ` en ${minutes(copie.dureeS)}` : ""}</p>

      {corrigee && note !== null ? (
        <div className="copie">
          {note >= 16 && <Confettis />}
          {note >= 16 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="illustration-note bravo" src={chemin("/illustrations/bravo.webp")} alt="" width={1254} height={1254} />
          )}
          {note < 10 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="illustration-note encourage" src={chemin("/illustrations/recommencer.webp")} alt="" width={1254} height={1254} />
          )}
          <span className={`tampon${note >= 12 ? " vert" : ""}`}>{tampon}</span>
          <div className="note">
            {formaterNote(note)}
            <small>/20</small>
            <Soulignement />
          </div>
          <p className="commentaire">{copie.correction.appreciation}</p>
          <p className="discret">
            {formaterNote(obtenus)} points sur {formaterNote(totalMax)}
          </p>
        </div>
      ) : (
        <AttenteCorrection copieId={copie.id} echec={echec} />
      )}

      <div className="actions" style={{ justifyContent: "center" }}>
        <Link href={`/controles/${k.id}`} className="bouton principal">
          <Icone nom="recommencer" /> Refaire ce contrôle
        </Link>
        {k.coursId && (
          <Link href={`/controles/nouveau?cours=${k.coursId}`} className="bouton">
            <Icone nom="plus" /> Nouveau contrôle sur ce cours
          </Link>
        )}
      </div>

      <h2 style={{ marginTop: 36 }}>Correction</h2>
      <ol className="questions-controle copie-corrigee">
        {k.controle.questions.map((q, i) => {
          const c = copie.correction.questions[i];
          const r = copie.reponses[i] ?? null;
          return (
            <li key={i} className="question-controle">
              <span className={`bareme note-marge${c.par === "attente" ? " discret" : c.points === c.max ? " plein" : c.points === 0 ? " zero" : ""}`}>
                {c.par === "attente" ? "…" : formaterNote(c.points)}/{formaterNote(c.max)}
              </span>
              {q.type !== "trous" && <p className="enonce-controle">{q.enonce}</p>}
              <ReponseCorrigee q={q} r={r} c={c} />
              {c.par !== "attente" && c.commentaire && <p className="annotation">{c.commentaire}</p>}
              {"explication" in q && q.explication && c.points < c.max && <p className="discret petit">{q.explication}</p>}
              {c.par === "ia" && <span className="corrige-par discret">corrigé par l&apos;IA</span>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
