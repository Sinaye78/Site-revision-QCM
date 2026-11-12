"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { LIBELLES_TACHES, lienResultat as lienDe } from "@/lib/taches-libelles";

type Tache = { id: string; titre: string; type: "fiche" | "qcm" | "retouche"; statut: string; coursId: string; resultatId: string | null };
type Avis = { id: string; texte: string; lien: string; ok: boolean };
const CLE_CONNUES = "taches-connues";

const lienResultat = (t: Tache) =>
  t.statut === "termine" && t.resultatId ? lienDe(t) : `/traitements/${t.id}`;

/**
 * Surveille les traitements en cours depuis n'importe quelle page : quand l'un
 * se termine, un post-it apparaît, l'onglet l'annonce dans son titre et, si
 * l'élève l'a accepté, une notification du navigateur s'affiche.
 */
export function VeilleTaches({ actives }: { actives: number }) {
  const router = useRouter();
  const page = usePathname();
  const [avis, setAvis] = useState<Avis[]>([]);
  const connues = useRef<Map<string, string> | null>(null);
  const titreOrigine = useRef<string | null>(null);

  useEffect(() => {
    // L'en-tête est redessiné à chaque page : on garde l'état connu des traitements pour l'onglet.
    if (!connues.current) {
      try {
        const garde = JSON.parse(sessionStorage.getItem(CLE_CONNUES) ?? "null") as [string, string][] | null;
        if (Array.isArray(garde)) connues.current = new Map(garde);
      } catch {
        /* stockage indisponible */
      }
    }
    const attendues = [...(connues.current?.values() ?? [])].some((s) => s === "en_attente" || s === "en_cours");
    if (actives === 0 && !attendues) return;
    let arret = false;
    let minuterie: ReturnType<typeof setTimeout>;

    async function verifier() {
      try {
        const rep = await fetch(chemin("/api/taches"), { cache: "no-store" });
        if (!rep.ok) throw new Error();
        const { taches } = (await rep.json()) as { taches: Tache[] };
        const avant = connues.current;
        const nouveaux: Avis[] = [];
        for (const t of taches) {
          const ancien = avant?.get(t.id);
          const finie = t.statut === "termine" || t.statut === "erreur";
          if (avant && ancien && ancien !== t.statut && finie) {
            const quoi = LIBELLES_TACHES[t.type].quoi;
            nouveaux.push({
              id: t.id,
              ok: t.statut === "termine",
              lien: lienResultat(t),
              texte: `${quoi} « ${t.titre} » ${t.statut === "termine" ? LIBELLES_TACHES[t.type].pret : LIBELLES_TACHES[t.type].rate}.`,
            });
          }
        }
        connues.current = new Map(taches.map((t) => [t.id, t.statut]));
        try {
          sessionStorage.setItem(CLE_CONNUES, JSON.stringify([...connues.current]));
        } catch {
          /* stockage indisponible */
        }
        // La page de suivi de ce traitement s'ouvre déjà toute seule sur le résultat.
        // Inutile de prévenir l'élève qui regarde déjà le suivi ou le résultat (la page de suivi y mène toute seule).
        const ici = window.location.pathname.slice(chemin("").length) || "/";
        const aMontrer = nouveaux.filter((a) => document.hidden || (ici !== `/traitements/${a.id}` && ici !== a.lien.split("?")[0]));
        if (aMontrer.length) {
          setAvis((liste) => [...liste, ...aMontrer]);
          annoncer(aMontrer);
          router.refresh();
        }
        if (taches.some((t) => t.statut === "en_attente" || t.statut === "en_cours")) {
          if (!arret) minuterie = setTimeout(verifier, 4000);
        }
      } catch {
        if (!arret) minuterie = setTimeout(verifier, 10000);
      }
    }

    function annoncer(liste: Avis[]) {
      if (document.hidden) {
        titreOrigine.current ??= document.title;
        document.title = `(${liste.length}) ${liste[0].ok ? "C'est prêt" : "Traitement arrêté"} · ${titreOrigine.current}`;
      }
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          for (const a of liste) {
            const n = new Notification("Révision QCM", { body: a.texte, tag: a.id });
            n.onclick = () => {
              window.focus();
              router.push(a.lien);
            };
          }
        }
      } catch {
        /* notifications indisponibles sur cet appareil */
      }
    }

    void verifier();
    return () => {
      arret = true;
      clearTimeout(minuterie);
    };
  }, [actives, page, router]);

  useEffect(() => {
    function visible() {
      if (!document.hidden && titreOrigine.current) {
        document.title = titreOrigine.current;
        titreOrigine.current = null;
      }
    }
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, []);

  if (!avis.length) return null;
  return (
    <div className="avis-taches" role="status" aria-live="polite">
      {avis.map((a) => (
        <div key={a.id} className={`postit avis-tache${a.ok ? "" : " avis-erreur"}`}>
          <span>
            <Icone nom={a.ok ? "coche" : "croix"} taille={20} /> {a.texte}
          </span>
          <span className="avis-actions">
            <Link href={a.lien} className="bouton" onClick={() => setAvis((l) => l.filter((x) => x.id !== a.id))}>
              {a.ok ? "Ouvrir" : "Voir"}
            </Link>
            <button type="button" className="bouton fantome" aria-label="Fermer" onClick={() => setAvis((l) => l.filter((x) => x.id !== a.id))}>
              <Icone nom="croix" taille={18} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Bouton « Me prévenir quand c'est prêt » : demande la permission d'afficher des notifications. */
export function BoutonPrevenir() {
  const [etat, setEtat] = useState<"inconnu" | "demander" | "accorde" | "refuse">("inconnu");
  useEffect(() => {
    if (!("Notification" in window)) return;
    setEtat(Notification.permission === "granted" ? "accorde" : Notification.permission === "denied" ? "refuse" : "demander");
  }, []);
  if (etat === "inconnu" || etat === "refuse") return null;
  if (etat === "accorde") {
    return (
      <p className="petit discret">
        <Icone nom="cloche" taille={16} /> Tu recevras une notification quand ce sera prêt (si une page du site reste ouverte).
      </p>
    );
  }
  return (
    <button
      type="button"
      className="bouton"
      onClick={async () => {
        try {
          const r = await Notification.requestPermission();
          setEtat(r === "granted" ? "accorde" : r === "denied" ? "refuse" : "demander");
        } catch {
          setEtat("refuse");
        }
      }}
    >
      <Icone nom="cloche" /> Me prévenir quand c&apos;est prêt
    </button>
  );
}
