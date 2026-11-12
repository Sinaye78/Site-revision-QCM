import type { NextConfig } from "next";

/**
 * BASE_PATH permet de servir le site dans un sous-dossier d'un domaine
 * existant, par exemple https://mon-domaine.fr/revision → BASE_PATH=/revision.
 * Attention : la valeur est figée au moment du `npm run build`.
 */
const basePath = (process.env.BASE_PATH || "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
