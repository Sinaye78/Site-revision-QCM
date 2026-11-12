"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { Dialogue } from "./dialogue";

/** Boutons Renommer / Ranger / Supprimer d'un cours, avec leurs fenêtres. */
export function OutilsCours({
  cours,
  dossiers,
  apresSuppression,
}: {
  cours: { id: string; titre: string; dossierId: string | null };
  dossiers: { id: string; nom: string }[];
  apresSuppression?: string;
}) {
  const router = useRouter();
  const [fenetre, setFenetre] = useState<"renommer" | "ranger" | null>(null);
  const [titre, setTitre] = useState(cours.titre);
  const [dossier, setDossier] = useState(cours.dossierId ?? "");
  const [erreur, setErreur] = useState("");

  async function modifier(champs: { titre?: string; dossierId?: string | null }) {
    const rep = await fetch(chemin(`/api/cours/${cours.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(champs),
    }).catch(() => null);
    if (!rep?.ok) {
      const json = rep ? ((await rep.json().catch(() => ({}))) as { erreur?: string }) : {};
      setErreur(json.erreur ?? "La modification n'a pas marché.");
      return;
    }
    setFenetre(null);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le cours « ${cours.titre} » et ses fichiers ? Ses QCM sont gardés dans Mes QCM.`)) return;
    await fetch(chemin(`/api/cours/${cours.id}`), { method: "DELETE" }).catch(() => undefined);
    if (apresSuppression) router.push(apresSuppression);
    router.refresh();
  }

  function ouvrir(f: "renommer" | "ranger") {
    setErreur("");
    setTitre(cours.titre);
    setDossier(cours.dossierId ?? "");
    setFenetre(f);
  }

  return (
    <>
      <button type="button" className="bouton fantome" onClick={() => ouvrir("renommer")} aria-label="Renommer" title="Renommer">
        <Icone nom="renommer" />
      </button>
      <button type="button" className="bouton fantome" onClick={() => ouvrir("ranger")} aria-label="Ranger dans un dossier" title="Ranger dans un dossier">
        <Icone nom="dossier" />
      </button>
      <button type="button" className="bouton fantome" onClick={supprimer} aria-label="Supprimer" title="Supprimer">
        <Icone nom="poubelle" />
      </button>

      <Dialogue ouvert={fenetre === "renommer"} onFermer={() => setFenetre(null)} titre="Renommer le cours">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!titre.trim()) return setErreur("Le nom ne peut pas être vide.");
            void modifier({ titre: titre.trim() });
          }}
        >
          <input
            className="champ"
            value={titre}
            maxLength={120}
            onChange={(e) => {
              setTitre(e.target.value);
              setErreur("");
            }}
            aria-label="Nouveau nom"
          />
          <div className="actions">
            <button type="submit" className="bouton principal">
              <Icone nom="coche" /> Renommer
            </button>
          </div>
          {erreur && <p className="erreur">{erreur}</p>}
        </form>
      </Dialogue>

      <Dialogue ouvert={fenetre === "ranger"} onFermer={() => setFenetre(null)} titre="Ranger dans un dossier">
        {dossiers.length === 0 ? (
          <p className="discret">Tu n&apos;as pas encore de dossier. Crée-en un depuis « Mes cours ».</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void modifier({ dossierId: dossier || null });
            }}
          >
            <div className="choix-dossiers">
              <label className="choix-dossier">
                <input type="radio" name="dossier" checked={dossier === ""} onChange={() => setDossier("")} />
                <span>Aucun dossier</span>
              </label>
              {dossiers.map((d) => (
                <label key={d.id} className="choix-dossier">
                  <input type="radio" name="dossier" checked={dossier === d.id} onChange={() => setDossier(d.id)} />
                  <Icone nom="dossier" taille={20} />
                  <span>{d.nom}</span>
                </label>
              ))}
            </div>
            <div className="actions">
              <button type="submit" className="bouton principal">
                <Icone nom="coche" /> Ranger
              </button>
            </div>
            {erreur && <p className="erreur">{erreur}</p>}
          </form>
        )}
      </Dialogue>
    </>
  );
}
