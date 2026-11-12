/**
 * Préfixe du site (ex. "/revision"), ou "" s'il est à la racine du domaine.
 * Les <Link> et router.push le gèrent seuls ; fetch() et les <form> HTML non,
 * d'où cette petite aide.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function chemin(p: string): string {
  return `${BASE}${p}`;
}
