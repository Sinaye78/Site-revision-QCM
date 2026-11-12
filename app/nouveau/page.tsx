import { exigerConnexion } from "@/lib/auth";
import { listerCours, listerDossiers } from "@/lib/db";
import { iaLitLesImages } from "@/lib/ia";
import { Entete } from "@/components/entete";
import { FormulaireCours } from "./formulaire-cours";

type Props = { searchParams: Promise<{ dossier?: string; cours?: string }> };

export default async function PageNouveau({ searchParams }: Props) {
  const u = await exigerConnexion();
  const { dossier, cours } = await searchParams;
  const dossiers = listerDossiers(u.id);
  const nomsDossiers = new Map(dossiers.map((d) => [d.id, d.nom]));
  const listeCours = listerCours(u.id).map((c) => ({
    id: c.id,
    titre: c.titre,
    detail: [c.matiere, c.dossierId ? nomsDossiers.get(c.dossierId) : ""].filter(Boolean).join(" · "),
    photos: c.nbPhotos > 0,
    nbQcm: c.nbQcm,
  }));

  return (
    <main className="feuille">
      <Entete />
      <h1>
        <span className="surligne">Nouveau QCM</span>
      </h1>
      <p className="discret">Choisis un cours, l&apos;IA prépare les questions.</p>
      <FormulaireCours
        cours={listeCours}
        coursParDefaut={listeCours.some((c) => c.id === cours) ? cours! : ""}
        dossiers={dossiers.map((d) => ({ id: d.id, nom: d.nom }))}
        dossierParDefaut={nomsDossiers.has(dossier ?? "") ? dossier! : ""}
        lecturePhotos={{ local: iaLitLesImages("local"), rapide: iaLitLesImages("rapide") }}
      />
    </main>
  );
}
