"use client";

import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";
import { MenuCompte } from "./menu-compte";

/**
 * « Télécharger » : imprimer (ou enregistrer en PDF depuis la fenêtre
 * d'impression), Word ou Markdown. `api` = l'adresse de l'export côté serveur,
 * `imprimer` = la page à imprimer (sinon la page actuelle).
 */
export function MenuExport({ api, imprimer }: { api: string; imprimer?: string }) {
  return (
    <MenuCompte
      classe="menu-export"
      resume={
        <>
          <Icone nom="telecharger" /> <span className="texte-nav">Télécharger</span>
        </>
      }
    >
      {imprimer ? (
        <a className="menu-lien" href={chemin(imprimer)} target="_blank" rel="noreferrer">
          <Icone nom="imprimer" taille={20} /> Imprimer ou PDF
        </a>
      ) : (
        <button type="button" className="menu-lien" onClick={() => window.print()}>
          <Icone nom="imprimer" taille={20} /> Imprimer ou PDF
        </button>
      )}
      <a className="menu-lien" href={chemin(`${api}?format=docx`)} download>
        <Icone nom="fichier" taille={20} /> Word (.docx)
      </a>
      <a className="menu-lien" href={chemin(`${api}?format=md`)} download>
        <Icone nom="texte" taille={20} /> Markdown (.md)
      </a>
    </MenuCompte>
  );
}
