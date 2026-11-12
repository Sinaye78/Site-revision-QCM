import { createHash } from "node:crypto";
import { demanderJson, premiersProblemes } from "./ia";
import { sectionRefus } from "./consignes-ia";
import { FicheSchema, placerImages, type Bloc, type Fiche } from "./fiche";
import type { ExecutionIA } from "./taches-types";

/**
 * Retouche d'une fiche par l'IA, à la demande de l'élève (« refais la mise en
 * page », « simplifie », « ajoute des exemples »…). Le résultat est une
 * proposition : l'élève la garde ou la refuse. Ce que l'IA ajoute et qui ne
 * vient pas du cours est marqué « ajout_ia ».
 */
export const MAX_CONSIGNE = 500;
const TAILLE_UN_SEUL_APPEL = 24_000;


export function consigneSystemeRetouche(): string {
  return `Tu es un professeur qui retouche la fiche de révision d'un élève, à SA demande. On te donne la fiche (ou une de ses parties) au format JSON.

RÈGLES
1. Applique la demande de l'élève du mieux possible.
2. Garde tout le contenu du cours (notions, dates, définitions, formules, exemples), sauf si la demande dit clairement de raccourcir ou de résumer.
3. N'invente jamais une information en la présentant comme venant du cours. Si la demande oblige à ajouter du contenu qui n'est pas dans la fiche (un exemple, une explication en plus, une anecdote…), mets "ajout_ia": true sur CHAQUE bloc ajouté. Une reformulation ou une traduction n'est pas un ajout.
4. Les blocs "image" ont un numéro "image" : tu peux les déplacer ou changer leur légende, mais jamais en inventer, ni changer leur numéro.
5. Types de blocs autorisés : "paragraphe" (texte), "liste" (elements), "definition" (terme, texte), "important" (texte), "date" (date, texte), "formule" (texte, explication), "exemple" (texte), "image" (image, legende).
6. Entoure de **doubles étoiles** les mots-clés à surligner, avec modération.
7. Écris dans la langue demandée par l'élève, sinon dans la langue de la fiche.

FORMAT DE RÉPONSE
Réponds uniquement avec un objet JSON valide, sans texte autour, de la même forme que la fiche reçue :
{ "titre": "...", "matiere": "...", "resume": "...", "sections": [ { "titre": "...", "blocs": [ { "type": "paragraphe", "texte": "..." }, { "type": "exemple", "texte": "...", "ajout_ia": true } ] } ], "mots_cles": ["..."] }

${sectionRefus("faire cette retouche", "une fiche abîmée")}
Si la demande n'a rien à voir avec la fiche ou n'est pas adaptée à un élève, refuse avec le code "00" ou "04" et explique pourquoi.`;
}

/** La fiche telle que l'IA la voit : les images deviennent des numéros (elle ne peut pas en inventer). */
export function ficheVersIA(fiche: Fiche): { pourIA: Omit<Fiche, "illustrations">; images: string[] } {
  const images: string[] = [];
  const sections = fiche.sections.map((s) => ({
    ...s,
    blocs: s.blocs.map((b): Bloc => {
      if (b.type !== "image" || !b.fichier) return b;
      let n = images.indexOf(b.fichier);
      if (n < 0) n = images.push(b.fichier) - 1;
      return { type: "image", image: n + 1, legende: b.legende, ...(b.ajout_ia ? { ajout_ia: true } : {}) };
    }),
  }));
  const { illustrations: _illustrations, ...reste } = fiche;
  return { pourIA: { ...reste, sections }, images };
}

function consigneUtilisateurRetouche(demande: string, morceau: object, partie: string, cours: string): string {
  const parties = [
    `DEMANDE DE L'ÉLÈVE : « ${demande.trim().slice(0, MAX_CONSIGNE)} »`,
    partie,
    `FICHE ACTUELLE (JSON) :\n${JSON.stringify(morceau)}`,
  ];
  if (cours) parties.push(`COURS D'ORIGINE, pour vérifier ce qui vient vraiment du cours (ne le recopie pas en entier) :\n"""\n${cours}\n"""`);
  parties.push("Rappel : réponds uniquement avec le JSON de la fiche retouchée.");
  return parties.join("\n\n");
}

function verifierFiche(brut: unknown): { ok: Fiche } | { erreur: string } {
  const r = FicheSchema.safeParse(brut);
  return r.success ? { ok: r.data } : { erreur: `format incorrect : ${premiersProblemes(r.error.issues)}` };
}

/** Démo sans IA : ajoute un exemple marqué, pour voir l'aperçu et le bouton « Garder ». */
function retoucheDemo(fiche: Fiche, section?: number): Fiche {
  const cible = section ?? 0;
  return {
    ...fiche,
    sections: fiche.sections.map((s, i) =>
      i === cible ? { ...s, blocs: [...s.blocs, { type: "exemple", texte: "Exemple ajouté en mode démo (sans IA) : il serait marqué comme ajout de l'IA.", ajout_ia: true }] } : s
    ),
  };
}

export async function retoucherFiche(
  opts: { fiche: Fiche; demande: string; section?: number; texteCours: string } & ExecutionIA
): Promise<{ fiche: Fiche; fournisseur: string }> {
  const { fiche, demande, section } = opts;
  if (section !== undefined && !fiche.sections[section]) throw new Error("Cette partie de la fiche n'existe plus.");
  if (process.env.IA_DEMO === "1") {
    await new Promise((r) => setTimeout(r, 2000));
    return { fiche: retoucheDemo(fiche, section), fournisseur: "démo" };
  }
  const { pourIA, images } = ficheVersIA(fiche);
  const local = opts.mode === "local";
  // Le cours d'origine aide l'IA rapide à ne rien perdre ; l'IA locale a trop peu de mémoire pour lui.
  const cours = local ? "" : opts.texteCours.slice(0, 15_000);
  const appeler = async (morceau: object, partie: string, numero: number) => {
    const consigne = consigneUtilisateurRetouche(demande, morceau, partie, cours);
    const empreinte = createHash("sha256").update(`retouche-v1:${consigne}`).digest("hex");
    const deja = FicheSchema.safeParse(opts.reprise?.lire(numero, empreinte));
    if (deja.success) return { resultat: deja.data, fournisseur: "reprise" };
    const r = await demanderJson<Fiche>({
      systeme: consigneSystemeRetouche(),
      consigne,
      images: [],
      verifier: verifierFiche,
      echec: "L'IA n'a pas réussi à retoucher ta fiche. Réessaie dans une minute.",
      execution: opts,
    });
    opts.reprise?.ecrire(numero, empreinte, r.resultat);
    return r;
  };

  let sections: Fiche["sections"];
  let entete = { titre: fiche.titre, matiere: fiche.matiere, resume: fiche.resume, mots_cles: fiche.mots_cles };
  let fournisseur = "";
  if (section !== undefined) {
    const r = await appeler({ ...pourIA, sections: [pourIA.sections[section]] }, `Ne retouche que cette partie (n°${section + 1}). Tu peux la découper en plusieurs parties.`, 0);
    fournisseur = r.fournisseur;
    sections = [...fiche.sections.slice(0, section), ...r.resultat.sections, ...fiche.sections.slice(section + 1)].slice(0, 40);
  } else if (!local && JSON.stringify(pourIA).length <= TAILLE_UN_SEUL_APPEL) {
    const r = await appeler(pourIA, "Retouche toute la fiche.", 0);
    fournisseur = r.fournisseur;
    sections = r.resultat.sections;
    entete = { titre: r.resultat.titre, matiere: r.resultat.matiere || fiche.matiere, resume: r.resultat.resume, mots_cles: r.resultat.mots_cles };
  } else {
    // Fiche longue ou IA locale : une partie à la fois, chaque partie gardée pour une éventuelle reprise.
    sections = [];
    for (let i = 0; i < pourIA.sections.length; i++) {
      opts.suivi?.({ fournisseur: local ? "Ollama" : undefined, phase: "generation", unite: "partie", partiesFaites: i, partiesTotal: pourIA.sections.length });
      const r = await appeler(
        { ...pourIA, sections: [pourIA.sections[i]] },
        `La fiche compte ${pourIA.sections.length} parties ; voici la partie ${i + 1}. Retouche-la en suivant la demande, sans résumer les autres.`,
        i
      );
      fournisseur = r.fournisseur;
      sections.push(...r.resultat.sections);
    }
    sections = sections.slice(0, 40);
  }

  const brute: Fiche = { ...entete, sections, illustrations: fiche.illustrations ?? [] };
  // Remet les vrais fichiers à la place des numéros, retire les images inventées ou en double.
  const reconstruite = placerImages(brute, images, fiche.illustrations ?? []);
  if (!reconstruite.sections.length) throw new Error("La retouche a vidé la fiche : elle n'a pas été gardée.");
  return { fiche: FicheSchema.parse(reconstruite), fournisseur };
}
