import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { listerQuiz } from "@/lib/db";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { LigneQcm } from "@/components/ligne-qcm";
import { OngletsEntrainement } from "@/components/onglets-entrainement";

export default async function PageMesQcm() {
  const u = await exigerConnexion();
  const qcms = listerQuiz(u.id);

  return (
    <main className="feuille">
      <Entete />
      <div className="titre-page">
        <h1>
          <span className="surligne">Mes QCM</span>
        </h1>
        <Link href="/nouveau" className="bouton principal">
          <Icone nom="plus" /> Nouveau QCM
        </Link>
      </div>
      <OngletsEntrainement actif="qcm" />

      {qcms.length === 0 ? (
        <div className="vide">
          <Icone nom="qcm" taille={48} />
          <h2>Pas encore de QCM</h2>
          <p className="discret">Choisis un cours et l&apos;IA te prépare des questions.</p>
          <Link href="/nouveau" className="bouton principal">
            <Icone nom="crayon" /> Créer mon premier QCM
          </Link>
        </div>
      ) : (
        <ul className="historique">
          {qcms.map((q) => (
            <LigneQcm key={q.id} qcm={q} />
          ))}
        </ul>
      )}
    </main>
  );
}
