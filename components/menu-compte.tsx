"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Petit menu déroulant de l'en-tête (« Plus ») : se ferme au clic dehors, avec Échap ou en changeant de page. */
export function MenuCompte({ resume, children, classe = "" }: { resume: React.ReactNode; children: React.ReactNode; classe?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const page = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [page]);

  useEffect(() => {
    function dehors(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    function echap(e: KeyboardEvent) {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("click", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("click", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, []);

  return (
    <details ref={ref} className={`menu-compte ${classe}`.trim()}>
      <summary className="bouton fantome" aria-label={classe ? undefined : "Plus d'options"}>
        {resume}
      </summary>
      <div className="menu-compte-contenu">{children}</div>
    </details>
  );
}
