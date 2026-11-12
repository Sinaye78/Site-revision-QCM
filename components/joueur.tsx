"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CercleStylo, Icone, Rature, Soulignement } from "@/components/icones";
import { Confettis } from "@/components/confettis";
import { chemin } from "@/lib/chemin";
import { appreciation, formaterNote, melanger, noteSur20, type Question } from "@/lib/quiz";

const LETTRES = ["A", "B", "C", "D"];
const ORDRE_NATUREL = [0, 1, 2, 3];

/** Une question à poser, avec le QCM d'où elle vient (une séance de révision mélange plusieurs QCM). */
export type ItemJoueur = { quizId: string; index: number; question: Question; source?: string; perm?: number[]; coursId?: string | null };

/** Lien vers l'endroit du cours qui justifie la réponse : la page du PDF, sinon le passage surligné par le navigateur. */
function lienVersLeCours(coursId: string, q: Question): string {
  if (q.page) return chemin(`/cours/${coursId}?vue=original&page=${q.page}#document`);
  const debut = q.extrait.split(/\s+/).slice(0, 8).join(" ");
  return chemin(`/cours/${coursId}?vue=original#:~:text=${encodeURIComponent(debut)}`);
}

/**
 * « copie » : le QCM entier, noté et enregistré.
 * « erreurs » : entraînement sur les questions ratées, sans rien enregistrer.
 * « revision » : séance de répétition espacée, enregistrée dans les révisions.
 */
type TypeSeance = "copie" | "erreurs" | "revision";
/** `perm[j]` = numéro d'origine du choix affiché en position j. */
type Etape = { item: number; perm: number[] };
type Seance = { type: TypeSeance; etapes: Etape[] };
type Sauvegarde = { v: 1; n: number; seance: Seance; reponses: (number | null)[]; index: number; choisi: number | null };

const cle = (it: ItemJoueur) => `${it.quizId}:${it.index}`;

function etapesMelangees(items: number[]): Etape[] {
  return melanger(items).map((item) => ({ item, perm: melanger(ORDRE_NATUREL) }));
}

function lireSauvegarde(nom: string, n: number): Sauvegarde | null {
  try {
    const s = JSON.parse(localStorage.getItem(nom) ?? "null") as Sauvegarde | null;
    if (!s || s.v !== 1 || s.n !== n || s.seance?.type !== "copie" || s.seance.etapes.length !== n) return null;
    if (!Array.isArray(s.reponses) || s.reponses.length !== n || s.index < 0 || s.index >= n) return null;
    if (!s.reponses.some((r) => r !== null)) return null;
    return s;
  } catch {
    return null;
  }
}

function effacer(nom?: string) {
  if (!nom) return;
  try {
    localStorage.removeItem(nom);
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}

type Props = {
  titre: string;
  matiere?: string;
  difficulte?: string;
  items: ItemJoueur[];
  /** « copie » pour un QCM (quizId obligatoire), « revision » pour une séance de révision. */
  type: "copie" | "revision";
  quizId?: string;
  coursId?: string | null;
};

export function Joueur({ titre, matiere, difficulte, items, type, quizId, coursId }: Props) {
  const router = useRouter();
  const nomSauvegarde = type === "copie" && quizId ? `qcm-progression:${quizId}` : undefined;
  // Ordre fixe au premier affichage (identique côté serveur et navigateur) ; une séance de
  // révision arrive déjà mélangée par le serveur, avec l'ordre de ses choix (`perm`).
  const initiale = (): Seance => ({ type, etapes: items.map((it, item) => ({ item, perm: it.perm ?? ORDRE_NATUREL })) });

  const [seance, setSeance] = useState<Seance>(initiale);
  const [index, setIndex] = useState(0);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [reponses, setReponses] = useState<(number | null)[]>(() => items.map(() => null));
  const [fini, setFini] = useState(false);
  const [repris, setRepris] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [signalees, setSignalees] = useState<Set<string>>(() => new Set(items.filter((it) => it.question.signalee).map(cle)));
  const suivantRef = useRef<HTMLButtonElement>(null);

  // Reprendre un QCM commencé (page rechargée, téléphone verrouillé…).
  useEffect(() => {
    if (!nomSauvegarde) return;
    const s = lireSauvegarde(nomSauvegarde, items.length);
    if (!s) return;
    setSeance(s.seance);
    setReponses(s.reponses);
    setIndex(s.index);
    setChoisi(s.choisi);
    setRepris(true);
  }, [nomSauvegarde, items.length]);

  useEffect(() => {
    if (!nomSauvegarde || seance.type !== "copie" || fini) return;
    try {
      const s: Sauvegarde = { v: 1, n: items.length, seance, reponses, index, choisi };
      localStorage.setItem(nomSauvegarde, JSON.stringify(s));
    } catch {
      /* stockage plein ou bloqué : la progression n'est simplement pas gardée */
    }
  }, [nomSauvegarde, seance, reponses, index, choisi, fini, items.length]);

  const total = seance.etapes.length;
  const etape = seance.etapes[index];
  const item = items[etape.item];
  const q = item.question;
  const bonneAffichee = etape.perm.indexOf(q.bonne_reponse);

  const juste = (k: number) => reponses[k] === items[seance.etapes[k].item].question.bonne_reponse;
  const compte = (k: number) => !signalees.has(cle(items[seance.etapes[k].item]));
  const comptees = seance.etapes.map((_, k) => k).filter(compte);
  const score = comptees.filter(juste).length;
  const erreurs = comptees.filter((k) => reponses[k] !== null && !juste(k));

  const choisir = useCallback(
    (affiche: number) => {
      if (choisi !== null || fini) return;
      setChoisi(affiche);
      setRepris(false);
      setReponses((r) => r.map((v, k) => (k === index ? etape.perm[affiche] : v)));
    },
    [choisi, fini, index, etape]
  );

  useEffect(() => {
    if (choisi !== null) suivantRef.current?.focus();
  }, [choisi]);

  async function envoyer(s: Seance, toutes: (number | null)[]) {
    if (s.type === "erreurs") return;
    try {
      let rep: Response;
      if (s.type === "copie") {
        const copie = items.map(() => -1);
        s.etapes.forEach((e, k) => (copie[e.item] = toutes[k] ?? -1));
        rep = await fetch(chemin(`/api/qcm/${quizId}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reponses: copie }),
        });
      } else {
        rep = await fetch(chemin("/api/revision"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reponses: s.etapes.map((e, k) => ({ quizId: items[e.item].quizId, index: items[e.item].index, choix: toutes[k] })) }),
        });
      }
      if (!rep.ok) throw new Error();
    } catch {
      setErreurEnvoi(s.type === "copie" ? "Ta note n'a pas pu être enregistrée dans l'historique." : "Ta révision n'a pas pu être enregistrée.");
    }
  }

  function suivant() {
    if (choisi === null) return;
    if (index + 1 >= total) {
      setFini(true);
      effacer(nomSauvegarde);
      void envoyer(seance, reponses);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setIndex(index + 1);
    setChoisi(null);
  }

  function demarrer(s: Seance) {
    setSeance(s);
    setIndex(0);
    setChoisi(null);
    setReponses(s.etapes.map(() => null));
    setFini(false);
    setRepris(false);
    setErreurEnvoi("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function recommencer() {
    effacer(nomSauvegarde);
    demarrer({ type: "copie", etapes: etapesMelangees(items.map((_, i) => i)) });
  }

  function refaireErreurs() {
    demarrer({ type: "erreurs", etapes: etapesMelangees(erreurs.map((k) => seance.etapes[k].item)) });
  }

  async function signaler(it: ItemJoueur, valeur: boolean) {
    const rep = await fetch(chemin(`/api/qcm/${it.quizId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signaler: it.index, valeur }),
    }).catch(() => null);
    if (!rep?.ok) return;
    setSignalees((s) => {
      const n = new Set(s);
      if (valeur) n.add(cle(it));
      else n.delete(cle(it));
      return n;
    });
  }

  // Clavier : A-D ou 1-4 pour répondre, Entrée pour continuer (le bouton a le focus).
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (fini || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      const i = "abcd".indexOf(k) >= 0 && k.length === 1 ? "abcd".indexOf(k) : ["1", "2", "3", "4"].indexOf(k);
      if (i >= 0 && choisi === null) choisir(i);
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [choisi, choisir, fini]);

  const sousTitre =
    seance.type === "erreurs" ? "Entraînement sur tes erreurs" : seance.type === "revision" ? "Révision du jour" : null;

  if (fini) {
    const note = noteSur20(score, comptees.length);
    const { commentaire, tampon } = appreciation(note);
    return (
      <div>
        <h1>
          <span className="surligne">{titre}</span>
        </h1>
        {sousTitre && <p className="discret">{sousTitre}</p>}
        {note >= 16 && <Confettis />}
        <div className="copie">
          {note >= 16 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="illustration-note bravo" src={chemin("/illustrations/bravo.webp")} alt="" width={1254} height={1254} />
          )}
          {note < 10 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="illustration-note encourage" src={chemin("/illustrations/recommencer.webp")} alt="" width={1254} height={1254} />
          )}
          <span className={`tampon${note >= 12 ? " vert" : ""}`}>{tampon}</span>
          <div className="note">
            {formaterNote(note)}
            <small>/20</small>
            <Soulignement />
          </div>
          <p className="commentaire">{commentaire}</p>
          <p className="discret">
            {score} bonne{score > 1 ? "s" : ""} réponse{score > 1 ? "s" : ""} sur {comptees.length}
            {comptees.length < total && ` (${total - comptees.length} question${total - comptees.length > 1 ? "s" : ""} signalée${total - comptees.length > 1 ? "s" : ""} hors note)`}
          </p>
          {seance.type === "erreurs" && <p className="discret petit">Entraînement : ces réponses ne changent ni ta note ni tes révisions.</p>}
          {seance.type === "revision" && <p className="discret petit">Les questions réussies reviendront plus tard, les autres dès demain.</p>}
        </div>

        <div className="actions" style={{ justifyContent: "center" }}>
          {erreurs.length > 0 && (
            <button type="button" className="bouton principal" onClick={refaireErreurs}>
              <Icone nom="recommencer" /> Refaire mes erreurs ({erreurs.length})
            </button>
          )}
          {type === "copie" ? (
            <>
              <button type="button" className={erreurs.length > 0 ? "bouton" : "bouton principal"} onClick={recommencer}>
                <Icone nom="recommencer" /> {seance.type === "copie" ? "Recommencer" : "Refaire tout le QCM"}
              </button>
              <Link href={coursId ? `/nouveau?cours=${coursId}` : "/nouveau"} className="bouton">
                <Icone nom="plus" /> {coursId ? "Nouvelles questions sur ce cours" : "Nouveau QCM"}
              </Link>
            </>
          ) : (
            <button
              type="button"
              className={erreurs.length > 0 ? "bouton" : "bouton principal"}
              onClick={() => {
                router.refresh();
                router.push("/accueil");
              }}
            >
              <Icone nom="coche" /> Terminer
            </button>
          )}
        </div>
        {erreurEnvoi && <p className="erreur" style={{ justifyContent: "center" }}>{erreurEnvoi}</p>}

        <h2 style={{ marginTop: 40 }}>Correction</h2>
        <ul className="recap">
          {seance.etapes.map((e, k) => {
            const it = items[e.item];
            const qq = it.question;
            const ok = juste(k);
            const horsNote = signalees.has(cle(it));
            const donnee = reponses[k];
            return (
              <li key={k} className={horsNote ? "recap-signalee" : undefined}>
                <span className={horsNote ? "discret" : ok ? "juste" : "faux"}>
                  <Icone nom={horsNote ? "drapeau" : ok ? "coche" : "croix"} />
                </span>
                <div className="recap-contenu">
                  <div>{qq.question}</div>
                  <div className="discret petit">
                    {ok ? "Bonne réponse : " : `Tu as répondu « ${donnee !== null && donnee >= 0 ? qq.choix[donnee] : "rien"} ». La bonne réponse : `}
                    <span className="surligne">{qq.choix[qq.bonne_reponse]}</span>
                  </div>
                  <details className="recap-details">
                    <summary className="petit">Pourquoi ?</summary>
                    <p className="petit">{qq.explication}</p>
                    {qq.extrait && (
                      <p className="extrait-recap petit">
                        <Icone nom="guillemets" taille={16} />
                        <span>
                          Dans ton cours{qq.page ? ` (page ${qq.page})` : ""} : {qq.extrait}
                          {(it.coursId ?? coursId) && (
                            <>
                              {" "}
                              <a className="lien-extrait" href={lienVersLeCours((it.coursId ?? coursId)!, qq)} target="_blank" rel="noreferrer">
                                {qq.page ? `Voir la page ${qq.page}` : "Voir dans le cours"}
                              </a>
                            </>
                          )}
                        </span>
                      </p>
                    )}
                    <button type="button" className="lien-bouton petit" onClick={() => void signaler(it, !horsNote)}>
                      {horsNote ? "Annuler le signalement" : "Cette question est fausse"}
                    </button>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
        {coursId && (
          <p style={{ marginTop: 24 }}>
            <Link href={`/cours/${coursId}`} className="bouton fantome">
              <Icone nom="fichier" /> Relire le cours
            </Link>
          </p>
        )}
      </div>
    );
  }

  const repondu = choisi !== null;
  const bon = repondu && choisi === bonneAffichee;
  const signalee = signalees.has(cle(item));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h1 style={{ marginBottom: 0 }}>
          <span className="surligne">{titre}</span>
        </h1>
        <span className="discret">
          {matiere && <span className="etiquette">{matiere}</span>}
          {difficulte && <span className={`etiquette diff-${difficulte}`}>{difficulte}</span>}
        </span>
      </div>
      {sousTitre && <p className="discret" style={{ margin: "6px 0 0" }}>{sousTitre}</p>}

      {repris && (
        <div className="bandeau-reprise" role="status">
          <span>On reprend là où tu t&apos;étais arrêté.</span>
          <button type="button" className="lien-bouton" onClick={recommencer}>
            Recommencer depuis le début
          </button>
        </div>
      )}

      <div className="progression" aria-label={`Question ${index + 1} sur ${total}`}>
        {seance.etapes.map((e, k) => {
          const r = reponses[k];
          const etat = r === null ? (k === index ? "actuelle" : "") : juste(k) ? "juste" : "faux";
          return (
            <span key={k} className={`case ${etat}`}>
              {etat === "juste" && <Icone nom="coche" taille={16} />}
              {etat === "faux" && <Icone nom="croix" taille={16} />}
            </span>
          );
        })}
      </div>

      <p className="discret petit" style={{ marginBottom: 4 }}>
        Question {index + 1} / {total}
        {item.source && <> · tirée de « {item.source} »</>}
      </p>
      <p className="enonce">{q.question}</p>

      <div className="liste-choix">
        {etape.perm.map((origine, affiche) => {
          const estBonne = affiche === bonneAffichee;
          const estChoisie = affiche === choisi;
          const estompe = repondu && !estBonne && !estChoisie;
          return (
            <button
              key={`${index}-${affiche}`}
              type="button"
              className={`choix${estompe ? " estompe" : ""}`}
              onClick={() => choisir(affiche)}
              disabled={repondu}
            >
              <span className="lettre">{LETTRES[affiche]}</span>
              <span className="libelle">
                {q.choix[origine]}
                {repondu && estChoisie && !estBonne && <Rature />}
                {repondu && estBonne && <CercleStylo couleur={bon ? "var(--stylo-vert)" : "var(--stylo-rouge)"} />}
              </span>
              {repondu && estChoisie && (
                <span className="dans-la-marge" style={{ color: bon ? "var(--stylo-vert)" : "var(--stylo-rouge)" }}>
                  {bon ? "+1" : "0"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {repondu && (
        <div className="postit" role="status">
          <div className="titre-postit">
            <Icone nom="ampoule" />
            {bon ? "Bien joué !" : "Pas tout à fait…"}
          </div>
          <p style={{ margin: 0 }}>{q.explication}</p>
          {q.extrait && (
            <div className="extrait">
              <Icone nom="guillemets" taille={18} />
              <span>
                Dans ton cours{q.page ? ` (page ${q.page})` : ""} : {q.extrait}
                {(item.coursId ?? coursId) && (
                  <>
                    {" "}
                    <a className="lien-extrait" href={lienVersLeCours((item.coursId ?? coursId)!, q)} target="_blank" rel="noreferrer">
                      {q.page ? `Voir la page ${q.page}` : "Voir dans le cours"}
                    </a>
                  </>
                )}
              </span>
            </div>
          )}
          <div className="signalement petit">
            {signalee ? (
              <>
                <Icone nom="drapeau" taille={16} /> Signalée : elle ne compte pas dans ta note.{" "}
                <button type="button" className="lien-bouton" onClick={() => void signaler(item, false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button type="button" className="lien-bouton" onClick={() => void signaler(item, true)} title="L'IA s'est trompée ? La question ne comptera plus.">
                <Icone nom="drapeau" taille={16} /> Cette question est fausse ?
              </button>
            )}
          </div>
        </div>
      )}

      <div className="actions">
        {repondu ? (
          <button ref={suivantRef} type="button" className="bouton principal" onClick={suivant}>
            {index + 1 >= total ? "Voir ma note" : "Question suivante"} <Icone nom="suivant" />
          </button>
        ) : (
          <span className="discret petit">
            <span className="aide-clavier">Clique sur une réponse, ou tape A, B, C ou D.</span>
            <span className="aide-tactile">Touche une réponse.</span>
          </span>
        )}
      </div>
    </div>
  );
}
