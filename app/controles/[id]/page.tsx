import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireControle, listerCopies } from "@/lib/controles-db";
import { sujetPourEleve } from "@/lib/controle";
import { formaterNote } from "@/lib/quiz";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { FeuilleControle } from "@/components/feuille-controle";
import { MenuExport } from "@/components/menu-export";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export default async function PageControle({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const k = lireControle(u.id, (await params).id);
  if (!k) notFound();
  const copies = listerCopies(u.id, k.id);

  return (
    <main className="feuille">
      <Entete />
      <div className="barre-qcm">
        {k.coursId ? (
          <Link href={`/cours/${k.coursId}`} className="bouton fantome">
            <Icone nom="fichier" /> {k.coursTitre}
          </Link>
        ) : (
          <Link href="/controles" className="bouton fantome">
            <Icone nom="precedent" /> Mes contrôles
          </Link>
        )}
        <MenuExport api={`/api/controles/${k.id}/export`} imprimer={`/controles/${k.id}/imprimer`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h1 style={{ marginBottom: 0 }}>
          <span className="surligne">{k.controle.titre}</span>
        </h1>
        <span className="discret">
          {k.controle.matiere && <span className="etiquette">{k.controle.matiere}</span>}
          <span className={`etiquette diff-${k.difficulte}`}>{k.difficulte}</span>
        </span>
      </div>
      <p className="discret">Contrôle</p>

      {copies.length > 0 && (
        <div className="copies-precedentes">
          <span className="discret petit">Tes copies :</span>
          {copies.slice(0, 5).map((c) => (
            <Link key={c.id} href={`/copies/${c.id}`} className="etiquette lien-copie">
              {c.note !== null ? `${formaterNote(c.note)}/20` : "en correction"} · {dateCourte.format(c.renduLe)}
            </Link>
          ))}
        </div>
      )}

      <FeuilleControle id={k.id} titre={k.controle.titre} dureeMin={k.dureeMin} questions={sujetPourEleve(k.controle)} />
    </main>
  );
}
