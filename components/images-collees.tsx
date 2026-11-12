"use client";

import { useEffect, useState } from "react";
import { Icone } from "./icones";

function Vignette({ fichier, numero, onRetirer }: { fichier: File; numero: number; onRetirer: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(fichier);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fichier]);

  return (
    <li className="vignette-collee">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={`Image ${numero}`} />}
      <span className="vignette-numero">Image {numero}</span>
      <button type="button" className="bouton fantome" aria-label={`Retirer l'image ${numero}`} title="Retirer" onClick={onRetirer}>
        <Icone nom="croix" taille={16} />
      </button>
    </li>
  );
}

/** Les images collées avec le texte, en petites vignettes. */
export function ImagesCollees({ images, onRetirer }: { images: File[]; onRetirer: (index: number) => void }) {
  if (images.length === 0) return null;
  return (
    <ul className="images-collees">
      {images.map((f, i) => (
        <Vignette key={`${f.name}-${f.size}-${i}`} fichier={f} numero={i + 1} onRetirer={() => onRetirer(i)} />
      ))}
    </ul>
  );
}
