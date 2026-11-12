import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { chemin } from "@/lib/chemin";
import { listerCours, listerDossiers } from "@/lib/db";
import { formaterNote } from "@/lib/quiz";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { CouvertureDossier } from "@/components/couverture-dossier";
import { LigneCours } from "@/components/ligne-cours";
import { BoutonNouveauDossier } from "@/components/actions-dossier";

function resumeDossier(nb: number, moyenne: number | null): string {
  const cours = nb === 0 ? "vide" : `${nb} cours`;
  return moyenne === null ? cours : `${cours} · ${formaterNote(Math.round(moyenne * 40) / 2)}/20`;
}

export default async function PageMesCours() {
  const u = await exigerConnexion();
  const dossiers = listerDossiers(u.id);
  const horsDossier = listerCours(u.id, null);
  const choixDossiers = dossiers.map((d) => ({ id: d.id, nom: d.nom }));
  const toutVide = dossiers.length === 0 && horsDossier.length === 0;

  return (
    <main className="feuille">
      <Entete />
      <div className="titre-page">
        <h1>
          <span className="surligne">Mes cours</span>
        </h1>
        <div className="pastilles">
          <Link href="/mes-cours/ajouter" className="bouton principal">
            <Icone nom="plus" /> Ajouter un cours
          </Link>
          <BoutonNouveauDossier />
        </div>
      </div>

      {toutVide ? (
        <div className="vide">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="illustration-vide" src={chemin("/illustrations/etagere-vide.webp")} alt="" width={1584} height={1000} />
          <h2>Ton étagère est encore vide</h2>
          <p className="discret">Ajoute un cours (PDF, Word, photos ou texte) pour le ranger ici.</p>
          <Link href="/mes-cours/ajouter" className="bouton principal">
            <Icone nom="plus" /> Ajouter mon premier cours
          </Link>
        </div>
      ) : (
        <>
          {dossiers.length > 0 && (
            <ul className="etagere">
              {dossiers.map((d) => (
                <li key={d.id}>
                  <Link href={`/dossiers/${d.id}`} className="lien-cahier" aria-label={`Ouvrir le dossier ${d.nom}`}>
                    <CouvertureDossier nom={d.nom} couleur={d.couleur} image={d.image} sousTitre={resumeDossier(d.nbCours, d.moyenne)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {horsDossier.length > 0 && (
            <>
              <h2 style={{ marginTop: 36 }}>{dossiers.length > 0 ? "Pas encore rangés" : "Mes cours"}</h2>
              <ul className="historique">
                {horsDossier.map((c) => (
                  <LigneCours key={c.id} cours={c} dossiers={choixDossiers} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
