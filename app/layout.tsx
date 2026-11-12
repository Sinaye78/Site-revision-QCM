import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Caveat, Patrick_Hand } from "next/font/google";
import "./globals.css";
import "./revision.css";
import "./cours.css";
import "./controle.css";

const ecriture = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-ecriture", display: "swap" });
const stylo = Caveat({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-stylo", display: "swap" });
// Police très lisible pour lire un cours (conçue pour les lecteurs qui fatiguent vite).
const lecture = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-lecture", display: "swap" });

/**
 * Lu avant l'affichage pour éviter un flash : mode nuit (choix gardé, sinon
 * celui de l'appareil), police et taille de lecture.
 */
const PREFERENCES = `(function(){try{var d=document.documentElement,s=localStorage,t=s.getItem("theme");if(t!=="clair"&&t!=="sombre")t=matchMedia("(prefers-color-scheme: dark)").matches?"sombre":"clair";d.dataset.theme=t;var p=s.getItem("police");if(p)d.dataset.police=p;var z=s.getItem("taille");if(z)d.dataset.taille=z;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "QCM",
  description: "Transforme tes cours en QCM pour réviser.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf3" },
    { media: "(prefers-color-scheme: dark)", color: "#121722" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ecriture.variable} ${stylo.variable} ${lecture.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
