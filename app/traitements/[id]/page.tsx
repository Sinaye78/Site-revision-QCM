import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireTache } from "@/lib/taches-db";
import { Entete } from "@/components/entete";
import { SuiviTache } from "@/components/suivi-tache";
export default async function PageTraitement({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const tache = lireTache(u.id, (await params).id);
  if (!tache) notFound();
  return <main className="feuille"><Entete /><SuiviTache initiale={tache} /></main>;
}
