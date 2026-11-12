"use client";

import { useEffect, useState } from "react";
import { Icone } from "./icones";

const TAILLES = ["petite", "normale", "grande", "tres-grande"] as const;
type Taille = (typeof TAILLES)[number];
type Police = "lisible" | "manuscrite";

function garder(cle: string, valeur: string) {
  document.documentElement.dataset[cle] = valeur;
  try {
    localStorage.setItem(cle, valeur);
  } catch {}
}

/** Réglages de lecture d'un cours : police plus lisible et taille du texte. */
export function ReglagesLecture() {
  const [police, setPolice] = useState<Police>("lisible");
  const [taille, setTaille] = useState<Taille>("normale");

  useEffect(() => {
    const d = document.documentElement.dataset;
    if (d.police === "manuscrite") setPolice("manuscrite");
    if (TAILLES.includes(d.taille as Taille)) setTaille(d.taille as Taille);
  }, []);

  function changerTaille(sens: 1 | -1) {
    const i = Math.min(TAILLES.length - 1, Math.max(0, TAILLES.indexOf(taille) + sens));
    setTaille(TAILLES[i]);
    garder("taille", TAILLES[i]);
  }

  function changerPolice() {
    const suivante: Police = police === "lisible" ? "manuscrite" : "lisible";
    setPolice(suivante);
    garder("police", suivante);
  }

  return (
    <div className="reglages-lecture" role="group" aria-label="Réglages de lecture">
      <button
        type="button"
        className="bouton fantome"
        onClick={changerPolice}
        aria-pressed={police === "manuscrite"}
        title={police === "lisible" ? "Écriture du cahier" : "Police plus lisible"}
      >
        <Icone nom="lettres" taille={20} /> {police === "lisible" ? "Écriture cahier" : "Police lisible"}
      </button>
      <button type="button" className="bouton fantome" onClick={() => changerTaille(-1)} disabled={taille === TAILLES[0]} aria-label="Texte plus petit" title="Texte plus petit">
        A−
      </button>
      <button
        type="button"
        className="bouton fantome"
        onClick={() => changerTaille(1)}
        disabled={taille === TAILLES[TAILLES.length - 1]}
        aria-label="Texte plus grand"
        title="Texte plus grand"
      >
        A+
      </button>
    </div>
  );
}
