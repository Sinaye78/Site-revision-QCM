"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";

/**
 * Pendant que l'IA corrige : la page se met à jour toute seule. Si la
 * correction a échoué (ou n'a pas pu partir), l'élève peut la relancer ou
 * corriger tout de suite sans IA (par les mots-clés attendus).
 */
export function AttenteCorrection({ copieId, echec }: { copieId: string; echec: string | null }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (echec) return;
    let arret = false;
    let minuterie: ReturnType<typeof setTimeout>;
    async function verifier() {
      const rep = await fetch(chemin(`/api/copies/${copieId}`), { cache: "no-store" }).catch(() => null);
      const json = rep?.ok ? ((await rep.json()) as { statut: string }) : null;
      if (json?.statut === "corrigee") return router.refresh();
      if (!arret) minuterie = setTimeout(verifier, 3000);
    }
    minuterie = setTimeout(verifier, 3000);
    return () => {
      arret = true;
      clearTimeout(minuterie);
    };
  }, [copieId, echec, router]);

  async function agir(action: "relancer" | "sans-ia") {
    setEnvoi(true);
    setErreur("");
    const rep = await fetch(chemin(`/api/copies/${copieId}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mode: "rapide" }),
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => ({}))) as { erreur?: string }) : {};
    setEnvoi(false);
    if (!rep?.ok) return setErreur(json.erreur ?? "Ça n'a pas marché. Réessaie.");
    router.refresh();
  }

  return (
    <div className="postit attente-correction" role="status">
      {echec ? (
        <>
          <div className="titre-postit">
            <Icone nom="croix" /> La correction n&apos;a pas pu se faire
          </div>
          <p style={{ margin: "0 0 10px" }}>{echec}</p>
          <div className="pastilles">
            <button type="button" className="bouton principal" disabled={envoi} onClick={() => void agir("relancer")}>
              <Icone nom="recommencer" /> Relancer la correction
            </button>
            <button type="button" className="bouton" disabled={envoi} onClick={() => void agir("sans-ia")} title="Compte les idées attendues présentes dans ta réponse">
              Corriger sans IA
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="titre-postit">
            <span className="point-en-cours" aria-hidden="true" /> L&apos;IA corrige tes réponses rédigées…
          </div>
          <p style={{ margin: 0 }}>Les questions fermées sont déjà corrigées ci-dessous. La note finale apparaîtra ici dès que l&apos;IA aura fini.</p>
          <button type="button" className="lien-bouton petit" style={{ marginTop: 8 }} disabled={envoi} onClick={() => void agir("sans-ia")}>
            Trop long ? Corriger sans IA
          </button>
        </>
      )}
      {erreur && <p className="erreur petit">{erreur}</p>}
    </div>
  );
}
