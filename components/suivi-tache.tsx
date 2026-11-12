"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { chemin } from "@/lib/chemin";
import type { TachePublique } from "@/lib/taches-types";
import { BoutonPrevenir } from "./veille-taches";
import { LIBELLES_TACHES, lienResultat } from "@/lib/taches-libelles";

export function SuiviTache({ initiale }: { initiale: TachePublique }) {
  const [tache, setTache] = useState(initiale); const [connexion, setConnexion] = useState(true);
  const router = useRouter();
  useEffect(() => {
    if (tache.statut === "termine" && tache.resultatId) {
      router.replace(lienResultat(tache));
      router.refresh();
    }
  }, [tache, router]);
  useEffect(() => {
    if (tache.statut === "termine" || tache.statut === "erreur") return;
    const controle = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const actualiser = async () => {
      try {
        const r = await fetch(chemin(`/api/taches/${initiale.id}`), { cache: "no-store", signal: controle.signal });
        if (r.status === 401) { router.replace("/"); return; }
        if (!r.ok) throw new Error("indisponible");
        setTache(await r.json()); setConnexion(true);
      } catch { if (!controle.signal.aborted) setConnexion(false); }
      if (!controle.signal.aborted) timer = setTimeout(actualiser, 2500);
    };
    void actualiser();
    return () => { controle.abort(); clearTimeout(timer); };
  }, [initiale.id, tache.statut, router]);
  const a = tache.avancement;
  const fini = tache.statut === "termine";
  const local = a?.fournisseur === "Ollama";
  const total = a?.partiesTotal;
  const faites = a?.partiesFaites ?? 0;
  const unite = a?.unite === "question" ? "question" : "partie";
  const mesurable = total !== undefined && total > 0 && (a?.phase === "lecture" || a?.phase === "generation" || a?.phase === "correction");
  const titre = fini ? "C’est prêt !" : tache.statut === "erreur" ? "Le traitement s’est arrêté" : tache.statut === "en_attente" ? "Demande enregistrée" :
    a?.phase === "attente_locale" ? "En attente du serveur de génération" : a?.phase === "lecture" ? (local ? "L’IA locale lit le cours" : "Lecture du document") : a?.phase === "validation" ? "Vérification du résultat" : a?.phase === "enregistrement" ? "Enregistrement" : a?.phase === "correction" ? "L’IA vérifie sa réponse" : LIBELLES_TACHES[tache.type].travail;
  return <section className="carte suivi-tache" aria-labelledby="titre-traitement">
    <p className="discret">{LIBELLES_TACHES[tache.type].nom} · {tache.titre}</p>
    {tache.mode && <p className="petit discret">Mode choisi : <strong>{tache.mode === "local" ? "Sans quota" : "Rapide"}</strong></p>}
    <h1 id="titre-traitement">{titre}</h1>
    {tache.statut === "erreur" ? <><p role="alert">{tache.erreur}</p><Link href={`/cours/${tache.coursId}`} className="bouton">Revenir au cours pour réessayer</Link></> : <>
      <div className="suivi-barre" aria-live="polite">
        {mesurable ? <><progress max={total} value={faites} aria-label={unite === "question" ? "Questions validées" : "Parties du cours terminées"} /><p><strong>{Math.floor(faites / total * 100)} %</strong> · {faites} {unite}{faites > 1 ? "s" : ""} sur {total} {unite === "question" ? "validée" : "terminée"}{faites > 1 ? "s" : ""}</p><p className="petit discret">Ce pourcentage mesure les {unite === "question" ? "questions validées" : "parties traitées"}, pas le temps restant.</p></> : <progress max={1} {...(fini ? { value: 1 } : {})} aria-label={titre} />}
        {a?.caracteres !== undefined && <p className="petit discret">{a.caracteres.toLocaleString("fr-FR")} caractères rédigés pour la partie actuelle.</p>}
      </div>
      {fini ? <p>Le résultat est enregistré. Ouverture en cours…</p> : tache.statut === "en_attente" || a?.phase === "attente_locale" ? <p>Le traitement commencera dès que le service sera disponible.</p> : local ? <p>{tache.mode === "local" ? "Ton contenu est préparé sans utiliser de quota IA." : "Une IA locale a pris le relais sans utiliser de quota IA supplémentaire."} Cela peut prendre plusieurs minutes.</p> : <p>Le serveur travaille sur ta demande.</p>}
      {!fini && <BoutonPrevenir />}
      {!fini && <p className="suivi-fermeture">Tu peux fermer cette page : le traitement continue. Tu retrouveras le résultat dans <Link href="/traitements">Mes traitements</Link>.</p>}
      {!connexion && <p role="status">La progression ne peut pas être actualisée pour le moment. La demande reste enregistrée ; la reconnexion est automatique.</p>}
    </>}
    <p style={{ marginTop: 24 }}><Link href="/traitements">Tous mes traitements</Link> · <Link href={`/cours/${tache.coursId}`}>Mon cours</Link></p>
  </section>;
}
