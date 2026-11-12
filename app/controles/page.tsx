import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { listerControles, listerCopies } from "@/lib/controles-db";
import { formaterNote } from "@/lib/quiz";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { OngletsEntrainement } from "@/components/onglets-entrainement";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default async function PageControles() {
  const u = await exigerConnexion();
  const controles = listerControles(u.id);

  return (
    <main className="feuille">
      <Entete />
      <div className="titre-page">
        <h1>
          <span className="surligne">Mes contrôles</span>
        </h1>
        <Link href="/controles/nouveau" className="bouton principal">
          <Icone nom="plus" /> Nouveau contrôle
        </Link>
      </div>
      <OngletsEntrainement actif="controles" />

      {controles.length === 0 ? (
        <div className="vide">
          <Icone nom="crayon" taille={48} />
          <h2>Pas encore de contrôle</h2>
          <p className="discret">Un vrai contrôle sur 20, avec des questions à rédiger corrigées par l&apos;IA. Idéal la veille d&apos;une évaluation.</p>
          <Link href="/controles/nouveau" className="bouton principal">
            <Icone nom="crayon" /> Préparer mon premier contrôle
          </Link>
        </div>
      ) : (
        <ul className="historique">
          {controles.map((k) => {
            const derniere = k.nbCopies ? listerCopies(u.id, k.id)[0] : null;
            return (
              <li key={k.id} className="carte ligne-qcm">
                <div className="infos">
                  <Link href={`/controles/${k.id}`} className="titre-qcm">
                    {k.titre}
                  </Link>
                  <div className="petit discret" style={{ marginTop: 4 }}>
                    {k.matiere && <span className="etiquette">{k.matiere}</span>}
                    <span className={`etiquette diff-${k.difficulte}`}>{k.difficulte}</span>
                    {k.nbQuestions} questions · {k.dureeMin ? `${k.dureeMin} min` : "durée libre"} · {dateCourte.format(k.creeLe)}
                  </div>
                  {k.coursId && (
                    <Link href={`/cours/${k.coursId}`} className="lien-cours petit">
                      <Icone nom="fichier" taille={16} /> {k.coursTitre}
                    </Link>
                  )}
                </div>
                <div className="mini-note" title="Meilleure note">
                  {k.meilleure !== null ? `${formaterNote(k.meilleure)}/20` : <span className="discret petit">{k.enCorrection ? "en correction" : "pas fait"}</span>}
                </div>
                <div className="outils-qcm">
                  {derniere && (
                    <Link href={`/copies/${derniere.id}`} className="bouton fantome" title="Ma dernière copie">
                      <Icone nom="fichier" /> Copie
                    </Link>
                  )}
                  <Link href={`/controles/${k.id}`} className="bouton">
                    <Icone nom={k.nbCopies ? "recommencer" : "suivant"} /> {k.nbCopies ? "Refaire" : "Commencer"}
                  </Link>
                  <BoutonSupprimer api={`/api/controles/${k.id}`} question={`Supprimer le contrôle « ${k.titre} » et ses copies ?`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
