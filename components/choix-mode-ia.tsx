"use client";
import { useEffect, useId, useState } from "react";
import type { ModeIA } from "@/lib/taches-types";
import { Icone } from "./icones";

const CLE = "mode-ia";
export type LecturePhotos = { local: boolean; rapide: boolean };

/**
 * Choix « Sans quota » / « Rapide », replié par défaut : le dernier choix est
 * retenu sur l'appareil. Si le cours contient des photos et que le mode choisi
 * ne sait pas les lire, on le dit avant l'envoi et on bascule si c'est possible.
 */
export function ChoixModeIA({
  valeur,
  onChange,
  photos = false,
  lecturePhotos,
}: {
  valeur: ModeIA;
  onChange: (mode: ModeIA) => void;
  photos?: boolean;
  lecturePhotos?: LecturePhotos;
}) {
  const nom = useId();
  const [ouvert, setOuvert] = useState(false);
  const localImpossible = photos && lecturePhotos !== undefined && !lecturePhotos.local;
  const aucunePossible = photos && lecturePhotos !== undefined && !lecturePhotos.local && !lecturePhotos.rapide;

  // Reprendre le dernier mode choisi sur cet appareil.
  useEffect(() => {
    try {
      const garde = localStorage.getItem(CLE);
      if ((garde === "local" || garde === "rapide") && garde !== valeur) onChange(garde);
    } catch {
      /* stockage indisponible */
    }
    // Une seule fois, au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localImpossible && !aucunePossible && valeur === "local") onChange("rapide");
  }, [localImpossible, aucunePossible, valeur, onChange]);

  function choisir(mode: ModeIA) {
    onChange(mode);
    try {
      localStorage.setItem(CLE, mode);
    } catch {
      /* stockage indisponible */
    }
  }

  const libelle = valeur === "local" ? "Sans quota (plus long)" : "Rapide (utilise les quotas IA)";

  return (
    <fieldset className="modes-ia">
      <div className="modes-ia-resume">
        <span>
          Génération : <strong>{libelle}</strong>
        </span>
        <button type="button" className="lien-bouton" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
          {ouvert ? "Fermer" : "Changer"}
        </button>
      </div>
      {aucunePossible ? (
        <p className="avertissement petit" role="alert">
          <Icone nom="photo" taille={18} /> Aucune IA du site ne sait lire les photos pour l&apos;instant. Envoie plutôt un PDF, un Word ou colle le texte.
        </p>
      ) : localImpossible ? (
        <p className="avertissement petit">
          <Icone nom="photo" taille={18} /> Ce cours contient des photos : seul le mode Rapide sait les lire.
        </p>
      ) : null}
      {ouvert && (
        <>
          <legend className="sr-only">Comment veux-tu générer ton contenu ?</legend>
          <div className="modes-ia-choix">
            <label className={`mode-ia${localImpossible ? " mode-ia-indisponible" : ""}`}>
              <input type="radio" name={nom} value="local" checked={valeur === "local"} disabled={localImpossible} onChange={() => choisir("local")} />
              <span>
                <strong>Sans quota</strong>
                <span>Plus long · Aucun quota IA utilisé</span>
                <small>{localImpossible ? "Ne sait pas lire les photos." : "Le serveur prépare ton contenu. Cela peut prendre plusieurs minutes."}</small>
              </span>
            </label>
            <label className="mode-ia">
              <input type="radio" name={nom} value="rapide" checked={valeur === "rapide"} onChange={() => choisir("rapide")} />
              <span>
                <strong>Rapide</strong>
                <span>Plus rapide · Utilise les quotas IA</span>
                <small>Si les IA rapides sont indisponibles, le serveur prend le relais sans quota, avec un délai plus long.</small>
              </span>
            </label>
          </div>
        </>
      )}
      <p className="petit discret" style={{ marginTop: 8 }}>
        Après l&apos;envoi, tu peux fermer la page : le traitement continue et tu seras prévenu quand c&apos;est prêt.
      </p>
    </fieldset>
  );
}
