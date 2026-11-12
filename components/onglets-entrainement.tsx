import Link from "next/link";
import { Icone } from "./icones";

/** Onglets « QCM / Contrôles » en haut des deux listes d'entraînement. */
export function OngletsEntrainement({ actif }: { actif: "qcm" | "controles" }) {
  return (
    <div className="onglets" role="tablist" style={{ marginBottom: 18 }}>
      <Link href="/mes-qcm" role="tab" className="onglet" aria-selected={actif === "qcm"}>
        <Icone nom="qcm" taille={20} /> QCM
      </Link>
      <Link href="/controles" role="tab" className="onglet" aria-selected={actif === "controles"}>
        <Icone nom="crayon" taille={20} /> Contrôles
      </Link>
    </div>
  );
}
