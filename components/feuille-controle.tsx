"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { morceauxTrous, TYPES_QUESTIONS, type QuestionSujet, type Reponse } from "@/lib/controle";
import { formaterNote } from "@/lib/quiz";
import type { ModeIA } from "@/lib/taches-types";
import { ChoixModeIA } from "./choix-mode-ia";
import { Icone } from "./icones";

const LETTRES = ["A", "B", "C", "D"];
type Brouillon = { v: 1; debut: number; reponses: Reponse[] };

function vide(r: Reponse): boolean {
  if (r === null || r === undefined) return true;
  if (typeof r === "string") return !r.trim();
  if (Array.isArray(r)) return r.every((x) => !x.trim());
  return false;
}

function minutes(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * La feuille du contrôle : un écran de départ (consignes, durée), puis toutes
 * les questions sur une copie. Les réponses sont gardées sur l'appareil en
 * cas de fermeture ; à la fin du temps, la copie est rendue toute seule.
 */
export function FeuilleControle({ id, titre, dureeMin, questions }: { id: string; titre: string; dureeMin: number; questions: QuestionSujet[] }) {
  const router = useRouter();
  const cle = `controle:${id}`;
  const total = questions.reduce((n, q) => n + q.points, 0);
  const aRediger = questions.some((q) => q.type === "courte" || q.type === "redigee");
  const [debut, setDebut] = useState<number | null>(null);
  const [reponses, setReponses] = useState<Reponse[]>(() => questions.map((q) => (q.type === "trous" ? morceauxTrous(q.enonce).slice(1).map(() => "") : null)));
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [mode, setMode] = useState<ModeIA>("rapide");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const rendue = useRef(false);

  // Reprendre un contrôle commencé sur cet appareil.
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(cle) ?? "null") as Brouillon | null;
      if (b?.v === 1 && Array.isArray(b.reponses) && b.reponses.length === questions.length) {
        setDebut(b.debut);
        setReponses(b.reponses);
      }
    } catch {
      /* stockage indisponible */
    }
  }, [cle, questions.length]);

  useEffect(() => {
    if (debut === null) return;
    try {
      localStorage.setItem(cle, JSON.stringify({ v: 1, debut, reponses } satisfies Brouillon));
    } catch {
      /* stockage plein ou bloqué */
    }
  }, [cle, debut, reponses]);

  useEffect(() => {
    if (debut === null) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [debut]);

  const ecoule = debut === null ? 0 : Math.max(0, Math.floor((maintenant - debut) / 1000));
  const restant = dureeMin > 0 ? Math.max(0, dureeMin * 60 - ecoule) : null;
  const repondues = reponses.filter((r) => !vide(r)).length;

  const rendre = useCallback(
    async (automatique: boolean) => {
      if (rendue.current) return;
      if (!automatique && repondues < questions.length && !window.confirm(`Il te reste ${questions.length - repondues} question(s) sans réponse. Rendre ta copie quand même ?`)) return;
      rendue.current = true;
      setEnvoi(true);
      setErreur("");
      const rep = await fetch(chemin(`/api/controles/${id}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reponses, dureeS: ecoule, mode }),
      }).catch(() => null);
      const json = rep ? ((await rep.json().catch(() => ({}))) as { copieId?: string; erreur?: string }) : {};
      if (!rep?.ok || !json.copieId) {
        rendue.current = false;
        setEnvoi(false);
        return setErreur(json.erreur ?? "Ta copie n'a pas pu être rendue. Vérifie ta connexion et réessaie : tes réponses sont gardées.");
      }
      try {
        localStorage.removeItem(cle);
      } catch {
        /* rien à effacer */
      }
      router.push(`/copies/${json.copieId}`);
    },
    [cle, ecoule, id, mode, questions.length, repondues, reponses, router]
  );

  useEffect(() => {
    if (restant === 0 && debut !== null) void rendre(true);
  }, [restant, debut, rendre]);

  const changer = (i: number, r: Reponse) => setReponses((l) => l.map((x, k) => (k === i ? r : x)));

  if (debut === null) {
    return (
      <div className="carte depart-controle">
        <h2>Avant de commencer</h2>
        <ul className="consignes-controle">
          <li>
            {questions.length} questions, notées sur <strong>{formaterNote(total)} points</strong> (ta note sera ramenée sur 20).
          </li>
          <li>{dureeMin > 0 ? <>Tu as <strong>{dureeMin} minutes</strong>. À la fin du temps, ta copie est rendue toute seule.</> : "Pas de limite de temps : prends le temps qu'il te faut."}</li>
          <li>
            Types : {[...new Set(questions.map((q) => q.type))].map((t) => TYPES_QUESTIONS.find((x) => x.id === t)?.libelle).join(", ")}.
          </li>
          <li>Pas de cours ouvert : c&apos;est un entraînement, mais joue le jeu !</li>
          <li>Tes réponses sont gardées sur cet appareil si tu fermes la page.</li>
        </ul>
        <button type="button" className="bouton principal" onClick={() => setDebut(Date.now())}>
          <Icone nom="horloge" /> Commencer le contrôle
        </button>
      </div>
    );
  }

  return (
    <div className="feuille-controle">
      <div className="barre-controle" role="status">
        <span>
          {repondues} / {questions.length} réponses
        </span>
        {restant !== null ? (
          <span className={`minuteur${restant < 60 ? " presque-fini" : ""}`}>
            <Icone nom="horloge" taille={20} /> {minutes(restant)}
          </span>
        ) : (
          <span className="minuteur discret">
            <Icone nom="horloge" taille={20} /> {minutes(ecoule)}
          </span>
        )}
      </div>

      <ol className="questions-controle">
        {questions.map((q, i) => (
          <li key={i} className="question-controle">
            <span className="bareme">/{formaterNote(q.points)}</span>
            {q.type === "trous" ? (
              <div className="enonce-controle">
                <p className="consigne-trous discret petit">Complète le texte :</p>
                <p className="texte-trous">
                  {morceauxTrous(q.enonce).map((m, k, tout) => (
                    <span key={k}>
                      {m}
                      {k < tout.length - 1 && (
                        <input
                          className="trou"
                          aria-label={`Trou ${k + 1}`}
                          value={(reponses[i] as string[] | null)?.[k] ?? ""}
                          onChange={(e) => changer(i, ((reponses[i] as string[] | null) ?? []).map((x, j) => (j === k ? e.target.value : x)))}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      )}
                    </span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="enonce-controle">
                {q.type === "vrai_faux" && <span className="discret petit">Vrai ou faux ? </span>}
                {q.enonce}
              </p>
            )}

            {q.type === "qcm" && (
              <div className="choix-controle">
                {q.choix!.map((c, k) => (
                  <label key={k} className="choix-dossier">
                    <input type="radio" name={`q${i}`} checked={reponses[i] === k} onChange={() => changer(i, k)} />
                    <span className="lettre-petite">{LETTRES[k]}</span> {c}
                  </label>
                ))}
              </div>
            )}
            {q.type === "vrai_faux" && (
              <div className="pastilles">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" className="pastille" aria-pressed={reponses[i] === v} onClick={() => changer(i, v)}>
                    {v ? "Vrai" : "Faux"}
                  </button>
                ))}
              </div>
            )}
            {(q.type === "courte" || q.type === "redigee") && (
              <>
                <textarea
                  className="champ reponse-redigee"
                  rows={q.type === "courte" ? 2 : 7}
                  value={(reponses[i] as string | null) ?? ""}
                  onChange={(e) => changer(i, e.target.value)}
                  placeholder={q.type === "courte" ? "Ta réponse en une phrase" : "Ta réponse rédigée, en quelques phrases"}
                  aria-label={`Réponse à la question ${i + 1}`}
                />
                {q.type === "redigee" && (
                  <span className="discret petit">{((reponses[i] as string | null) ?? "").trim().split(/\s+/).filter(Boolean).length} mots</span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      {aRediger && (
        <ChoixModeIA valeur={mode} onChange={setMode} />
      )}
      <div className="actions">
        <button type="button" className="bouton principal" onClick={() => void rendre(false)} disabled={envoi} aria-busy={envoi}>
          <Icone nom="coche" /> Rendre ma copie
        </button>
      </div>
      {erreur && (
        <p className="erreur" role="alert">
          <Icone nom="croix" /> {erreur}
        </p>
      )}
      <p className="discret petit" style={{ textAlign: "right" }}>
        {titre}
      </p>
    </div>
  );
}
