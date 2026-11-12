import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { listerDossiers } from "@/lib/db";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { FormulaireAjout } from "./formulaire-ajout";

type Props = { searchParams: Promise<{ dossier?: string }> };

export default async function PageAjouterCours({ searchParams }: Props) {
  const u = await exigerConnexion();
  const { dossier } = await searchParams;
  const dossiers = listerDossiers(u.id).map((d) => ({ id: d.id, nom: d.nom }));

  return (
    <main className="feuille">
      <Entete />
      <Link href="/mes-cours" className="bouton fantome" style={{ marginBottom: 12 }}>
        <Icone nom="precedent" /> Mes cours
      </Link>
      <h1>
        <span className="surligne">Ajouter un cours</span>
      </h1>
      <p className="discret">Ton cours sera rangé dans Mes cours. Tu pourras ensuite le mettre au propre avec l&apos;IA ou en faire un QCM.</p>
      <FormulaireAjout dossiers={dossiers} dossierParDefaut={dossiers.some((d) => d.id === dossier) ? dossier! : ""} />
    </main>
  );
}
