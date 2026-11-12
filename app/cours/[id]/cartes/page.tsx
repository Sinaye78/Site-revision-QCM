import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireCours } from "@/lib/db";
import { cartesDeLaFiche } from "@/lib/cartes";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { PaquetCartes } from "@/components/paquet-cartes";

export default async function PageCartesCours({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const { id } = await params;
  const cours = lireCours(u.id, id);
  if (!cours) notFound();
  const cartes = cours.fiche ? cartesDeLaFiche(cours.fiche) : [];

  return (
    <main className="feuille">
      <Entete />
      <Link href={`/cours/${cours.id}`} className="bouton fantome" style={{ marginBottom: 8 }}>
        <Icone nom="precedent" /> {cours.titre}
      </Link>
      <h1>
        <span className="surligne">Cartes mémoire</span>
      </h1>
      {cartes.length === 0 ? (
        <div className="vide">
          <Icone nom="cartes" taille={48} />
          <h2>Pas de cartes pour ce cours</h2>
          <p className="discret">
            {cours.fiche
              ? "La fiche de ce cours n'a ni définition, ni date, ni formule expliquée."
              : "Mets d'abord ce cours au propre avec l'IA : ses définitions et ses dates deviendront des cartes."}
          </p>
          <Link href={`/cours/${cours.id}`} className="bouton principal">
            <Icone nom="precedent" /> Revenir au cours
          </Link>
        </div>
      ) : (
        <PaquetCartes cartes={cartes} retour={{ href: `/cours/${cours.id}`, libelle: "Revenir au cours" }} />
      )}
    </main>
  );
}
