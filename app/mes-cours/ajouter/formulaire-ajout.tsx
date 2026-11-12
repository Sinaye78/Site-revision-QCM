"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "@/components/icones";
import { ENVOI_VIDE, ZoneDepot, remplirEnvoi, verifierEnvoi, type EnvoiCours } from "@/components/zone-depot";

export function FormulaireAjout({ dossiers, dossierParDefaut }: { dossiers: { id: string; nom: string }[]; dossierParDefaut: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState<EnvoiCours>(ENVOI_VIDE);
  const [titre, setTitre] = useState("");
  const [dossier, setDossier] = useState(dossierParDefaut);
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function ranger() {
    const probleme = verifierEnvoi(envoi);
    if (probleme) return setErreur(probleme);
    const form = new FormData();
    remplirEnvoi(form, envoi);
    form.append("titre", titre.trim());
    form.append("dossier", dossier);

    setErreur("");
    setEnvoiEnCours(true);
    const rep = await fetch(chemin("/api/cours"), { method: "POST", body: form }).catch(() => null);
    if (rep?.status === 401) return router.replace("/");
    const json = rep ? ((await rep.json().catch(() => ({}))) as { id?: string; erreur?: string }) : {};
    if (!rep?.ok || !json.id) {
      setErreur(json.erreur ?? "Le cours n'a pas pu être rangé. Réessaie.");
      setEnvoiEnCours(false);
      return;
    }
    router.push(`/cours/${json.id}`);
  }

  return (
    <div>
      <ZoneDepot
        envoi={envoi}
        onChange={(e) => {
          setEnvoi(e);
          setErreur("");
        }}
      />

      <div className="reglages">
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="reglage-titre" htmlFor="titre-cours">
            Nom du cours (facultatif)
          </label>
          <input
            id="titre-cours"
            className="champ"
            maxLength={120}
            placeholder="Laisse vide : l'IA trouvera un nom"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
        </div>
        {dossiers.length > 0 && (
          <div>
            <label className="reglage-titre" htmlFor="ranger-dans">
              Ranger dans
            </label>
            <select id="ranger-dans" className="champ" style={{ width: "auto", minWidth: 200 }} value={dossier} onChange={(e) => setDossier(e.target.value)}>
              <option value="">Aucun dossier</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button type="button" className="bouton principal" onClick={ranger} aria-busy={envoiEnCours} disabled={envoiEnCours}>
        <Icone nom="cahier" /> {envoiEnCours ? "Rangement…" : "Ranger le cours"}
      </button>
      {erreur && (
        <p className="erreur" role="alert">
          <Icone nom="croix" /> {erreur}
        </p>
      )}
    </div>
  );
}
