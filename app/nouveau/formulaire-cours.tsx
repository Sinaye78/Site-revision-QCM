"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/icones";
import { chemin } from "@/lib/chemin";
import { messageErreur } from "@/components/attente-ia";
import { ChoixModeIA, type LecturePhotos } from "@/components/choix-mode-ia";
import type { ModeIA } from "@/lib/taches-types";
import { ENVOI_VIDE, ZoneDepot, remplirEnvoi, verifierEnvoi, type EnvoiCours } from "@/components/zone-depot";

const NOMBRES = [5, 10, 15, 20];
const DIFFICULTES = [
  { id: "facile", libelle: "Facile" },
  { id: "moyen", libelle: "Moyen" },
  { id: "difficile", libelle: "Difficile" },
];

type Props = {
  cours: { id: string; titre: string; detail: string; photos: boolean; nbQcm: number }[];
  coursParDefaut: string;
  dossiers: { id: string; nom: string }[];
  dossierParDefaut: string;
  lecturePhotos: LecturePhotos;
};

export function FormulaireCours({ cours, coursParDefaut, dossiers, dossierParDefaut, lecturePhotos }: Props) {
  const router = useRouter();
  // « existant » = un cours déjà rangé dans Mes cours ; « nouveau » = on envoie un cours maintenant.
  const [source, setSource] = useState<"existant" | "nouveau">(coursParDefaut ? "existant" : "nouveau");
  const [coursChoisi, setCoursChoisi] = useState(coursParDefaut || cours[0]?.id || "");
  const [envoi, setEnvoi] = useState<EnvoiCours>(ENVOI_VIDE);
  const [dossier, setDossier] = useState(dossierParDefaut);
  const [nombre, setNombre] = useState(10);
  const [difficulte, setDifficulte] = useState("moyen");
  const [mode, setMode] = useState<ModeIA>("local");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const choisiInfos = cours.find((c) => c.id === coursChoisi);
  const photos =
    source === "existant"
      ? Boolean(choisiInfos?.photos)
      : envoi.mode === "fichier"
        ? envoi.fichiers.some((f) => f.type.startsWith("image/"))
        : envoi.images.length > 0;

  async function generer() {
    const form = new FormData();
    if (source === "existant") {
      if (!coursChoisi) return setErreur("Choisis un cours dans la liste.");
      form.append("cours", coursChoisi);
    } else {
      const probleme = verifierEnvoi(envoi);
      if (probleme) return setErreur(probleme);
      remplirEnvoi(form, envoi);
      form.append("dossier", dossier);
    }
    form.append("nombre", String(nombre));
    form.append("difficulte", difficulte);
    form.append("mode", mode);

    setErreur("");
    setEnCours(true);
    try {
      const rep = await fetch(chemin("/api/generer"), { method: "POST", body: form });
      if (rep.status === 401) return router.replace("/");
      const json = (await rep.json().catch(() => ({}))) as { tacheId?: string; erreur?: string; code?: string; coursId?: string };
      if (!rep.ok || !json.tacheId) {
        // Le nouveau cours a quand même été rangé : on le garde sélectionné pour réessayer.
        if (json.coursId && source === "nouveau") {
          router.refresh();
          setCoursChoisi(json.coursId);
          setSource("existant");
        }
        throw new Error(messageErreur(json, "Le QCM n'a pas pu être créé. Réessaie."));
      }
      router.push(`/traitements/${json.tacheId}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le QCM n'a pas pu être créé. Réessaie.");
      setEnCours(false);
    }
  }

  if (enCours) return <section className="carte" role="status"><h2>Envoi de ton cours…</h2><progress aria-label="Envoi en cours" /><p>Garde cette page ouverte jusqu’à la confirmation de l’envoi. Le traitement pourra ensuite continuer en arrière-plan.</p></section>;

  return (
    <div>
      {cours.length > 0 && (
        <div className="choix-source" role="radiogroup" aria-label="D'où vient le cours ?">
          <button type="button" role="radio" aria-checked={source === "existant"} className="carte-source" onClick={() => { setSource("existant"); setErreur(""); }}>
            <Icone nom="cahier" taille={28} />
            <span>Un cours de Mes cours</span>
          </button>
          <button type="button" role="radio" aria-checked={source === "nouveau"} className="carte-source" onClick={() => { setSource("nouveau"); setErreur(""); }}>
            <Icone nom="envoyer" taille={28} />
            <span>Un nouveau cours</span>
          </button>
        </div>
      )}

      {source === "existant" ? (
        <div className="liste-choix-cours">
          {cours.map((c) => (
            <label key={c.id} className="choix-dossier">
              <input type="radio" name="cours" checked={coursChoisi === c.id} onChange={() => { setCoursChoisi(c.id); setErreur(""); }} />
              <Icone nom="fichier" taille={20} />
              <span style={{ flex: 1 }}>
                {c.titre}
                {c.detail && <span className="discret petit"> · {c.detail}</span>}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <>
          <ZoneDepot envoi={envoi} onChange={(e) => { setEnvoi(e); setErreur(""); }} />
          <p className="discret petit" style={{ marginTop: 10 }}>
            Le cours sera aussi rangé dans Mes cours.
          </p>
        </>
      )}

      <div className="reglages">
        <div>
          <span className="reglage-titre">Nombre de questions</span>
          <div className="pastilles">
            {NOMBRES.map((n) => (
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
        {source === "nouveau" && dossiers.length > 0 && (
          <div>
            <label className="reglage-titre" htmlFor="ranger-dans">
              Ranger le cours dans
            </label>
            <select id="ranger-dans" className="champ" style={{ width: "auto", minWidth: 200 }} value={dossier} onChange={(e) => setDossier(e.target.value)}>
              <option value="">Aucun dossier</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {source === "existant" && choisiInfos && choisiInfos.nbQcm > 0 && (
        <p className="discret petit">
          <Icone nom="coche" taille={16} /> Tu as déjà {choisiInfos.nbQcm} QCM sur ce cours : l&apos;IA posera d&apos;autres questions.
        </p>
      )}
      <ChoixModeIA valeur={mode} onChange={setMode} photos={photos} lecturePhotos={lecturePhotos} />
      <button type="button" className="bouton principal" onClick={generer}>
        <Icone nom="crayon" /> Générer mon QCM
      </button>
      {erreur && (
        <p className="erreur" role="alert">
          <Icone nom="croix" /> {erreur}
        </p>
      )}
    </div>
  );
}
