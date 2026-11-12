import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FicheSchema, placerImages, repartirIllustrations, illustrationsNonPlacees, type Fiche } from "../lib/fiche";
import { extraireIllustrations, contextualiserIllustrations } from "../lib/illustrations";
import { rangerFichier } from "../lib/fichiers";
import { genererFiche } from "../lib/ia";
import type { Cours } from "../lib/db";

const donnees = fs.mkdtempSync(path.join(os.tmpdir(), "qcm-images-test-"));
process.env.DATA_DIR = donnees;
const modele = (): Fiche => FicheSchema.parse({ titre: "Les volcans", sections: [
  { titre: "Éruptions effusives", blocs: [{ type: "paragraphe", texte: "Le volcan effusif produit une lave fluide et des coulées de basalte." }] },
  { titre: "Éruptions explosives", blocs: [{ type: "paragraphe", texte: "Le volcan explosif projette des cendres et des nuées ardentes." }] },
] });
const illustrations = [
  { fichier: "effusif.png", nom: "Volcan effusif", avant: "Le volcan effusif produit une lave fluide et des coulees de basalte." },
  { fichier: "explosif.png", nom: "Volcan explosif", avant: "Le volcan explosif projette des cendres et des nuees ardentes." },
];

test("les anciennes illustrations rejoignent leur notion, sans doublon ni modification du texte", () => {
  const source = { ...modele(), illustrations };
  const fiche = repartirIllustrations(source);
  assert.deepEqual(fiche.sections.map(s => s.blocs.map(b => b.type)), [["paragraphe", "image"], ["paragraphe", "image"]]);
  assert.equal((fiche.sections[0].blocs[1] as { fichier: string }).fichier, "effusif.png");
  assert.equal((fiche.sections[1].blocs[1] as { fichier: string }).fichier, "explosif.png");
  assert.equal(illustrationsNonPlacees(fiche).length, 0);
  assert.deepEqual(repartirIllustrations(fiche), fiche);
  assert.equal(source.sections[0].blocs.length, 1);
});

test("un repère APRÈS place l'image avant le passage, les repères inconnus restent disponibles", () => {
  const fiche = repartirIllustrations({ ...modele(), illustrations: [
    { fichier: "avant.png", nom: "Schéma", apres: illustrations[0].avant },
    { fichier: "inconnue.png", nom: "Document sans repère", avant: "un récit de la Révolution française" },
  ] });
  assert.equal(fiche.sections[0].blocs[0].type, "image");
  assert.deepEqual(illustrationsNonPlacees(fiche).map(i => i.fichier), ["inconnue.png"]);
});

test("les numéros renvoyés par l'IA reconstruisent le bon ordre et ne deviennent pas des chemins libres", () => {
  const source = modele();
  source.sections[0].blocs.push({ type: "image", image: 2, legende: "Explosif" });
  source.sections[1].blocs.push({ type: "image", image: 1, legende: "Effusif" }, { type: "image", fichier: "non-autorisee.png", legende: "" });
  const fiche = placerImages(source, ["effusif.png", "explosif.png"], illustrations);
  assert.equal((fiche.sections[0].blocs[1] as { fichier: string }).fichier, "explosif.png");
  assert.equal((fiche.sections[1].blocs[1] as { fichier: string }).fichier, "effusif.png");
  assert.equal(fiche.sections[1].blocs.length, 2);
  assert.equal(illustrationsNonPlacees(fiche).length, 0);
  assert.deepEqual(placerImages(fiche, ["effusif.png", "explosif.png"], illustrations), fiche);
});

for (const extension of ["pdf", "docx"]) test(`les images du ${extension} gardent leurs repères et les anciennes fiches retrouvent les mêmes fichiers`, async () => {
  const contenu = fs.readFileSync(fileURLToPath(new URL(`./fixtures/positions.${extension}`, import.meta.url)));
  const fichier = rangerFichier(contenu, extension)!;
  const cours = { fichiers: [{ fichier, nom: `positions.${extension}`, type: extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }] } as Cours;
  const extraites = await extraireIllustrations(cours);
  assert.equal(extraites.length, 2);
  assert.match(extraites[0].avant!, /effusif/);
  assert.match(extraites[1].avant!, /explosif/);
  assert.ok(extraites.every(i => i.positionConnue));
  const placees = repartirIllustrations({ ...modele(), illustrations: extraites });
  assert.equal((placees.sections[0].blocs.find(b => b.type === "image") as { fichier: string })?.fichier, extraites[0].fichier);
  assert.equal((placees.sections[1].blocs.find(b => b.type === "image") as { fichier: string })?.fichier, extraites[1].fichier);
  const avant = fs.readdirSync(path.join(donnees, "fichiers")).length;
  const anciennes = extraites.map(({ fichier, nom }) => ({ fichier, nom }));
  const retrouvees = await contextualiserIllustrations(cours, anciennes);
  assert.deepEqual(retrouvees.map(i => i.fichier), extraites.map(i => i.fichier));
  assert.ok(retrouvees.every(i => i.avant));
  assert.equal(fs.readdirSync(path.join(donnees, "fichiers")).length, avant);
});

test("une illustration oubliée, dupliquée ou inconnue ne bloque pas une fiche de texte valide", async () => {
  const cles = ["IA_ORDRE", "IA_COMPAT_URL", "IA_COMPAT_MODEL", "IA_COMPAT_VISION", "IA_DEMO"];
  const precedent = Object.fromEntries(cles.map(k => [k, process.env[k]]));
  const vraiFetch = globalThis.fetch;
  Object.assign(process.env, { IA_ORDRE: "compat", IA_COMPAT_URL: "https://example.invalid/test", IA_COMPAT_MODEL: "test", IA_COMPAT_VISION: "0", IA_DEMO: "0" });
  try {
    for (const erreur of ["oubli", "doublon", "inconnu"]) {
      let appels = 0;
      globalThis.fetch = async (_url, init) => {
        appels++;
        const demande = JSON.parse(String(init?.body));
        assert.equal(typeof demande.messages[1].content, "string");
        assert.match(demande.messages[1].content, /AVANT l'image/);
        const fiche = modele();
        if (appels === 1 && erreur === "doublon") fiche.sections[0].blocs.push({ type: "image", image: 1, legende: "" }, { type: "image", image: 1, legende: "" });
        if (appels === 1 && erreur === "inconnu") fiche.sections[0].blocs.push({ type: "image", image: 999, legende: "" });
        if (appels > 1) fiche.sections.forEach((s, i) => s.blocs.push({ type: "image", image: i + 1, legende: "Schéma" }));
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(fiche) } }] }), { status: 200 });
      };
      const { fiche } = await genererFiche({ texte: "Un cours sur les volcans.", images: illustrations.map(i => ({ ...i, photo: false })) });
      assert.equal(appels, 1);
      const reconstruite = placerImages(fiche, illustrations.map(i => i.fichier), illustrations);
      assert.equal(illustrationsNonPlacees(reconstruite).length, 0);
      assert.equal(reconstruite.sections.flatMap(s => s.blocs.filter(b => b.type === "image")).length, 2);
    }
  } finally {
    globalThis.fetch = vraiFetch;
    for (const [cle, valeur] of Object.entries(precedent)) { if (valeur === undefined) delete process.env[cle]; else process.env[cle] = valeur; }
  }
});
