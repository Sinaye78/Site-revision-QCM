import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import JSZip from "jszip";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-lot2-"));
process.env.AUTH_SECRET = "secret-pour-tests-uniquement";
import {
  creerInvite, creerCours, lireCours, enregistrerFiche, listerVersionsFiche, restaurerVersionFiche, VERSIONS_MAX,
  enregistrerProposition, lireProposition, deciderProposition, fichierAppartientA, supprimerCours,
} from "../lib/db";
import { lireFichier, rangerFichier } from "../lib/fichiers";
import { enDocx, enMarkdown, ficheEnElements, qcmEnElements, tailleImage } from "../lib/export";
import { ficheVersIA, retoucherFiche } from "../lib/retouche";
import { extraireContenu } from "../lib/extraction";
import type { Fiche } from "../lib/fiche";
import type { Quiz } from "../lib/quiz";

const PNG_1x1 = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000030806000000", "hex");

function fiche(titre: string, illustration?: string): Fiche {
  return {
    titre, matiere: "SVT", resume: "Résumé.", mots_cles: ["cellule"],
    illustrations: illustration ? [{ fichier: illustration, nom: "schéma" }] : [],
    sections: [{ titre: "La cellule", blocs: [
      { type: "paragraphe", texte: "La **cellule** est l'unité du vivant." },
      { type: "definition", terme: "Noyau", texte: "Contient l'ADN." },
      ...(illustration ? [{ type: "image" as const, fichier: illustration, legende: "Schéma d'une cellule" }] : []),
      { type: "liste", elements: ["Membrane", "Cytoplasme"] },
    ] }],
  };
}

function nouveauCours() {
  const u = creerInvite();
  const id = creerCours(u.id, { titre: "Cours", titreAuto: false, source: "Texte", texte: "Texte du cours ".repeat(20), fichiers: [], dossierId: null });
  return { u, id };
}

test("chaque nouvelle fiche garde l'ancienne dans l'historique, qu'on peut remettre", () => {
  const { u, id } = nouveauCours();
  enregistrerFiche(u.id, id, fiche("V1"));
  enregistrerFiche(u.id, id, fiche("V2"), "main");
  assert.equal(lireCours(u.id, id)!.fiche!.titre, "V2");
  const versions = listerVersionsFiche(u.id, id);
  assert.deepEqual(versions.map((v) => [v.titre, v.origine]), [["V1", "ia"]]);
  assert.equal(restaurerVersionFiche(creerInvite().id, id, versions[0].id), false);
  assert.equal(restaurerVersionFiche(u.id, id, versions[0].id), true);
  assert.equal(lireCours(u.id, id)!.fiche!.titre, "V1");
  assert.deepEqual(listerVersionsFiche(u.id, id).map((v) => [v.titre, v.origine]), [["V2", "main"]]);
});

test("l'historique est limité et les illustrations qui ne servent plus sont effacées", () => {
  const { u, id } = nouveauCours();
  const image = rangerFichier(PNG_1x1, "png")!;
  enregistrerFiche(u.id, id, fiche("Avec image", image));
  assert.equal(fichierAppartientA(u.id, image), true);
  for (let i = 0; i < VERSIONS_MAX; i++) enregistrerFiche(u.id, id, fiche(`Sans image ${i}`));
  // La version avec l'image est encore dans l'historique : le fichier reste.
  assert.ok(lireFichier(image));
  enregistrerFiche(u.id, id, fiche("Encore une"));
  assert.equal(listerVersionsFiche(u.id, id).length, VERSIONS_MAX);
  assert.equal(lireFichier(image), null);
});

test("une proposition de l'IA se garde ou se refuse, et la fiche gardée passe dans l'historique", () => {
  const { u, id } = nouveauCours();
  enregistrerFiche(u.id, id, fiche("Actuelle"));
  enregistrerProposition(u.id, id, fiche("Retouchée"), "Simplifie");
  assert.equal(lireProposition(u.id, id)!.consigne, "Simplifie");
  assert.equal(deciderProposition(u.id, id, true), true);
  assert.equal(lireCours(u.id, id)!.fiche!.titre, "Retouchée");
  assert.equal(lireProposition(u.id, id), null);
  assert.equal(listerVersionsFiche(u.id, id)[0].titre, "Actuelle");
  enregistrerProposition(u.id, id, fiche("Refusée"), "Traduis");
  assert.equal(deciderProposition(u.id, id, false), true);
  assert.equal(lireCours(u.id, id)!.fiche!.titre, "Retouchée");
  assert.equal(deciderProposition(u.id, id, false), false);
});

test("supprimer un cours efface aussi les illustrations de ses anciennes versions", () => {
  const { u, id } = nouveauCours();
  const image = rangerFichier(PNG_1x1, "png")!;
  enregistrerFiche(u.id, id, fiche("Avec image", image));
  enregistrerFiche(u.id, id, fiche("Sans image"));
  assert.ok(lireFichier(image));
  supprimerCours(u.id, id);
  assert.equal(lireFichier(image), null);
});

test("l'IA voit les images comme des numéros, et la démo marque son ajout", async () => {
  const image = rangerFichier(PNG_1x1, "png")!;
  const f = fiche("Cellule", image);
  const { pourIA, images } = ficheVersIA(f);
  assert.deepEqual(images, [image]);
  assert.deepEqual(pourIA.sections[0].blocs[2], { type: "image", image: 1, legende: "Schéma d'une cellule" });
  assert.equal("illustrations" in pourIA, false);
  process.env.IA_DEMO = "1";
  try {
    const { fiche: retouchee } = await retoucherFiche({ fiche: f, demande: "Ajoute un exemple", texteCours: "" });
    const dernier = retouchee.sections[0].blocs.at(-1)!;
    assert.equal(dernier.type, "exemple");
    assert.equal(dernier.ajout_ia, true);
  } finally {
    delete process.env.IA_DEMO;
  }
});

test("la fiche s'exporte en Markdown et en Word, avec ses images", async () => {
  const image = rangerFichier(PNG_1x1, "png")!;
  const f = fiche("Cellule", image);
  const md = enMarkdown(ficheEnElements(f, "La cellule"));
  assert.match(md, /^# La cellule\n/);
  assert.match(md, /## 1\. La cellule/);
  assert.match(md, /\*\*Noyau\*\* : Contient l'ADN\./);
  assert.match(md, /- Membrane\n- Cytoplasme\n/);
  const docx = await enDocx(ficheEnElements(f, "La cellule"), "La cellule");
  const zip = await JSZip.loadAsync(docx);
  const document = await zip.file("word/document.xml")!.async("string");
  assert.match(document, /La cellule/);
  assert.match(document, /<w:b\/><w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">cellule<\/w:t>/);
  assert.match(document, /r:embed="rIdImage1"/);
  assert.ok(zip.file("word/media/image1.png"));
  assert.match(await zip.file("[Content_Types].xml")!.async("string"), /Extension="png"/);
  assert.deepEqual(tailleImage(PNG_1x1, "png"), { l: 2, h: 3 });
  // Un vrai lecteur de .docx (celui qu'utilise le site pour les cours Word) sait le relire.
  const mammoth = await import("mammoth");
  const relu = await mammoth.extractRawText({ buffer: docx });
  assert.match(relu.value, /Noyau : Contient l'ADN\./);
});

test("le QCM exporté donne le sujet puis le corrigé, sans les questions signalées", () => {
  const quiz: Quiz = {
    titre: "Volcans", matiere: "SVT",
    questions: [
      { question: "Qu'est-ce que le magma ?", choix: ["Roche fondue", "Eau", "Gaz", "Sable"], bonne_reponse: 0, explication: "C'est de la roche fondue.", extrait: "", page: 2 },
      { question: "Question fausse ?", choix: ["a", "b", "c", "d"], bonne_reponse: 1, explication: "x", extrait: "", signalee: true },
    ],
  };
  const md = enMarkdown(qcmEnElements(quiz, "Volcans"));
  assert.match(md, /### 1\. Qu'est-ce que le magma \?/);
  assert.match(md, /☐  A\. Roche fondue/);
  assert.doesNotMatch(md, /Question fausse/);
  assert.match(md, /## Corrigé[\s\S]*\*\*1\. A\*\* — Roche fondue[\s\S]*\(cours, page 2\)/);
});

/** Un PDF d'une page qui ne contient qu'une image, comme un cours scanné. */
function pdfScanne(): Buffer {
  const l = 800, h = 600;
  const pixels = Buffer.alloc(l * h * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37) % 251;
  const image = zlib.deflateSync(pixels);
  const contenu = Buffer.from("q 595 0 0 446 0 200 cm /Im1 Do Q");
  const objets = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>"),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${l} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`), image, Buffer.from("\nendstream")]),
    Buffer.concat([Buffer.from(`<< /Length ${contenu.length} >>\nstream\n`), contenu, Buffer.from("\nendstream")]),
  ];
  const morceaux: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const positions: number[] = [];
  let taille = morceaux[0].length;
  objets.forEach((o, i) => {
    positions.push(taille);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
    morceaux.push(b);
    taille += b.length;
  });
  const xref = `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${taille}\n%%EOF\n`;
  morceaux.push(Buffer.from(xref));
  return Buffer.concat(morceaux);
}

test("un PDF scanné devient une page en image, lue comme une photo", async () => {
  const fichier = new File([new Uint8Array(pdfScanne())], "cours-scanne.pdf", { type: "application/pdf" });
  const c = await extraireContenu([fichier], "");
  assert.equal(c.texte, "");
  assert.equal(c.images.length, 1);
  assert.match(c.images[0], /^data:image\/png;base64,/);
  assert.deepEqual(c.originaux.map((o) => [o.nom, o.extension]), [["cours-scanne - page 1.png", "png"], ["cours-scanne.pdf", "pdf"]]);
});

test("les formats inconnus et les anciens Office sont expliqués à l'élève", async () => {
  await assert.rejects(extraireContenu([new File(["x"], "cours.ppt")], ""), /ancien format Office/);
  await assert.rejects(extraireContenu([new File(["x"], "photo.heic", { type: "image/heic" })], ""), /HEIC/);
  await assert.rejects(extraireContenu([new File(["x"], "musique.mp3", { type: "audio/mpeg" })], ""), /Je ne sais pas lire/);
});
