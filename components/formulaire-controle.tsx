"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { DUREES, NOMBRES_CONTROLE, TYPES_QUESTIONS, type TypeQuestion } from "@/lib/controle";
import type { ModeIA } from "@/lib/taches-types";
import { messageErreur } from "./attente-ia";
import { ChoixModeIA, type LecturePhotos } from "./choix-mode-ia";
import { Icone } from "./icones";

const DIFFICULTES = [
  { id: "facile", libelle: "Facile" },
  { id: "moyen", libelle: "Moyen" },
  { id: "difficile", libelle: "Difficile" },
];

type Props = {
  cours: { id: string; titre: string; detail: string; photos: boolean }[];
  coursParDefaut: string;
  lecturePhotos: LecturePhotos;
};

/** Préparer un contrôle : le cours, le nombre de questions, les types, la difficulté et la durée. */
export function FormulaireControle({ cours, coursParDefaut, lecturePhotos }: Props) {
  const router = useRouter();
  const [coursChoisi, setCoursChoisi] = useState(coursParDefaut || cours[0]?.id || "");
  const [nombre, setNombre] = useState(8);
  const [difficulte, setDifficulte] = useState("moyen");
  const [duree, setDuree] = useState(20);
  const [types, setTypes] = useState<TypeQuestion[]>(TYPES_QUESTIONS.map((t) => t.id));
  const [mode, setMode] = useState<ModeIA>("local");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  if (!cours.length) {
    return (
      <div className="vide">
        <Icone nom="cahier" taille={48} />
        <h2>Ajoute d&apos;abord un cours</h2>
        <p className="discret">Le contrôle est préparé à partir d&apos;un de tes cours.</p>
        <Link href="/mes-cours/ajouter" className="bouton principal">
          <Icone nom="plus" /> Ajouter un cours
        </Link>
      </div>
    );
  }

  const basculer = (t: TypeQuestion) => setTypes((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));

  async function lancer() {
    if (!coursChoisi) return setErreur("Choisis un cours.");
    if (!types.length) return setErreur("Choisis au moins un type de question.");
    setEnvoi(true);
    setErreur("");
    const rep = await fetch(chemin("/api/controles"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cours: coursChoisi, nombre, difficulte, duree, types, mode }),
    }).catch(() => null);
    if (rep?.status === 401) return router.replace("/");
    const json = rep ? ((await rep.json().catch(() => ({}))) as { tacheId?: string; erreur?: string }) : {};
    if (!rep?.ok || !json.tacheId) {
      setEnvoi(false);
      return setErreur(messageErreur(json, "Le contrôle n'a pas pu être demandé. Réessaie."));
    }
    router.push(`/traitements/${json.tacheId}`);
  }

  return (
    <div>
      <span className="reglage-titre">Sur quel cours ?</span>
      <div className="liste-choix-cours">
        {cours.map((c) => (
          <label key={c.id} className="choix-dossier">
            <input type="radio" name="cours" checked={coursChoisi === c.id} onChange={() => setCoursChoisi(c.id)} />
            <Icone nom="fichier" taille={20} />
            <span style={{ flex: 1 }}>
              {c.titre}
              {c.detail && <span className="discret petit"> · {c.detail}</span>}
            </span>
          </label>
        ))}
      </div>

      <div className="reglages">
        <div>
          <span className="reglage-titre">Nombre de questions</span>
          <div className="pastilles">
            {NOMBRES_CONTROLE.map((n) => (
              <button key={n} type="button" className="pastille" aria-pressed={nombre === n} onClick={() => setNombre(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="reglage-titre">Difficulté</span>
          <div className="pastilles">
            {DIFFICULTES.map((d) => (
              <button key={d.id} type="button" className={`pastille diff-${d.id}`} aria-pressed={difficulte === d.id} onClick={() => setDifficulte(d.id)}>
                {d.libelle}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="reglage-titre">Durée</span>
          <div className="pastilles">
            {DUREES.map((d) => (
              <button key={d} type="button" className="pastille" aria-pressed={duree === d} onClick={() => setDuree(d)}>
                {d === 0 ? "Libre" : `${d} min`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <span className="reglage-titre">Types de questions</span>
      <div className="types-questions">
        {TYPES_QUESTIONS.map((t) => (
          <label key={t.id} className="type-question">
            <input type="checkbox" checked={types.includes(t.id)} onChange={() => basculer(t.id)} />
            <span>
              <strong>{t.libelle}</strong>
              <span className="discret petit">{t.detail}</span>
            </span>
          </label>
        ))}
      </div>

      <ChoixModeIA valeur={mode} onChange={setMode} photos={Boolean(cours.find((c) => c.id === coursChoisi)?.photos)} lecturePhotos={lecturePhotos} />
      <button type="button" className="bouton principal" onClick={lancer} disabled={envoi} aria-busy={envoi}>
        <Icone nom="crayon" /> Préparer mon contrôle
      </button>
      {erreur && (
        <p className="erreur" role="alert">
          <Icone nom="croix" /> {erreur}
        </p>
      )}
    </div>
  );
}
