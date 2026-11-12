/**
 * Icônes dessinées à la main pour le site : trait de stylo arrondi, lignes
 * légèrement imparfaites. Toutes en 24×24, couleur = couleur du texte.
 */
const TRACES = {
  crayon: [
    "M4.2 19.9l1.1-4.5L15.9 4.7a2 2 0 0 1 2.9.1l.5.5a2 2 0 0 1-.1 2.8L8.6 18.7z",
    "M14.1 6.5l3.3 3.4",
    "M5.3 15.5l3.2 3.1",
  ],
  envoyer: [
    "M12.1 15.8V5.1",
    "M7.6 9.3l4.5-4.7 4.3 4.8",
    "M4.4 14.8v3.8c0 .9.7 1.6 1.6 1.6h12c.9 0 1.6-.7 1.6-1.6v-3.9",
  ],
  fichier: [
    "M6.1 3.5h7.4l5 5.1v11c0 .6-.4 1-1 1H6.1c-.6 0-1-.4-1-1V4.5c0-.6.4-1 1-1z",
    "M13.3 3.8v4.9h5",
    "M8.5 12.7h6.8",
    "M8.4 16.2h4.7",
  ],
  photo: [
    "M4.4 5.5h15.1c.6 0 1 .4 1 1v11.1c0 .6-.4 1-1 1H4.4c-.6 0-1-.4-1-1V6.5c0-.6.4-1 1-1z",
    "M3.7 15.7l4.7-4.5 3.8 3.7 2.7-2.5 5 4.5",
    "M15.6 8.4a1.2 1.2 0 1 0 .1 0z",
  ],
  texte: [
    "M8.5 4.6H6.7c-.6 0-1 .4-1 1v14c0 .6.4 1 1 1h10.7c.6 0 1-.4 1-1v-14c0-.6-.4-1-1-1h-1.8",
    "M9.1 3.4h5.9v2.7H9.1z",
    "M8.8 10.6h6.5",
    "M8.8 13.9h6.4",
    "M8.8 17.1h3.9",
  ],
  cahier: [
    "M6.2 3.6h11.4c.6 0 1 .4 1 1v15c0 .6-.4 1-1 1H6.2c-.6 0-1-.4-1-1v-15c0-.6.4-1 1-1z",
    "M8.7 3.8v16.5",
    "M11.6 8.1h4.3",
    "M11.6 11.4h3.1",
  ],
  sortir: [
    "M10.1 4.2H6.3c-.7 0-1.2.5-1.2 1.2v13.2c0 .7.5 1.2 1.2 1.2h3.8",
    "M10.6 12.1h9.1",
    "M16.4 8.4l3.6 3.7-3.7 3.6",
  ],
  coche: ["M4.6 12.9l4.6 4.4L19.7 6.3"],
  croix: ["M6.1 6.3l11.7 11.5", "M17.8 6.1L6.2 17.9"],
  suivant: ["M4.4 12.2h14.8", "M13.6 6.6l5.7 5.6-5.8 5.7"],
  recommencer: ["M19.4 12.5a7.4 7.4 0 1 1-2.3-5.6", "M18.3 3.8l-.7 3.9-3.8-.5"],
  ampoule: [
    "M9.1 17.6h5.9",
    "M10.1 20.6h3.9",
    "M12 3.4a6 6 0 0 0-3.6 10.8c.5.4.7.9.7 1.5v.8h5.8v-.8c0-.6.3-1.1.7-1.5A6 6 0 0 0 12 3.4z",
  ],
  cadenas: [
    "M6.4 10.6h11.2c.6 0 1 .4 1 1v7.8c0 .6-.4 1-1 1H6.4c-.6 0-1-.4-1-1v-7.8c0-.6.4-1 1-1z",
    "M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2.1v2.7",
    "M12 14.2v2.5",
  ],
  poubelle: [
    "M4.6 6.8h14.8",
    "M9.4 6.6V4.6h5.2v2",
    "M6.6 7.1l.9 12.3c.1.6.5 1 1.1 1h6.8c.6 0 1-.4 1.1-1l.9-12.3",
    "M10.2 10.8v6",
    "M13.8 10.8v6",
  ],
  plus: ["M12.1 5.1v13.8", "M5.1 12.1h13.8"],
  lune: ["M19.6 14.6A8 8 0 0 1 9.3 4.5a8.1 8.1 0 1 0 10.3 10.1z"],
  soleil: [
    "M12.1 8.1a3.9 3.9 0 1 0 .1 0z",
    "M12 2.9v2",
    "M12.1 19.1v2",
    "M3 12.1h2",
    "M19 11.9h2",
    "M5.6 5.7l1.4 1.4",
    "M17 17.1l1.4 1.3",
    "M5.7 18.4l1.4-1.4",
    "M17.1 7l1.3-1.4",
  ],
  lettres: ["M3.6 18.4l4.3-11.7 4.2 11.7", "M5.1 14.4h5.6", "M14.4 18.3l2.9-7.6 2.9 7.6", "M15.4 15.7h3.8"],
  qcm: [
    "M4.6 4.7h4.2v4.2H4.6z",
    "M5.5 6.9l1.1 1 1.9-2.4",
    "M11.6 6.8h8.2",
    "M4.6 14.6h4.2v4.2H4.6z",
    "M11.6 16.7h7.4",
  ],
  baguette: ["M4.4 19.6L15.1 8.9", "M13.5 7.4l3 3", "M18.1 3.4v3.1", "M16.6 4.9h3.1", "M20.1 10.6v2.2", "M19 11.7h2.2", "M8.6 3.9v2.4", "M7.4 5.1h2.4"],
  dossier: ["M3.6 7V18.6c0 .6.4 1 1 1h14.8c.6 0 1-.4 1-1V9.4c0-.6-.4-1-1-1h-7.4L10.2 5.7H4.6c-.6 0-1 .4-1 1.3z"],
  precedent: ["M19.6 12.1H4.8", "M10.4 6.5L4.7 12.1l5.8 5.7"],
  renommer: ["M4.3 19.7h15.4", "M13.9 5.3l2.9 2.8-8.2 8.3-3.6.8.8-3.6z"],
  drapeau: ["M5.6 20.6V3.9", "M5.8 4.6c3.7-1.9 6.1 1.6 9.6.1 1.4-.6 2.4-.7 3.2-.5v8.3c-1 .1-1.9.3-3.1.8-3.6 1.4-6-2-9.6-.2"],
  flamme: [
    "M12.1 20.6c-3.7 0-6.4-2.6-6.4-6.1 0-3.1 2.1-5 3.5-7 .3 1.8 1.1 3 2.3 3.6-.2-2.8.9-5.4 3.1-7.6.3 3.1 1.9 4.6 3.1 6.4.7 1.1 1 2.3 1 3.7 0 4-2.9 7-6.6 7z",
    "M12.1 20.4c-1.6 0-2.7-1.2-2.7-2.7 0-1.6 1.2-2.4 2-3.6.9 1.4 3.4 2 3.3 3.8-.1 1.5-1.2 2.5-2.6 2.5z",
  ],
  cartes: [
    "M8.3 6.4h10.2c.6 0 1 .4 1 1v11.4c0 .6-.4 1-1 1H8.3c-.6 0-1-.4-1-1V7.4c0-.6.4-1 1-1z",
    "M4.6 16.3V5.2c0-.6.4-1 1-1h9.8",
    "M10.6 11.3h4.8",
    "M10.6 14.6h3.2",
  ],
  maison: ["M4.1 11.2l7.9-7 7.9 7", "M6.3 9.6v9.8c0 .6.4 1 1 1h3.3v-5.3h2.9v5.3h3.2c.6 0 1-.4 1-1V9.5"],
  menu: ["M4.6 7.1h14.8", "M4.5 12.1h14.9", "M4.6 17.1h14.7"],
  cloche: [
    "M6.4 16.6V11a5.6 5.6 0 0 1 11.2-.1v5.7l1.6 1.5H4.8z",
    "M10.1 20.4c.5.7 1.1 1 1.9 1s1.4-.3 1.9-1",
    "M12 3.1v2.3",
  ],
  retourner: ["M4.6 9.6a7.6 7.6 0 0 1 13.6-2.4", "M18.7 3.7l-.4 3.8-3.7-.6", "M19.4 14.5a7.6 7.6 0 0 1-13.6 2.3", "M5.3 20.4l.4-3.8 3.7.6"],
  lien: ["M10.4 13.6a3.9 3.9 0 0 0 5.6.1l3-3a3.9 3.9 0 0 0-5.5-5.5l-1.3 1.2", "M13.6 10.4a3.9 3.9 0 0 0-5.6-.1l-3 3a3.9 3.9 0 0 0 5.5 5.5l1.2-1.2"],
  telecharger: ["M12.1 4.4v10.7", "M7.6 10.7l4.5 4.7 4.3-4.8", "M4.4 15.1v3.6c0 .9.7 1.6 1.6 1.6h12c.9 0 1.6-.7 1.6-1.6v-3.7"],
  imprimer: ["M7.1 9.2V4.3h9.8v4.9", "M7.2 17.4H5.1c-.6 0-1-.4-1-1v-6.2c0-.6.4-1 1-1h13.8c.6 0 1 .4 1 1v6.2c0 .6-.4 1-1 1h-2.1", "M7.3 14.3h9.4v6.1H7.3z"],
  horloge: ["M12.1 3.6a8.5 8.5 0 1 0 .1 0z", "M12 7.4v4.9l3.1 1.9"],
  haut: ["M12 19.4V5.1", "M6.6 10.4L12 4.9l5.5 5.4"],
  bas: ["M12 4.6v14.3", "M6.5 13.6l5.5 5.5 5.4-5.4"],
  guillemets: [
    "M9.6 7.2c-2.5.8-4 2.6-4 5.3v3.9h4v-3.9H7.5",
    "M18.4 7.2c-2.5.8-4 2.6-4 5.3v3.9h4v-3.9h-2.1",
  ],
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, taille = 24, className }: { nom: NomIcone; taille?: number; className?: string }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {TRACES[nom].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Cercle tracé au stylo autour d'une réponse. */
export function CercleStylo({ couleur }: { couleur: string }) {
  return (
    <svg className="cercle-stylo" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M9 23 C 5 9, 38 3, 62 4 S 98 11, 96 23 S 62 39, 36 37 S 1 31, 11 13"
        fill="none"
        stroke={couleur}
        strokeWidth={2.6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
      />
    </svg>
  );
}

/** Rature rouge sur une mauvaise réponse. */
export function Rature() {
  return (
    <svg className="rature" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M1 12 C 18 8, 34 15, 52 10 S 86 12, 99 8"
        fill="none"
        stroke="var(--stylo-rouge)"
        strokeWidth={2.6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
      />
    </svg>
  );
}

/** Double soulignement à la main, sous la note. */
export function Soulignement() {
  return (
    <svg className="soulignement" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 5 C 30 2, 80 3, 117 4" fill="none" stroke="var(--stylo-rouge)" strokeWidth={2.5} strokeLinecap="round" pathLength={1} />
      <path d="M8 11 C 40 8, 85 9, 112 10" fill="none" stroke="var(--stylo-rouge)" strokeWidth={2.5} strokeLinecap="round" pathLength={1} />
    </svg>
  );
}
