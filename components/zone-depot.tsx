"use client";

import { useRef, useState } from "react";
import { Icone } from "./icones";
import { ImagesCollees } from "./images-collees";
import { MAX_IMAGES_COLLEES, lireCollage, lirePressePapiers, retirerRepere } from "./collage";

const ACCEPTES = ".pdf,.docx,.pptx,.odt,.odp,.rtf,.html,.htm,.txt,.md,image/jpeg,image/png,image/webp";

/** `images` : les images collées avec le texte (mode « texte »). */
export type EnvoiCours = { mode: "fichier" | "texte" | "lien"; fichiers: File[]; texte: string; images: File[]; lien: string };
export const ENVOI_VIDE: EnvoiCours = { mode: "fichier", fichiers: [], texte: "", images: [], lien: "" };

/** Vérifie l'envoi avant de l'expédier. Renvoie un message d'erreur, ou "" si tout va bien. */
export function verifierEnvoi(e: EnvoiCours): string {
  if (e.mode === "fichier" && e.fichiers.length === 0) return "Choisis d'abord un fichier ou une photo de ton cours.";
  if (e.mode === "texte" && !e.texte.trim()) return "Colle d'abord le texte de ton cours.";
  if (e.mode === "texte" && e.texte.trim().length < 150 && e.images.length === 0) return "Le texte est trop court pour en faire un cours.";
  if (e.mode === "lien" && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(e.lien.trim())) return "Colle l'adresse complète de la page, qui commence par https://";
  return "";
}

/** Ajoute les fichiers ou le texte de l'envoi au formulaire. */
export function remplirEnvoi(form: FormData, e: EnvoiCours) {
  if (e.mode === "fichier") e.fichiers.forEach((f) => form.append("fichiers", f));
  else if (e.mode === "lien") form.append("lien", e.lien.trim());
  else {
    form.append("texte", e.texte.trim());
    e.images.forEach((f) => form.append("fichiers", f));
  }
}

/** Choix « Fichier ou photos » / « Coller du texte » et zone où glisser le cours. */
export function ZoneDepot({ envoi, onChange }: { envoi: EnvoiCours; onChange: (e: EnvoiCours) => void }) {
  const [survol, setSurvol] = useState(false);
  const [collage, setCollage] = useState<"" | "en-cours" | string>("");
  // Le collage est lu en plusieurs étapes : on repart toujours de l'envoi le plus récent.
  const dernier = useRef(envoi);
  dernier.current = envoi;

  async function coller(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const colle = lirePressePapiers(e.clipboardData);
    if (!colle) return; // Que du texte : le navigateur s'en charge.
    if (envoi.images.length >= MAX_IMAGES_COLLEES) {
      setCollage(`${MAX_IMAGES_COLLEES} images maximum : les nouvelles images n'ont pas été ajoutées.`);
      return;
    }
    e.preventDefault();
    const brut = e.clipboardData.getData("text/plain");
    const zone = e.currentTarget;
    const debut = zone.selectionStart;
    const fin = zone.selectionEnd;
    setCollage("en-cours");
    const r = await lireCollage(colle, envoi.images.length);
    const actuel = dernier.current;
    if (!r) return setCollage("");
    let ajout = r.texte;
    // Rien de lisible (images introuvables) : on colle au moins le texte brut.
    if (!ajout && r.images.length === 0) ajout = brut;
    const texte = actuel.texte.slice(0, debut) + ajout + actuel.texte.slice(fin);
    onChange({ ...actuel, texte, images: [...actuel.images, ...r.images] });
    setCollage(
      r.perdues > 0
        ? `${r.perdues} image${r.perdues > 1 ? "s" : ""} n'a pas pu être récupérée${r.perdues > 1 ? "s" : ""} (le site d'origine la bloque, ou la limite de ${MAX_IMAGES_COLLEES} est atteinte). Tu peux l'enregistrer puis l'envoyer dans « Fichier ou photos ».`
        : ""
    );
  }

  function retirerImage(index: number) {
    onChange({
      ...envoi,
      texte: retirerRepere(envoi.texte, index + 1),
      images: envoi.images.filter((_, i) => i !== index),
    });
  }

  function ajouter(liste: FileList | null) {
    if (!liste) return;
    const tous = [...envoi.fichiers, ...Array.from(liste)];
    const uniques = tous.filter((f, i) => tous.findIndex((g) => g.name === f.name && g.size === f.size) === i);
    onChange({ ...envoi, fichiers: uniques.slice(0, 6) });
  }

  return (
    <div>
      <div className="onglets" role="tablist">
        <button type="button" role="tab" className="onglet" aria-selected={envoi.mode === "fichier"} onClick={() => onChange({ ...envoi, mode: "fichier" })}>
          <Icone nom="fichier" taille={20} /> Fichier ou photos
        </button>
        <button type="button" role="tab" className="onglet" aria-selected={envoi.mode === "texte"} onClick={() => onChange({ ...envoi, mode: "texte" })}>
          <Icone nom="texte" taille={20} /> Coller du texte
        </button>
        <button type="button" role="tab" className="onglet" aria-selected={envoi.mode === "lien"} onClick={() => onChange({ ...envoi, mode: "lien" })}>
          <Icone nom="lien" taille={20} /> Lien vers une page
        </button>
      </div>

      {envoi.mode === "lien" ? (
        <div className="depot-lien">
          <label className="reglage-titre" htmlFor="lien-cours">
            Adresse de la page du cours
          </label>
          <input
            id="lien-cours"
            className="champ"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={envoi.lien}
            onChange={(e) => onChange({ ...envoi, lien: e.target.value })}
          />
          <p className="discret petit">Une page web (Wikipédia, site du prof, ENT…) ou un PDF en ligne. Les pages qui demandent une connexion ne peuvent pas être lues : enregistre-les et envoie le fichier.</p>
        </div>
      ) : envoi.mode === "fichier" ? (
        <>
          <label
            className={`depot${survol ? " survol" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setSurvol(true);
            }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSurvol(false);
              ajouter(e.dataTransfer.files);
            }}
          >
            <Icone nom="envoyer" taille={40} />
            <span style={{ fontSize: 24 }}>Glisse ton cours ici</span>
            <span className="discret petit">PDF (même scanné), Word, PowerPoint, LibreOffice, page web, texte ou photos du cahier · 6 fichiers maximum</span>
            <span className="bouton" style={{ marginTop: 8 }}>
              <Icone nom="plus" /> Choisir des fichiers
            </span>
            <input
              type="file"
              multiple
              accept={ACCEPTES}
              onChange={(e) => {
                ajouter(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="bouton bouton-photo">
            <Icone nom="photo" /> Prendre une page en photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                ajouter(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {envoi.fichiers.length > 0 && (
            <ul className="liste-fichiers">
              {envoi.fichiers.map((f, i) => (
                <li key={`${f.name}-${f.size}`}>
                  <Icone nom={f.type.startsWith("image/") ? "photo" : "fichier"} taille={20} />
                  <span>{f.name}</span>
                  <button
                    type="button"
                    className="bouton fantome"
                    aria-label={`Retirer ${f.name}`}
                    onClick={() => onChange({ ...envoi, fichiers: envoi.fichiers.filter((_, j) => j !== i) })}
                  >
                    <Icone nom="croix" taille={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <textarea
            className="champ"
            placeholder="Colle ici le texte de ton cours… (les images collées avec sont gardées)"
            value={envoi.texte}
            onChange={(e) => onChange({ ...envoi, texte: e.target.value })}
            onPaste={coller}
            aria-label="Texte du cours"
            aria-busy={collage === "en-cours"}
          />
          {collage === "en-cours" && <p className="discret petit">Récupération des images…</p>}
          {collage && collage !== "en-cours" && <p className="discret petit">{collage}</p>}
          <ImagesCollees images={envoi.images} onRetirer={retirerImage} />
        </>
      )}
    </div>
  );
}
