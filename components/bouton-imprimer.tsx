"use client";

import { Icone } from "./icones";

export function BoutonImprimer({ libelle = "Imprimer ou enregistrer en PDF" }: { libelle?: string }) {
  return (
    <button type="button" className="bouton principal" onClick={() => window.print()}>
      <Icone nom="imprimer" /> {libelle}
    </button>
  );
}
