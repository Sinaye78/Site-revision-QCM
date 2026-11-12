"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { messageErreur } from "./attente-ia";
import { Dialogue } from "./dialogue";
import { ChoixModeIA, type LecturePhotos } from "./choix-mode-ia";
import type { ModeIA } from "@/lib/taches-types";

/** « Mettre au propre avec l'IA » : demande la fiche, puis recharge la page pour l'afficher. */
export function BoutonFiche({ coursId, dejaFaite, tacheId, photos, lecturePhotos }: { coursId: string; dejaFaite: boolean; tacheId?: string; photos?: boolean; lecturePhotos?: LecturePhotos }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<ModeIA>("local");

  async function lancer() {
    setErreur("");
    setEnCours(true);
    setOuvert(false);
    const rep = await fetch(chemin(`/api/cours/${coursId}/fiche`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) }).catch(() => null);
    if (rep?.status === 401) return router.replace("/");
    const json = rep ? ((await rep.json().catch(() => ({}))) as { tacheId?: string; erreur?: string; code?: string }) : {};
    if (!rep?.ok || !json.tacheId) {
      setErreur(messageErreur(json, "La mise au propre n'a pas marché. Réessaie."));
      setEnCours(false);
      return;
    }
    router.push(`/traitements/${json.tacheId}`);
    setEnCours(false);
  }

  if (tacheId) return <Link href={`/traitements/${tacheId}`} className="bouton principal">Suivre la mise au propre</Link>;
  if (enCours) {
    return (
      <div className="attente-fiche">
        <p role="status">Enregistrement de ta demande…</p>
      </div>
    );
  }

  return (
    <>
      <button type="button" className={dejaFaite ? "bouton fantome" : "bouton principal"} onClick={() => setOuvert(true)}>
        <Icone nom={dejaFaite ? "recommencer" : "baguette"} /> {dejaFaite ? "Refaire la fiche" : "Mettre au propre avec l'IA"}
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre={dejaFaite ? "Refaire la fiche" : "Préparer ma fiche"}>
        {dejaFaite && <p>La fiche actuelle sera remplacée quand la nouvelle sera prête.</p>}
        <ChoixModeIA valeur={mode} onChange={setMode} photos={photos} lecturePhotos={lecturePhotos} />
        <button type="button" className="bouton principal" onClick={lancer}>Générer ma fiche</button>
      </Dialogue>
      {erreur && (
        <p className="erreur" role="alert" style={{ flexBasis: "100%" }}>
          <Icone nom="croix" /> {erreur}
        </p>
      )}
    </>
  );
}
