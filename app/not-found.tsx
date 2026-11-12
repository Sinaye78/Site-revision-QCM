import Link from "next/link";
import { Icone } from "@/components/icones";

export default function Introuvable() {
  return (
    <main className="feuille">
      <div className="vide">
        <Icone nom="croix" taille={48} />
        <h1>Page introuvable</h1>
        <p className="discret">Cette page a peut-être été effacée.</p>
        <Link href="/nouveau" className="bouton principal">
          <Icone nom="suivant" /> Retour
        </Link>
      </div>
    </main>
  );
}
