export type TypeTache = "fiche" | "qcm" | "retouche" | "controle" | "correction";
export type ModeIA = "local" | "rapide";
export type AvancementIA = {
  fournisseur?: string;
  unite?: "question" | "partie";
  phase: "attente_locale" | "lecture" | "generation" | "correction" | "validation" | "enregistrement";
  partiesFaites?: number;
  partiesTotal?: number;
  caracteres?: number;
};
export type SuiviIA = (avancement: AvancementIA) => void;
export type RepriseIA = {
  lire: (numero: number, empreinte: string) => unknown | null;
  ecrire: (numero: number, empreinte: string, resultat: unknown) => void;
};
export type ExecutionIA = { mode?: ModeIA; suivi?: SuiviIA; reprise?: RepriseIA; signal?: AbortSignal };
export type TachePublique = {
  id: string; coursId: string; titre: string; type: TypeTache; mode: ModeIA | null;
  statut: "en_attente" | "en_cours" | "termine" | "erreur";
  avancement: AvancementIA | null; resultatId: string | null; erreur: string | null;
  creeLe: number; modifieLe: number;
};
