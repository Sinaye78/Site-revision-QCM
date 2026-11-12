"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CONSIGNES_CARTES, type Carte } from "@/lib/cartes";
import { melanger } from "@/lib/quiz";
import { Icone } from "./icones";

/**
 * Paquet de cartes recto/verso. On retourne la carte, puis on dit si on savait :
 * les cartes « à revoir » repassent à la fin du paquet jusqu'à ce qu'on les sache.
 */
export function PaquetCartes({ cartes, retour }: { cartes: (Carte & { cours?: string })[]; retour: { href: string; libelle: string } }) {
  // Premier affichage dans l'ordre de la fiche (même rendu serveur et navigateur) ; mélange au besoin.
  const [pile, setPile] = useState<number[]>(() => cartes.map((_, i) => i));
  const [retournee, setRetournee] = useState(false);
  const [sues, setSues] = useState(0);
  const [aRevoir, setARevoir] = useState<Set<number>>(new Set());

  const actuelle = pile[0];
  const carte = actuelle !== undefined ? cartes[actuelle] : undefined;

  const repondre = useCallback(
    (savait: boolean) => {
      if (actuelle === undefined || !retournee) return;
      setRetournee(false);
      if (savait) {
        setSues((n) => n + 1);
        setPile((p) => p.slice(1));
      } else {
        setARevoir((s) => new Set(s).add(actuelle));
        setPile((p) => [...p.slice(1), actuelle]);
      }
    },
    [actuelle, retournee]
  );

  function recommencer(liste: number[]) {
    setPile(melanger(liste));
    setRetournee(false);
    setSues(0);
    setARevoir(new Set());
  }

  // Espace ou Entrée : retourner ; flèche droite / 1 : je savais ; flèche gauche / 2 : à revoir.
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || !carte) return;
      if (e.target instanceof HTMLElement && e.target.closest("button, a, input, textarea")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setRetournee((r) => !r);
      } else if (retournee && (e.key === "ArrowRight" || e.key === "1")) repondre(true);
      else if (retournee && (e.key === "ArrowLeft" || e.key === "2")) repondre(false);
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [carte, retournee, repondre]);

  if (!carte) {
    return (
      <div className="vide">
        <Icone nom="coche" taille={48} />
        <h2>Paquet terminé !</h2>
        <p className="discret">
          {aRevoir.size === 0
            ? `Tu connaissais les ${cartes.length} cartes du premier coup.`
            : `${cartes.length - aRevoir.size} carte${cartes.length - aRevoir.size > 1 ? "s" : ""} sue${cartes.length - aRevoir.size > 1 ? "s" : ""} du premier coup, ${aRevoir.size} revue${aRevoir.size > 1 ? "s" : ""} plusieurs fois.`}
        </p>
        <div className="actions" style={{ justifyContent: "center" }}>
          {aRevoir.size > 0 && (
            <button type="button" className="bouton principal" onClick={() => recommencer([...aRevoir])}>
              <Icone nom="recommencer" /> Revoir les {aRevoir.size} difficiles
            </button>
          )}
          <button type="button" className={aRevoir.size > 0 ? "bouton" : "bouton principal"} onClick={() => recommencer(cartes.map((_, i) => i))}>
            <Icone nom="recommencer" /> Tout recommencer
          </button>
          <Link href={retour.href} className="bouton fantome">
            <Icone nom="precedent" /> {retour.libelle}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="paquet">
      <div className="paquet-barre">
        <span className="discret petit">
          Sues : {sues} / {cartes.length} · {pile.length} à voir
        </span>
        <button type="button" className="bouton fantome petit" onClick={() => recommencer(pile)} title="Mélanger les cartes restantes">
          <Icone nom="recommencer" taille={18} /> Mélanger
        </button>
      </div>
      <progress className="paquet-progression" max={cartes.length} value={sues} aria-label="Cartes sues" />

      <button
        type="button"
        className={`carte-memoire${retournee ? " retournee" : ""}`}
        onClick={() => setRetournee((r) => !r)}
        aria-label={retournee ? "Revoir la question" : "Retourner la carte"}
      >
        <span className="carte-face carte-recto" aria-hidden={retournee}>
          <span className="carte-consigne">{CONSIGNES_CARTES[carte.type]}</span>
          <span className="carte-texte">{carte.recto}</span>
          <span className="carte-aide discret petit">
            <Icone nom="retourner" taille={16} /> Touche pour retourner
          </span>
        </span>
        <span className="carte-face carte-verso" aria-hidden={!retournee}>
          <span className="carte-consigne">{carte.recto}</span>
          <span className={`carte-texte${carte.type === "formule" ? " carte-formule" : ""}`}>{carte.verso}</span>
          <span className="carte-aide discret petit">
            {carte.cours ? `${carte.cours} · ` : ""}
            {carte.section}
          </span>
        </span>
      </button>

      <div className="actions" style={{ justifyContent: "center" }}>
        {retournee ? (
          <>
            <button type="button" className="bouton reponse-carte a-revoir" onClick={() => repondre(false)}>
              <Icone nom="croix" /> À revoir
            </button>
            <button type="button" className="bouton principal reponse-carte" onClick={() => repondre(true)}>
              <Icone nom="coche" /> Je savais
            </button>
          </>
        ) : (
          <button type="button" className="bouton principal" onClick={() => setRetournee(true)}>
            <Icone nom="retourner" /> Retourner
          </button>
        )}
      </div>
      <p className="discret petit aide-clavier" style={{ textAlign: "center" }}>
        Espace pour retourner · → je savais · ← à revoir
      </p>
    </div>
  );
}
