import { redirect } from "next/navigation";

/** Ancienne adresse : l'historique est devenu « Mes QCM ». */
export default function AncienHistorique() {
  redirect("/mes-qcm");
}
