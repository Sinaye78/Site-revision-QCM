"use client";

import { useEffect, useState } from "react";

/**
 * Pluie de confettis dessinés (rectangles et serpentins au trait bleu marine,
 * couleurs du site), qui tombe une seule fois puis disparaît.
 */
const COULEURS = ["#e8473f", "#ffd84a", "#7cc35f", "#5d9ce6", "#f29a4a"];
const ENCRE = "#1d2b55";
const NOMBRE = 46;
const DUREE_MAX_MS = 4200;

type Piece = { id: number; gauche: number; delai: number; duree: number; taille: number; derive: number; tours: number; couleur: string; forme: "rect" | "serpentin" | "rond" };

function hasard(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function creerPieces(): Piece[] {
  return Array.from({ length: NOMBRE }, (_, id) => ({
    id,
    gauche: hasard(0, 100),
    delai: hasard(0, 0.9),
    duree: hasard(2.2, 3.2),
    taille: hasard(12, 20),
    derive: hasard(-60, 60),
    tours: hasard(1, 3) * (Math.random() < 0.5 ? -1 : 1),
    couleur: COULEURS[id % COULEURS.length],
    forme: id % 5 === 0 ? "serpentin" : id % 7 === 0 ? "rond" : "rect",
  }));
}

function Forme({ piece }: { piece: Piece }) {
  if (piece.forme === "serpentin") {
    return (
      <svg viewBox="0 0 20 30" width={piece.taille * 0.8} height={piece.taille * 1.3}>
        <path d="M10 2 C 2 6, 18 10, 10 15 S 2 24, 10 28" fill="none" stroke={piece.couleur} strokeWidth={3} strokeLinecap="round" />
      </svg>
    );
  }
  if (piece.forme === "rond") {
    return (
      <svg viewBox="0 0 20 20" width={piece.taille * 0.8} height={piece.taille * 0.8}>
        <circle cx="10" cy="10" r="7" fill={piece.couleur} stroke={ENCRE} strokeWidth={1.6} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 12" width={piece.taille} height={piece.taille * 0.6}>
      <rect x="1.5" y="1.5" width="17" height="9" rx="1.5" fill={piece.couleur} stroke={ENCRE} strokeWidth={1.6} />
      <path d="M5 3 L 3 9 M10 3 L 8 9 M15 3 L 13 9" stroke="rgba(255,255,255,0.55)" strokeWidth={1.2} />
    </svg>
  );
}

export function Confettis() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(creerPieces());
    const t = setTimeout(() => setPieces([]), DUREE_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  if (pieces.length === 0) return null;
  return (
    <div className="confettis" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti"
          style={
            {
              left: `${p.gauche}%`,
              animationDelay: `${p.delai}s`,
              animationDuration: `${p.duree}s`,
              "--derive": `${p.derive}px`,
              "--tours": `${p.tours * 360}deg`,
            } as React.CSSProperties
          }
        >
          <Forme piece={p} />
        </span>
      ))}
    </div>
  );
}
