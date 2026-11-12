"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import type { Bloc, Fiche } from "@/lib/fiche";
import { Icone } from "./icones";

type TypeBloc = Bloc["type"];
const TYPES: { id: Exclude<TypeBloc, "image">; libelle: string }[] = [
  { id: "paragraphe", libelle: "Paragraphe" },
  { id: "liste", libelle: "Liste" },
  { id: "definition", libelle: "Définition" },
  { id: "important", libelle: "À retenir" },
  { id: "date", libelle: "Date" },
  { id: "formule", libelle: "Formule" },
  { id: "exemple", libelle: "Exemple" },
];

/** Le texte principal d'un bloc, pour le garder quand on change son type. */
function texteDe(b: Bloc): string {
  if (b.type === "liste") return b.elements.join("\n");
  if (b.type === "image") return b.legende;
  return b.texte;
}

function convertir(b: Bloc, type: Exclude<TypeBloc, "image">): Bloc {
  const texte = texteDe(b) || " ";
  const base = { ajout_ia: b.ajout_ia };
  switch (type) {
    case "liste":
      return { ...base, type, elements: texte.split("\n").map((l) => l.trim()).filter(Boolean) };
    case "definition":
      return { ...base, type, terme: b.type === "definition" ? b.terme : "", texte };
    case "date":
      return { ...base, type, date: b.type === "date" ? b.date : "", texte };
    case "formule":
      return { ...base, type, texte, explication: b.type === "formule" ? b.explication : "" };
    default:
      return { ...base, type, texte };
  }
}

function deplacer<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

function ChampsBloc({ bloc, onChange }: { bloc: Bloc; onChange: (b: Bloc) => void }) {
  const zone = (valeur: string, maj: (v: string) => void, etiquette: string, lignes = 3) => (
    <textarea className="champ champ-bloc" rows={lignes} value={valeur} aria-label={etiquette} placeholder={etiquette} onChange={(e) => maj(e.target.value)} />
  );
  const ligne = (valeur: string, maj: (v: string) => void, etiquette: string) => (
    <input className="champ champ-bloc" value={valeur} aria-label={etiquette} placeholder={etiquette} onChange={(e) => maj(e.target.value)} />
  );
  switch (bloc.type) {
    case "liste":
      return zone(bloc.elements.join("\n"), (v) => onChange({ ...bloc, elements: v.split("\n") }), "Un élément par ligne", Math.max(3, bloc.elements.length));
    case "definition":
      return (
        <>
          {ligne(bloc.terme, (v) => onChange({ ...bloc, terme: v }), "Le mot")}
          {zone(bloc.texte, (v) => onChange({ ...bloc, texte: v }), "Sa définition", 2)}
        </>
      );
    case "date":
      return (
        <>
          {ligne(bloc.date, (v) => onChange({ ...bloc, date: v }), "La date")}
          {zone(bloc.texte, (v) => onChange({ ...bloc, texte: v }), "Ce qui s'est passé", 2)}
        </>
      );
    case "formule":
      return (
        <>
          {ligne(bloc.texte, (v) => onChange({ ...bloc, texte: v }), "La formule")}
          {zone(bloc.explication, (v) => onChange({ ...bloc, explication: v }), "Explication (facultatif)", 2)}
        </>
      );
    case "image":
      return ligne(bloc.legende, (v) => onChange({ ...bloc, legende: v }), "Légende de l'image");
    default:
      return zone(bloc.texte, (v) => onChange({ ...bloc, texte: v }), "Texte");
  }
}

/** Nettoie le brouillon avant l'envoi : lignes vides des listes, blocs vides. */
function nettoyer(f: Fiche): Fiche {
  return {
    ...f,
    mots_cles: f.mots_cles.map((m) => m.trim()).filter(Boolean),
    sections: f.sections
      .map((s) => ({
        ...s,
        titre: s.titre.trim() || "Sans titre",
        blocs: s.blocs
          .map((b) => (b.type === "liste" ? { ...b, elements: b.elements.map((e) => e.trim()).filter(Boolean) } : b))
          .filter((b) => (b.type === "image" ? true : texteDe(b).trim().length > 0)),
      }))
      .filter((s) => s.blocs.length > 0),
  };
}

/** Modifier la fiche à la main : chaque bloc se corrige, change de type, se déplace ou s'efface. */
export function EditeurFiche({ coursId, fiche }: { coursId: string; fiche: Fiche }) {
  const router = useRouter();
  const [brouillon, setBrouillon] = useState<Fiche>(() => structuredClone(fiche));
  const [motsCles, setMotsCles] = useState(fiche.mots_cles.join(", "));
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const majSection = (i: number, maj: (s: Fiche["sections"][number]) => Fiche["sections"][number]) =>
    setBrouillon((f) => ({ ...f, sections: f.sections.map((s, k) => (k === i ? maj(s) : s)) }));
  const majBloc = (i: number, j: number, b: Bloc) => majSection(i, (s) => ({ ...s, blocs: s.blocs.map((x, k) => (k === j ? b : x)) }));

  async function enregistrer() {
    const propre = nettoyer({ ...brouillon, mots_cles: motsCles.split(",") });
    if (propre.sections.length === 0) return setErreur("La fiche doit garder au moins une partie avec du texte.");
    setEnvoi(true);
    setErreur("");
    const rep = await fetch(chemin(`/api/cours/${coursId}/fiche`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiche: propre }),
    }).catch(() => null);
    const json = rep ? ((await rep.json().catch(() => ({}))) as { erreur?: string }) : {};
    setEnvoi(false);
    if (!rep?.ok) return setErreur(json.erreur ?? "La fiche n'a pas pu être enregistrée.");
    router.replace(`/cours/${coursId}?vue=fiche`);
    router.refresh();
  }

  return (
    <div className="editeur-fiche">
      <div className="postit editeur-aide petit">
        <Icone nom="ampoule" taille={18} /> Entoure un mot de **deux étoiles** pour le surligner. L&apos;ancienne version reste dans l&apos;historique.
      </div>

      <label className="reglage-titre" htmlFor="resume-fiche">
        En bref
      </label>
      <textarea id="resume-fiche" className="champ champ-bloc" rows={2} value={brouillon.resume} onChange={(e) => setBrouillon((f) => ({ ...f, resume: e.target.value }))} />

      {brouillon.sections.map((s, i) => (
        <section key={i} className="editeur-section">
          <div className="editeur-ligne">
            <span className="fiche-numero">{i + 1}.</span>
            <input className="champ editeur-titre" value={s.titre} aria-label={`Titre de la partie ${i + 1}`} onChange={(e) => majSection(i, (x) => ({ ...x, titre: e.target.value }))} />
            <span className="editeur-outils">
              <button type="button" className="bouton fantome" aria-label="Monter la partie" disabled={i === 0} onClick={() => setBrouillon((f) => ({ ...f, sections: deplacer(f.sections, i, -1) }))}>
                <Icone nom="haut" taille={18} />
              </button>
              <button type="button" className="bouton fantome" aria-label="Descendre la partie" disabled={i === brouillon.sections.length - 1} onClick={() => setBrouillon((f) => ({ ...f, sections: deplacer(f.sections, i, 1) }))}>
                <Icone nom="bas" taille={18} />
              </button>
              <button
                type="button"
                className="bouton fantome"
                aria-label="Supprimer la partie"
                onClick={() => window.confirm(`Supprimer la partie « ${s.titre} » ?`) && setBrouillon((f) => ({ ...f, sections: f.sections.filter((_, k) => k !== i) }))}
              >
                <Icone nom="poubelle" taille={18} />
              </button>
            </span>
          </div>

          {s.blocs.map((b, j) => (
            <div key={j} className={`editeur-bloc${b.ajout_ia ? " fiche-ajout-ia" : ""}`}>
              <div className="editeur-ligne">
                {b.type === "image" ? (
                  <span className="etiquette">Image</span>
                ) : (
                  <select className="champ editeur-type" value={b.type} aria-label="Type de bloc" onChange={(e) => majBloc(i, j, convertir(b, e.target.value as Exclude<TypeBloc, "image">))}>
                    {TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.libelle}
                      </option>
                    ))}
                  </select>
                )}
                <span className="editeur-outils">
                  <button type="button" className="bouton fantome" aria-label="Monter le bloc" disabled={j === 0} onClick={() => majSection(i, (x) => ({ ...x, blocs: deplacer(x.blocs, j, -1) }))}>
                    <Icone nom="haut" taille={18} />
                  </button>
                  <button type="button" className="bouton fantome" aria-label="Descendre le bloc" disabled={j === s.blocs.length - 1} onClick={() => majSection(i, (x) => ({ ...x, blocs: deplacer(x.blocs, j, 1) }))}>
                    <Icone nom="bas" taille={18} />
                  </button>
                  <button type="button" className="bouton fantome" aria-label="Supprimer le bloc" onClick={() => majSection(i, (x) => ({ ...x, blocs: x.blocs.filter((_, k) => k !== j) }))}>
                    <Icone nom="poubelle" taille={18} />
                  </button>
                </span>
              </div>
              <ChampsBloc bloc={b} onChange={(nb) => majBloc(i, j, nb)} />
              {b.ajout_ia && (
                <label className="petit discret editeur-marque">
                  <input type="checkbox" checked onChange={() => majBloc(i, j, { ...b, ajout_ia: undefined })} /> Ajouté par l&apos;IA (décoche si c&apos;est bien dans ton cours)
                </label>
              )}
            </div>
          ))}
          <button type="button" className="bouton fantome petit" onClick={() => majSection(i, (x) => ({ ...x, blocs: [...x.blocs, { type: "paragraphe", texte: "" }] }))}>
            <Icone nom="plus" taille={18} /> Ajouter un bloc
          </button>
        </section>
      ))}

      <button
        type="button"
        className="bouton"
        onClick={() => setBrouillon((f) => ({ ...f, sections: [...f.sections, { titre: "Nouvelle partie", blocs: [{ type: "paragraphe", texte: "" }] }] }))}
      >
        <Icone nom="plus" /> Ajouter une partie
      </button>

      <label className="reglage-titre" htmlFor="mots-fiche" style={{ marginTop: 24 }}>
        Mots-clés (séparés par des virgules)
      </label>
      <input id="mots-fiche" className="champ" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} />

      <div className="actions editeur-actions">
        <button type="button" className="bouton fantome" onClick={() => router.replace(`/cours/${coursId}?vue=fiche`)}>
          Annuler
        </button>
        <button type="button" className="bouton principal" onClick={enregistrer} aria-busy={envoi} disabled={envoi}>
          <Icone nom="coche" /> Enregistrer la fiche
        </button>
      </div>
      {erreur && (
        <p className="erreur" role="alert">
          <Icone nom="croix" /> {erreur}
        </p>
      )}
    </div>
  );
}
