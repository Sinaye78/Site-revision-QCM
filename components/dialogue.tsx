"use client";

import { useEffect, useRef } from "react";
import { Icone } from "./icones";

/** Fenêtre par-dessus la page, en forme de fiche bristol. */
export function Dialogue({
  ouvert,
  onFermer,
  titre,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) {
      d.showModal();
      // showModal met le focus sur la croix : on le place plutôt sur le premier champ.
      d.querySelector<HTMLElement>(".dialogue-contenu input:not([type=file]):not([type=radio]), .dialogue-contenu textarea")?.focus();
    }
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <dialog
      ref={ref}
      className="dialogue"
      onClose={onFermer}
      onClick={(e) => {
        if (e.target === ref.current) onFermer();
      }}
    >
      <div className="dialogue-contenu">
        <div className="dialogue-titre">
          <h2>{titre}</h2>
          <button type="button" className="bouton fantome" onClick={onFermer} aria-label="Fermer">
            <Icone nom="croix" />
          </button>
        </div>
        {ouvert && children}
      </div>
    </dialog>
  );
}
