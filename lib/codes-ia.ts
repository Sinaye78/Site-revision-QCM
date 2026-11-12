/**
 * Refus de l'IA : à la place d'un QCM (ou, plus tard, d'un cours remis en
 * forme), elle peut répondre
 *   { "erreur": "01", "commentaire": "La photo est floue en bas de page." }
 * - « erreur » : un code ci-dessous, pour que le site sache de quoi il s'agit ;
 * - « commentaire » : une phrase libre, écrite par l'IA pour l'élève. S'il est
 *   présent, c'est lui qui est affiché ; sinon, le message prévu pour le code.
 *
 * - « quand » : la règle donnée à l'IA (recopiée dans sa documentation) ;
 * - « message » : ce que le site affiche si l'IA n'a pas mis de commentaire.
 */
export const CODES_IA = {
  "00": {
    quand: "autre raison qui t'empêche de faire un bon travail (le commentaire est alors obligatoire)",
    message: "L'IA n'a pas pu utiliser ce cours.",
  },
  "01": {
    quand: "le document est illisible : photo floue, trop sombre, coupée, écriture impossible à lire",
    message: "L'IA n'arrive pas à lire ce document. Reprends la photo plus nette, bien droite et avec plus de lumière.",
  },
  "02": {
    quand: "le document n'est pas un cours : facture, publicité, page vide, image sans texte, sujet sans rapport avec l'école",
    message: "Ce document ne ressemble pas à un cours. Vérifie que tu as envoyé le bon fichier.",
  },
  "03": {
    quand: "le cours est trop court ou trop pauvre pour faire au moins 3 questions sérieuses",
    message: "Le cours est trop court pour en faire un QCM. Ajoute d'autres pages ou un autre chapitre.",
  },
  "04": {
    quand: "le contenu est inapproprié pour un élève (violence gratuite, contenu adulte, haine)",
    message: "Ce document ne peut pas être utilisé pour réviser.",
  },
  "05": {
    quand: "le cours mélange plusieurs sujets sans lien et il est impossible d'en faire un ensemble cohérent",
    message: "Ce document mélange trop de sujets différents. Envoie un seul chapitre à la fois.",
  },
} as const;

export type CodeIA = keyof typeof CODES_IA;

export function estCodeIA(v: unknown): v is CodeIA {
  return typeof v === "string" && v in CODES_IA;
}

/** Le texte des codes, tel qu'il est écrit dans la documentation donnée à l'IA. */
export function codesPourIA(): string {
  return Object.entries(CODES_IA)
    .map(([code, { quand }]) => `- "${code}" : ${quand}`)
    .join("\n");
}
