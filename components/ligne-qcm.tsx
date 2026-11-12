"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { formaterNote } from "@/lib/quiz";
import { Icone } from "./icones";
import { Dialogue } from "./dialogue";

export type InfosQcm = {
  id: string;
  titre: string;
  matiere: string;
  difficulte: string;
  coursId: string | null;
  coursTitre: string | null;
  nbQuestions: number;
  creeLe: number;
  tentatives: number;
  meilleur: number | null;
};

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Une ligne de « Mes QCM » : la note, refaire, renommer, supprimer, et le cours d'origine. */
export function LigneQcm({ qcm, avecCours = true }: { qcm: InfosQcm; avecCours?: boolean }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState(qcm.titre);
  const [erreur, setErreur] = useState("");

  async function renommer() {
    if (!titre.trim()) return setErreur("Le nom ne peut pas être vide.");
    const rep = await fetch(chemin(`/api/qcm/${qcm.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre: titre.trim() }),
    }).catch(() => null);
    if (!rep?.ok) return setErreur("Le changement de nom n'a pas marché.");
    setOuvert(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le QCM « ${qcm.titre} » et ses notes ?`)) return;
    await fetch(chemin(`/api/qcm/${qcm.id}`), { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  }

  return (
    <li className="carte ligne-qcm">
      <div className="infos">
        <Link href={`/qcm/${qcm.id}`} className="titre-qcm">
          {qcm.titre}
        </Link>
        <div className="petit discret" style={{ marginTop: 4 }}>
          {qcm.matiere && <span className="etiquette">{qcm.matiere}</span>}
          <span className={`etiquette diff-${qcm.difficulte}`}>{qcm.difficulte}</span>
          {qcm.nbQuestions} questions · {dateCourte.format(qcm.creeLe)}
          {qcm.tentatives > 0 && ` · fait ${qcm.tentatives} fois`}
        </div>
        {avecCours && qcm.coursId && (
          <Link href={`/cours/${qcm.coursId}`} className="lien-cours petit">
            <Icone nom="fichier" taille={16} /> {qcm.coursTitre}
          </Link>
        )}
      </div>
      <div className="mini-note" title="Meilleure note">
        {qcm.meilleur === null ? <span className="discret petit">pas fait</span> : `${formaterNote(Math.round(qcm.meilleur * 40) / 2)}/20`}
      </div>
      <div className="outils-qcm">
        <Link href={`/qcm/${qcm.id}`} className="bouton">
          <Icone nom={qcm.tentatives > 0 ? "recommencer" : "suivant"} /> {qcm.tentatives > 0 ? "Refaire" : "Commencer"}
        </Link>
        <button
          type="button"
          className="bouton fantome"
          onClick={() => {
            setTitre(qcm.titre);
            setErreur("");
            setOuvert(true);
          }}
          aria-label="Renommer"
          title="Renommer"
        >
          <Icone nom="renommer" />
        </button>
        <button type="button" className="bouton fantome" onClick={supprimer} aria-label="Supprimer" title="Supprimer">
          <Icone nom="poubelle" />
        </button>
      </div>

      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Renommer le QCM">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void renommer();
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
    </li>
  );
}
