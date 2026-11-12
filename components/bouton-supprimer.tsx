"use client";

import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";

/** Petit bouton poubelle : confirme, appelle l'API (DELETE), puis rafraîchit la page. */
export function BoutonSupprimer({ api, question }: { api: string; question: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="bouton fantome"
      aria-label="Supprimer"
      title="Supprimer"
      onClick={async () => {
        if (!window.confirm(question)) return;
        await fetch(chemin(api), { method: "DELETE" }).catch(() => undefined);
        router.refresh();
      }}
    >
      <Icone nom="poubelle" />
    </button>
  );
}
