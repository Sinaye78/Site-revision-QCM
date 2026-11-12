import Link from "next/link";
import type { LigneCours as InfosCours } from "@/lib/db";
import { formaterNote } from "@/lib/quiz";
import { Icone } from "./icones";
import { OutilsCours } from "./outils-cours";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Une ligne de « Mes cours » : le cours, ses QCM, et les outils pour le ranger. */
export function LigneCours({ cours, dossiers }: { cours: InfosCours; dossiers: { id: string; nom: string }[] }) {
  return (
    <li className="carte ligne-qcm">
      <div className="infos">
        <Link href={`/cours/${cours.id}`} className="titre-qcm">
          {cours.titre}
        </Link>
        <div className="petit discret" style={{ marginTop: 4 }}>
          {cours.matiere && <span className="etiquette">{cours.matiere}</span>}
          {cours.aUneFiche && <span className="etiquette etiquette-fiche">au propre</span>}
          {cours.nbQcm === 0 ? "pas encore de QCM" : `${cours.nbQcm} QCM`} · {dateCourte.format(cours.creeLe)}
        </div>
      </div>
      {cours.meilleur !== null && (
        <div className="mini-note" title="Meilleure note sur ce cours">
          {formaterNote(Math.round(cours.meilleur * 40) / 2)}/20
        </div>
      )}
      <div className="outils-qcm">
        <Link href={`/cours/${cours.id}`} className="bouton">
          <Icone nom="fichier" /> Ouvrir
        </Link>
        <Link href={`/nouveau?cours=${cours.id}`} className="bouton fantome" aria-label="Faire un QCM sur ce cours" title="Faire un QCM sur ce cours">
          <Icone nom="crayon" />
        </Link>
        <OutilsCours cours={cours} dossiers={dossiers} />
      </div>
    </li>
  );
}
