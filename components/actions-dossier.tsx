"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { Dialogue } from "./dialogue";
import { FormulaireDossier } from "./formulaire-dossier";

/** Bouton « Nouveau dossier » de la page Mes cours. */
export function BoutonNouveauDossier() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className="bouton" onClick={() => setOuvert(true)}>
        <Icone nom="dossier" /> Nouveau dossier
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Nouveau dossier">
        <FormulaireDossier onFini={() => setOuvert(false)} />
      </Dialogue>
    </>
  );
}

/** Boutons Modifier / Supprimer d'un dossier ouvert. */
export function ActionsDossier({ dossier }: { dossier: { id: string; nom: string; couleur: string; image: string | null } }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);

  async function supprimer() {
    if (!window.confirm(`Supprimer le dossier « ${dossier.nom} » ? Les QCM qu'il contient ne seront pas effacés, ils seront juste sortis du dossier.`)) return;
    await fetch(chemin(`/api/dossiers/${dossier.id}`), { method: "DELETE" }).catch(() => undefined);
    router.push("/mes-cours");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="bouton" onClick={() => setOuvert(true)}>
        <Icone nom="renommer" /> Modifier
      </button>
      <button type="button" className="bouton fantome" onClick={supprimer} aria-label="Supprimer le dossier" title="Supprimer le dossier">
        <Icone nom="poubelle" />
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Modifier le dossier">
        <FormulaireDossier dossier={dossier} onFini={() => setOuvert(false)} />
      </Dialogue>
    </>
  );
}
