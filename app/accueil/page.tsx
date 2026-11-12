import Link from "next/link";
import { estInvite, exigerConnexion } from "@/lib/auth";
import { fichesDuCompte, listerCours, listerQuiz, moyennesParMatiere } from "@/lib/db";
import { bilanMemoire, compterARevoir, prochainJourDeRevision, serieDeJours } from "@/lib/revision";
import { cartesDeLaFiche } from "@/lib/cartes";
import { formaterNote } from "@/lib/quiz";
import { formaterJour } from "@/lib/dates";
import { chemin } from "@/lib/chemin";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";

export const dynamic = "force-dynamic";

const sur20 = (part: number) => formaterNote(Math.round(part * 40) / 2);

/** Tableau de bord : ce qu'il y a à réviser aujourd'hui, la série de jours, les derniers cours et QCM. */
export default async function PageAccueil() {
  const u = await exigerConnexion();
  const aRevoir = compterARevoir(u.id);
  const serie = serieDeJours(u.id);
  const memoire = bilanMemoire(u.id);
  const prochain = aRevoir === 0 ? prochainJourDeRevision(u.id) : null;
  const cours = listerCours(u.id);
  const qcms = listerQuiz(u.id);
  const matieres = moyennesParMatiere(u.id);
  const nbCartes = fichesDuCompte(u.id).reduce((n, c) => n + cartesDeLaFiche(c.fiche).length, 0);
  const prenom = estInvite(u) ? "" : u.nom.split(" ")[0];
  const debutant = cours.length === 0 && qcms.length === 0;

  return (
    <main className="feuille">
      <Entete />
      <h1>
        {prenom ? (
          <>
            Salut <span className="surligne">{prenom}</span> !
          </>
        ) : (
          <span className="surligne">Mon bureau</span>
        )}
      </h1>

      {debutant ? (
        <div className="carte accueil-debut">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="illustration-vide" src={chemin("/illustrations/etagere-vide.webp")} alt="" width={600} height={400} />
          <h2>On commence ?</h2>
          <p className="discret">Envoie un cours (PDF, Word, photos du cahier ou texte) : l&apos;IA en fait un QCM et une fiche propre.</p>
          <ol className="etapes-debut">
            <li>Envoie ton cours</li>
            <li>Fais le QCM</li>
            <li>Reviens chaque jour réviser tes erreurs</li>
          </ol>
          <Link href="/nouveau" className="bouton principal">
            <Icone nom="crayon" /> Créer mon premier QCM
          </Link>
        </div>
      ) : (
        <>
          <div className="postit accueil-reviser">
            {aRevoir > 0 ? (
              <>
                <div className="titre-postit">
                  <Icone nom="recommencer" /> {aRevoir} question{aRevoir > 1 ? "s" : ""} à revoir aujourd&apos;hui
                </div>
                <p style={{ margin: "0 0 12px" }}>
                  Les questions ratées reviennent le lendemain, les réussies de plus en plus tard : c&apos;est comme ça qu&apos;on retient pour de bon.
                </p>
                <Link href="/reviser" className="bouton principal">
                  <Icone nom="suivant" /> Réviser maintenant{aRevoir > 1 ? ` (~${Math.max(1, Math.round(Math.min(aRevoir, 20) * 0.4))} min)` : ""}
                </Link>
              </>
            ) : (
              <>
                <div className="titre-postit">
                  <Icone nom="coche" /> Rien à réviser aujourd&apos;hui
                </div>
                <p style={{ margin: 0 }}>
                  {prochain ? `Tes prochaines questions reviendront ${formaterJour(prochain)}.` : "Fais un QCM : ses questions reviendront ici au bon moment."}
                </p>
              </>
            )}
          </div>

          <div className="tuiles">
            <div className="carte tuile">
              <Icone nom="flamme" taille={30} />
              <span className="tuile-valeur">{serie}</span>
              <span className="tuile-libelle">jour{serie > 1 ? "s" : ""} d&apos;affilée</span>
            </div>
            <div className="carte tuile">
              <Icone nom="ampoule" taille={30} />
              <span className="tuile-valeur">
                {memoire.acquises}
                <small>/{memoire.vues}</small>
              </span>
              <span className="tuile-libelle">questions bien retenues</span>
            </div>
            <Link href="/cartes" className="carte tuile tuile-lien">
              <Icone nom="cartes" taille={30} />
              <span className="tuile-valeur">{nbCartes}</span>
              <span className="tuile-libelle">cartes mémoire</span>
            </Link>
          </div>

          <div className="accueil-colonnes">
            <section>
              <div className="titre-section">
                <h2>Derniers cours</h2>
                <Link href="/mes-cours" className="petit">
                  Tout voir
                </Link>
              </div>
              {cours.length === 0 ? (
                <p className="discret">Pas encore de cours.</p>
              ) : (
                <ul className="liste-courte">
                  {cours.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <Link href={`/cours/${c.id}`}>
                        <Icone nom="fichier" taille={20} />
                        <span className="liste-courte-titre">{c.titre}</span>
                        {c.matiere && <span className="etiquette">{c.matiere}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <div className="titre-section">
                <h2>Derniers QCM</h2>
                <Link href="/mes-qcm" className="petit">
                  Tout voir
                </Link>
              </div>
              {qcms.length === 0 ? (
                <p className="discret">Pas encore de QCM.</p>
              ) : (
                <ul className="liste-courte">
                  {qcms.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <Link href={`/qcm/${q.id}`}>
                        <Icone nom="qcm" taille={20} />
                        <span className="liste-courte-titre">{q.titre}</span>
                        <span className="mini-note petite-note">{q.meilleur === null ? <span className="discret petit">à faire</span> : `${sur20(q.meilleur)}/20`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {matieres.length > 0 && (
            <section style={{ marginTop: 30 }}>
              <h2>Mes matières</h2>
              <ul className="matieres">
                {matieres.map((m) => (
                  <li key={m.matiere}>
                    <span className="matiere-nom">{m.matiere}</span>
                    <span className="matiere-jauge" aria-hidden="true">
                      <span style={{ width: `${Math.round(m.moyenne * 100)}%` }} className={m.moyenne >= 0.6 ? "bon" : m.moyenne >= 0.5 ? "moyen" : "faible"} />
                    </span>
                    <span className="matiere-note">
                      {sur20(m.moyenne)}/20 <span className="discret petit">· {m.nbQcm} QCM</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="discret petit">Moyenne de tes meilleures notes à chaque QCM.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
