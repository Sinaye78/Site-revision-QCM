"use client";

import { useEffect, useState } from "react";
import { Icone } from "./icones";

type Theme = "clair" | "sombre";

/** Lune / soleil : passe le site en mode nuit (choix gardé sur ce navigateur). */
export function BoutonTheme({ avecTexte = false, className = "" }: { avecTexte?: boolean; className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "sombre" ? "sombre" : "clair");
  }, []);

  function basculer() {
    const suivant: Theme = theme === "sombre" ? "clair" : "sombre";
    document.documentElement.dataset.theme = suivant;
    try {
      localStorage.setItem("theme", suivant);
    } catch {}
    setTheme(suivant);
  }

  const nuit = theme === "sombre";
  return (
    <button
      type="button"
      className={`${avecTexte ? "menu-lien" : "bouton fantome"} ${className}`.trim()}
      onClick={basculer}
      aria-label={nuit ? "Passer en mode jour" : "Passer en mode nuit"}
      title={nuit ? "Mode jour" : "Mode nuit"}
      // Avant de connaître le thème (premier affichage), le bouton reste à sa place mais invisible.
      style={theme === null ? { visibility: "hidden" } : undefined}
    >
      <Icone nom={nuit ? "soleil" : "lune"} taille={avecTexte ? 20 : 24} />
      {avecTexte && (nuit ? " Mode jour" : " Mode nuit")}
    </button>
  );
}
