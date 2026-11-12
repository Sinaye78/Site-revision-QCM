"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { CouvertureDossier } from "./couverture-dossier";

export const COULEURS = [
  { id: "bleu", nom: "Bleu" },
  { id: "rouge", nom: "Rouge" },
  { id: "vert", nom: "Vert" },
  { id: "jaune", nom: "Jaune" },
  { id: "violet", nom: "Violet" },
  { id: "orange", nom: "Orange" },
];

type DossierExistant = { id: string; nom: string; couleur: string; image: string | null };

/** Création ou modification d'un dossier (nom, couleur, image). */
export function FormulaireDossier({ dossier, onFini }: { dossier?: DossierExistant; onFini: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState(dossier?.nom ?? "");
  const [couleur, setCouleur] = useState(dossier?.couleur ?? "bleu");
  const [image, setImage] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [retirer, setRetirer] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!image) {
      setApercu(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) {
      setErreur("Donne un nom au dossier.");
      return;
    }
    const form = new FormData();
    form.append("nom", nom.trim());
    form.append("couleur", couleur);
    if (image) form.append("image", image);
    if (retirer && !image) form.append("retirerImage", "1");

    setEnvoi(true);
    setErreur("");
    const rep = await fetch(chemin(dossier ? `/api/dossiers/${dossier.id}` : "/api/dossiers"), {
      method: dossier ? "PATCH" : "POST",
      body: form,
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => ({}))) as { id?: string; erreur?: string }) : {};
    setEnvoi(false);
    if (!rep?.ok) {
      setErreur(json.erreur ?? "Le dossier n'a pas pu être enregistré.");
      return;
    }
    onFini();
    if (!dossier && json.id) router.push(`/dossiers/${json.id}`);
    else router.refresh();
  }

  const imageAffichee = apercu ? null : retirer ? null : (dossier?.image ?? null);

  return (
    <form onSubmit={enregistrer} className="formulaire-dossier">
      <div className="apercu-dossier">
        {apercu ? (
          <div className={`couverture couleur-${couleur}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="couverture-image" src={apercu} alt="" />
            <div className="etiquette-cahier">
              <span className="etiquette-nom">{nom || "Mon dossier"}</span>
            </div>
          </div>
        ) : (
          <CouvertureDossier nom={nom || "Mon dossier"} couleur={couleur} image={imageAffichee} />
        )}
      </div>

      <div className="champs-dossier">
        <label className="reglage-titre" htmlFor="nom-dossier">
          Nom
        </label>
        <input
          id="nom-dossier"
          className="champ"
          maxLength={60}
          placeholder="Histoire, Contrôle de maths…"
          value={nom}
          onChange={(e) => {
            setNom(e.target.value);
            setErreur("");
          }}
          autoFocus
        />

        <span className="reglage-titre" style={{ marginTop: 14 }}>
          Couleur
        </span>
        <div className="pastilles">
          {COULEURS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`pastille-couleur couleur-${c.id}`}
              aria-pressed={couleur === c.id}
              aria-label={c.nom}
              title={c.nom}
              onClick={() => setCouleur(c.id)}
            >
              {couleur === c.id && <Icone nom="coche" taille={18} />}
            </button>
          ))}
        </div>

        <span className="reglage-titre" style={{ marginTop: 14 }}>
          Image (facultatif)
        </span>
        <div className="pastilles">
          <label className="bouton">
            <Icone nom="photo" /> {image || dossier?.image ? "Changer l'image" : "Choisir une image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setImage(f);
                if (f) setRetirer(false);
                e.target.value = "";
              }}
            />
          </label>
          {(image || (dossier?.image && !retirer)) && (
            <button
              type="button"
              className="bouton fantome"
              onClick={() => {
                setImage(null);
                setRetirer(true);
              }}
            >
              <Icone nom="poubelle" /> Retirer
            </button>
          )}
        </div>
      </div>

      <div className="actions" style={{ gridColumn: "1 / -1" }}>
        <button type="submit" className="bouton principal" aria-busy={envoi}>
          <Icone nom="coche" /> {dossier ? "Enregistrer" : "Créer le dossier"}
        </button>
      </div>
      {erreur && (
        <p className="erreur" role="alert" style={{ gridColumn: "1 / -1" }}>
          {erreur}
        </p>
      )}
    </form>
  );
}
