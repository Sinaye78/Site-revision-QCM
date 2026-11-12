import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { listerTaches } from "@/lib/taches-db";
import { Entete } from "@/components/entete";
import { LIBELLES_TACHES } from "@/lib/taches-libelles";
const STATUTS = { en_attente: "En attente", en_cours: "En cours", termine: "Terminé", erreur: "À relancer" };
export default async function PageTraitements() {
  const u = await exigerConnexion(); const taches = listerTaches(u.id);
  return <main className="feuille"><Entete /><div className="titre-page"><h1><span className="surligne">Mes traitements</span></h1></div>
    <p className="discret">Retrouve ici tes fiches et QCM, même après avoir fermé la page.</p>
    {!taches.length ? <div className="carte"><p>Aucun traitement pour le moment.</p><Link href="/nouveau" className="bouton">Créer un QCM</Link></div> :
      <ul className="taches-liste">{taches.map(t => <li key={t.id} className="carte"><Link href={`/traitements/${t.id}`}><strong>{t.titre}</strong><span>{LIBELLES_TACHES[t.type].nom} · {t.mode ? `${t.mode === "local" ? "Sans quota" : "Rapide"} · ` : ""}{STATUTS[t.statut]}</span></Link></li>)}</ul>}
  </main>;
}
