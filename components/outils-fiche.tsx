"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import type { ModeIA } from "@/lib/taches-types";
import { messageErreur } from "./attente-ia";
import { ChoixModeIA } from "./choix-mode-ia";
import { Dialogue } from "./dialogue";
import { Icone } from "./icones";

const SUGGESTIONS = [
  "Refais la mise en page pour que ce soit plus clair",
  "Simplifie avec des phrases plus courtes",
  "Ajoute un exemple pour chaque notion",
  "Fais une fiche qui tient sur une page",
  "Transforme les événements en frise chronologique",
  "Explique plus en détail les passages difficiles",
  "Traduis la fiche en anglais",
];

/** « Demander à l'IA » : une consigne libre (ou une suggestion), sur toute la fiche ou une seule partie. */
export function BoutonRetouche({ coursId, sections, tacheId }: { coursId: string; sections: string[]; tacheId?: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [demande, setDemande] = useState("");
  const [section, setSection] = useState("");
  const [mode, setMode] = useState<ModeIA>("local");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  if (tacheId) {
    return (
      <Link href={`/traitements/${tacheId}`} className="bouton">
        <span className="point-en-cours" aria-hidden="true" /> Retouche en cours
      </Link>
    );
  }

  async function lancer() {
    if (demande.trim().length < 4) return setErreur("Écris ce que l'IA doit changer, ou choisis une idée.");
    setEnvoi(true);
    setErreur("");
    const rep = await fetch(chemin(`/api/cours/${coursId}/fiche`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, retouche: { demande: demande.trim(), ...(section !== "" ? { section: Number(section) } : {}) } }),
    }).catch(() => null);
    if (rep?.status === 401) return router.replace("/");
    const json = rep ? ((await rep.json().catch(() => ({}))) as { tacheId?: string; erreur?: string }) : {};
    if (!rep?.ok || !json.tacheId) {
      setEnvoi(false);
      return setErreur(messageErreur(json, "La demande n'a pas pu être envoyée. Réessaie."));
    }
    router.push(`/traitements/${json.tacheId}`);
  }

  return (
    <>
      <button type="button" className="bouton" onClick={() => setOuvert(true)}>
        <Icone nom="baguette" /> Demander à l&apos;IA
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Retoucher la fiche avec l'IA">
        <p className="discret petit" style={{ marginTop: 0 }}>
          L&apos;IA te propose une nouvelle version : tu la compares avec l&apos;actuelle avant de la garder. Ce qu&apos;elle ajoute et qui n&apos;est pas dans ton cours est marqué.
        </p>
        <div className="pastilles suggestions-retouche">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="pastille" aria-pressed={demande === s} onClick={() => setDemande(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="reglage-titre" htmlFor="demande-retouche" style={{ marginTop: 14 }}>
          Ta demande
        </label>
        <textarea
          id="demande-retouche"
          className="champ"
          style={{ minHeight: 90 }}
          maxLength={500}
          value={demande}
          placeholder="Par exemple : sépare bien les causes et les conséquences"
          onChange={(e) => setDemande(e.target.value)}
        />
        <label className="reglage-titre" htmlFor="partie-retouche" style={{ marginTop: 12 }}>
          Sur quoi ?
        </label>
        <select id="partie-retouche" className="champ" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">Toute la fiche</option>
          {sections.map((s, i) => (
            <option key={i} value={i}>
              Partie {i + 1} : {s}
            </option>
          ))}
        </select>
        <ChoixModeIA valeur={mode} onChange={setMode} />
        <button type="button" className="bouton principal" onClick={lancer} disabled={envoi} aria-busy={envoi}>
          <Icone nom="baguette" /> Lancer la retouche
        </button>
        {erreur && (
          <p className="erreur" role="alert">
            <Icone nom="croix" /> {erreur}
          </p>
        )}
      </Dialogue>
    </>
  );
}

export type VersionAffichee = { id: number; origine: "ia" | "main" | "retouche"; creeLe: number; nbSections: number };
const ORIGINES = { ia: "Faite par l'IA", main: "Modifiée à la main", retouche: "Retouchée par l'IA" };
const dateHeure = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Les anciennes versions de la fiche, pour revenir en arrière après une modification. */
export function HistoriqueFiche({ coursId, versions }: { coursId: string; versions: VersionAffichee[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  if (!versions.length) return null;

  async function restaurer(v: VersionAffichee) {
    if (!window.confirm(`Remettre la version du ${dateHeure.format(v.creeLe)} ? La fiche actuelle restera dans l'historique.`)) return;
    const rep = await fetch(chemin(`/api/cours/${coursId}/fiche`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurer: v.id }),
    }).catch(() => null);
    if (!rep?.ok) return setErreur("Cette version n'a pas pu être remise.");
    setOuvert(false);
    router.replace(`/cours/${coursId}?vue=fiche`);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="bouton fantome" onClick={() => setOuvert(true)} title="Anciennes versions de la fiche">
        <Icone nom="horloge" /> <span className="texte-nav">Historique</span>
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Anciennes versions">
        <ul className="liste-versions">
          {versions.map((v) => (
            <li key={v.id}>
              <span>
                <strong>{dateHeure.format(v.creeLe)}</strong>
                <span className="discret petit">
                  {ORIGINES[v.origine]} · {v.nbSections} partie{v.nbSections > 1 ? "s" : ""}
                </span>
              </span>
              <button type="button" className="bouton" onClick={() => void restaurer(v)}>
                <Icone nom="recommencer" /> Remettre
              </button>
            </li>
          ))}
        </ul>
        {erreur && <p className="erreur">{erreur}</p>}
      </Dialogue>
    </>
  );
}

/** Garder ou refuser la fiche retouchée par l'IA. */
export function DecisionProposition({ coursId }: { coursId: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  async function decider(choix: "garder" | "refuser") {
    setEnvoi(true);
    const rep = await fetch(chemin(`/api/cours/${coursId}/fiche`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposition: choix }),
    }).catch(() => null);
    setEnvoi(false);
    if (!rep?.ok) return setErreur("Ça n'a pas marché. Réessaie.");
    router.replace(`/cours/${coursId}?vue=fiche`);
    router.refresh();
  }
  return (
    <span className="decision-proposition">
      <button type="button" className="bouton" disabled={envoi} onClick={() => void decider("refuser")}>
        <Icone nom="croix" /> Refuser
      </button>
      <button type="button" className="bouton principal" disabled={envoi} onClick={() => void decider("garder")}>
        <Icone nom="coche" /> Garder cette version
      </button>
      {erreur && <span className="erreur petit">{erreur}</span>}
    </span>
  );
}

/** Corriger le texte d'origine (ce que l'IA lit pour faire les QCM et la fiche). */
export function EditeurTexteCours({ coursId, texte }: { coursId: string; texte: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState(texte);
  const [erreur, setErreur] = useState("");
  async function enregistrer() {
    const rep = await fetch(chemin(`/api/cours/${coursId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte: valeur }),
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => ({}))) as { erreur?: string }) : {};
    if (!rep?.ok) return setErreur(json.erreur ?? "Le texte n'a pas pu être enregistré.");
    setOuvert(false);
    router.refresh();
  }
  return (
    <>
      <button type="button" className="bouton fantome" onClick={() => { setValeur(texte); setErreur(""); setOuvert(true); }}>
        <Icone nom="renommer" /> Corriger le texte
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Corriger le texte du cours">
        <p className="discret petit" style={{ marginTop: 0 }}>
          C&apos;est ce texte que l&apos;IA lit pour les QCM et la fiche. Les repères « [Image N] » marquent la place des images collées : garde-les.
        </p>
        <textarea className="champ" style={{ minHeight: "50vh" }} value={valeur} onChange={(e) => setValeur(e.target.value)} aria-label="Texte du cours" />
        <div className="actions">
          <button type="button" className="bouton principal" onClick={() => void enregistrer()}>
            <Icone nom="coche" /> Enregistrer
          </button>
        </div>
        {erreur && <p className="erreur">{erreur}</p>}
      </Dialogue>
    </>
  );
}
