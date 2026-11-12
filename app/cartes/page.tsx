import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { fichesDuCompte } from "@/lib/db";
import { cartesDeLaFiche } from "@/lib/cartes";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { PaquetCartes } from "@/components/paquet-cartes";

type Props = { searchParams: Promise<{ tout?: string }> };

/** Les cartes mémoire de tous les cours mis au propre : un paquet par cours, ou tout mélangé. */
export default async function PageCartes({ searchParams }: Props) {
  const u = await exigerConnexion();
  const { tout } = await searchParams;
  const paquets = fichesDuCompte(u.id)
    .map((c) => ({ ...c, cartes: cartesDeLaFiche(c.fiche) }))
    .filter((c) => c.cartes.length > 0);

  if (tout === "1" && paquets.length > 0) {
    const cartes = paquets.flatMap((p) => p.cartes.map((c) => ({ ...c, cours: p.titre })));
    return (
      <main className="feuille">
        <Entete />
        <h1>
          <span className="surligne">Toutes mes cartes</span>
        </h1>
        <PaquetCartes cartes={cartes} retour={{ href: "/cartes", libelle: "Mes cartes" }} />
      </main>
    );
  }

  const total = paquets.reduce((n, p) => n + p.cartes.length, 0);
  return (
    <main className="feuille">
      <Entete />
      <div className="titre-page">
        <h1>
          <span className="surligne">Cartes mémoire</span>
        </h1>
        {paquets.length > 1 && (
          <Link href="/cartes?tout=1" className="bouton principal">
            <Icone nom="cartes" /> Tout réviser ({total})
          </Link>
        )}
      </div>
      <p className="discret">Les définitions, dates et formules de tes fiches, à apprendre recto verso. Elles ne consomment aucun quota d&apos;IA.</p>
      {paquets.length === 0 ? (
        <div className="vide">
          <Icone nom="cartes" taille={48} />
          <h2>Pas encore de cartes</h2>
          <p className="discret">Ouvre un cours et clique sur « Mettre au propre avec l&apos;IA » : ses définitions et ses dates deviendront des cartes.</p>
          <Link href="/mes-cours" className="bouton principal">
            <Icone nom="cahier" /> Mes cours
          </Link>
        </div>
      ) : (
        <ul className="historique">
          {paquets.map((p) => (
            <li key={p.id} className="carte ligne-qcm">
              <div className="infos">
                <Link href={`/cours/${p.id}/cartes`} className="titre-qcm">
                  {p.titre}
                </Link>
                <div className="petit discret" style={{ marginTop: 4 }}>
                  {p.matiere && <span className="etiquette">{p.matiere}</span>}
                  {p.cartes.length} carte{p.cartes.length > 1 ? "s" : ""}
                </div>
              </div>
              <Link href={`/cours/${p.id}/cartes`} className="bouton">
                <Icone nom="suivant" /> Réviser
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
