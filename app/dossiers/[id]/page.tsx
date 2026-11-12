import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireDossier, listerCours, listerDossiers } from "@/lib/db";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { CouvertureDossier } from "@/components/couverture-dossier";
import { LigneCours } from "@/components/ligne-cours";
import { ActionsDossier } from "@/components/actions-dossier";

export default async function PageDossier({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const { id } = await params;
  const dossier = lireDossier(u.id, id);
  if (!dossier) notFound();
  const cours = listerCours(u.id, id);
  const choixDossiers = listerDossiers(u.id).map((d) => ({ id: d.id, nom: d.nom }));

  return (
    <main className="feuille">
      <Entete />
      <Link href="/mes-cours" className="bouton fantome" style={{ marginBottom: 12 }}>
        <Icone nom="precedent" /> Mes cours
      </Link>

      <div className="tete-dossier">
        <CouvertureDossier nom={dossier.nom} couleur={dossier.couleur} image={dossier.image} grande />
        <div className="tete-dossier-infos">
          <h1>
            <span className="surligne">{dossier.nom}</span>
          </h1>
          <p className="discret">{cours.length === 0 ? "Aucun cours pour l'instant." : `${cours.length} cours dans ce dossier.`}</p>
          <div className="pastilles">
            <Link href={`/mes-cours/ajouter?dossier=${dossier.id}`} className="bouton principal">
              <Icone nom="plus" /> Ajouter un cours ici
            </Link>
            <ActionsDossier dossier={{ id: dossier.id, nom: dossier.nom, couleur: dossier.couleur, image: dossier.image }} />
          </div>
        </div>
      </div>

      {cours.length > 0 && (
        <ul className="historique" style={{ marginTop: 30 }}>
          {cours.map((c) => (
            <LigneCours key={c.id} cours={c} dossiers={choixDossiers} />
          ))}
        </ul>
      )}
    </main>
  );
}
