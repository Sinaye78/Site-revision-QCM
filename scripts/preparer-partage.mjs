import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { racineProjet, verifierPartage } from "./verifier-partage.mjs";

const fichiers = verifierPartage();
const archive = new JSZip();
for (const fichier of fichiers) archive.file(`revision-qcm/${fichier}`, readFileSync(path.join(racineProjet, fichier)));
const sortie = path.join(path.dirname(racineProjet), "revision-qcm-sources.zip");
if (existsSync(sortie)) throw new Error("L’archive existe déjà. La déplacer ou la renommer avant de relancer.");
writeFileSync(sortie, await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), { flag: "wx" });
console.log(`Archive créée : ${sortie} (${fichiers.length} fichiers).`);
