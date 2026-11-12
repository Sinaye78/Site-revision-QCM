import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { Joueur } from "@/components/joueur";
import { melanger } from "@/lib/quiz";
import { prochainJourDeRevision, questionsARevoir } from "@/lib/revision";
import { formaterJour } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Séance de répétition espacée : les questions dont c'est le jour, tous QCM confondus. */
export default async function PageReviser() {
  const u = await exigerConnexion();
  const aRevoir = melanger(questionsARevoir(u.id, 20));
  const prochain = aRevoir.length === 0 ? prochainJourDeRevision(u.id) : null;

  return (
    <main className="feuille">
      <Entete />
      {aRevoir.length === 0 ? (
        <div className="vide">
          <Icone nom="coche" taille={48} />
          <h1>
            <span className="surligne">Rien à réviser aujourd&apos;hui</span>
          </h1>
          <p className="discret">
            {prochain
              ? `Tes prochaines questions reviendront ${formaterJour(prochain)}.`
              : "Fais un QCM : les questions reviendront ici au bon moment pour que tu les retiennes."}
          </p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <Link href="/cartes" className="bouton">
              <Icone nom="cartes" /> Cartes mémoire
            </Link>
            <Link href="/nouveau" className="bouton principal">
              <Icone nom="crayon" /> Nouveau QCM
            </Link>
          </div>
        </div>
      ) : (
        <Joueur
          type="revision"
          titre="Révisions"
          items={aRevoir.map((r) => ({ quizId: r.quizId, index: r.index, question: r.question, source: r.quizTitre, coursId: r.coursId, perm: melanger([0, 1, 2, 3]) }))}
        />
      )}
    </main>
  );
}
