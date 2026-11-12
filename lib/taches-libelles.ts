import type { TypeTache } from "./taches-types";

/** Comment chaque traitement s'appelle pour l'élève, et où mène son résultat. */
export const LIBELLES_TACHES: Record<TypeTache, { nom: string; quoi: string; travail: string; pret: string; rate: string }> = {
  fiche: { nom: "Fiche de cours", quoi: "Ta fiche", travail: "L’IA prépare ton cours", pret: "est prête", rate: "n’a pas pu être faite" },
  qcm: { nom: "QCM", quoi: "Ton QCM", travail: "L’IA prépare tes questions", pret: "est prêt", rate: "n’a pas pu être fait" },
  retouche: { nom: "Retouche de la fiche", quoi: "La retouche de ta fiche", travail: "L’IA retouche ta fiche", pret: "est prête : à toi de la garder ou non", rate: "n’a pas pu être faite" },
  controle: { nom: "Contrôle", quoi: "Ton contrôle", travail: "L’IA prépare ton sujet", pret: "est prêt", rate: "n’a pas pu être fait" },
  correction: { nom: "Correction de copie", quoi: "La correction de ta copie", travail: "L’IA corrige ta copie", pret: "est prête", rate: "n’a pas pu être faite" },
};

export function lienResultat(t: { type: TypeTache; coursId: string; resultatId: string | null }): string {
  if (t.type === "qcm") return `/qcm/${t.resultatId}`;
  if (t.type === "controle") return `/controles/${t.resultatId}`;
  if (t.type === "correction") return `/copies/${t.resultatId}`;
  if (t.type === "retouche") return `/cours/${t.coursId}?vue=proposition`;
  return `/cours/${t.coursId}?vue=fiche`;
}
