/**
 * Logos de Discord et Google redessinés « au feutre », dans la DA du site :
 * trait un peu tremblé, hachures de crayon de couleur, mais leurs couleurs.
 */

/** Petites hachures de crayon (motif SVG) réutilisées dans le remplissage. */
function Hachures({ id, couleur }: { id: string; couleur: string }) {
  return (
    <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="3" height="3" fill={couleur} />
      <line x1="0" y1="0" x2="0" y2="3" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
    </pattern>
  );
}

export function LogoDiscord({ taille = 40 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <Hachures id="hachures-discord" couleur="#5865f2" />
      </defs>
      {/* Pastille ronde, comme collée */}
      <path
        d="M24 2.8c11.9-.2 21.4 9.4 21.2 21.3-.2 11.6-9.8 21-21.4 20.9C12 44.9 2.6 35.4 2.9 23.6 3.1 12 12.4 3 24 2.8z"
        fill="url(#hachures-discord)"
        stroke="#1d2b55"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Tête de manette */}
      <path
        d="M13.4 16.9c2.4-1.8 4.9-2.6 6.4-2.9l.8 1.6c2.2-.4 4.6-.4 6.8 0l.8-1.6c1.6.3 4 1.1 6.4 2.9 2.3 4.3 3.3 8.7 3 13.1-2.6 2-5.2 3.1-7.7 3.8l-1.6-2.4c1-.4 1.9-.8 2.7-1.4-3.9 1.9-8.9 1.9-12.8 0 .8.6 1.7 1 2.7 1.4l-1.6 2.4c-2.5-.7-5.1-1.8-7.7-3.8-.4-4.9.8-9.2 2.8-13.1z"
        fill="#ffffff"
        stroke="#1d2b55"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="19.4" cy="24.6" rx="2.2" ry="2.5" fill="#5865f2" stroke="#1d2b55" strokeWidth="1.4" />
      <ellipse cx="28.6" cy="24.6" rx="2.2" ry="2.5" fill="#5865f2" stroke="#1d2b55" strokeWidth="1.4" />
    </svg>
  );
}

export function LogoGoogle({ taille = 40 }: { taille?: number }) {
  // Le « G » en quatre morceaux de couleur, tracés comme au crayon épais.
  const trait = { fill: "none", strokeWidth: 6.5, strokeLinecap: "round" as const };
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M24 2.8c11.9-.2 21.4 9.4 21.2 21.3-.2 11.6-9.8 21-21.4 20.9C12 44.9 2.6 35.4 2.9 23.6 3.1 12 12.4 3 24 2.8z"
        fill="#ffffff"
        stroke="#1d2b55"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Contour bleu marine sous les couleurs, pour l'effet feutre */}
      <path d="M33.6 15.4A13 13 0 1 0 37 24.3H25.2" fill="none" stroke="#1d2b55" strokeWidth="9.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33.6 15.4A13 13 0 0 0 11.6 19.8" {...trait} stroke="#ea4335" />
      <path d="M11.6 19.8A13 13 0 0 0 13.4 31.6" {...trait} stroke="#fbbc05" />
      <path d="M13.4 31.6A13 13 0 0 0 34.2 32.4" {...trait} stroke="#34a853" />
      <path d="M34.2 32.4A13 13 0 0 0 37 24.3H25.6" {...trait} stroke="#4285f4" strokeLinejoin="round" />
    </svg>
  );
}
