import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { textePptx, texteOdf, texteRtf, texteHtml, titreHtml } from "../lib/formats";
import { adressePublique, verifierAdresse, ErreurLien } from "../lib/lien-web";
import { trouverPage } from "../lib/pages-pdf";

async function zip(fichiers: Record<string, string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [chemin, contenu] of Object.entries(fichiers)) z.file(chemin, contenu);
  return z.generateAsync({ type: "nodebuffer" });
}

test("un PowerPoint donne le texte de chaque diapo dans l'ordre, avec les notes", async () => {
  const diapo = (t: string[]) => `<p:sld><p:txBody>${t.map((x) => `<a:p><a:r><a:t>${x}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sld>`;
  const pptx = await zip({
    "ppt/slides/slide10.xml": diapo(["Conclusion"]),
    "ppt/slides/slide2.xml": diapo(["La cellule", "Le noyau &amp; la membrane"]),
    "ppt/slides/slide1.xml": diapo(["Introduction"]),
    "ppt/notesSlides/notesSlide2.xml": `<p:notes><a:p><a:r><a:t>Insister sur le noyau.</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p></p:notes>`,
  });
  const texte = await textePptx(pptx, "cours.pptx");
  assert.equal(texte, "Diapo 1\nIntroduction\n\nDiapo 2\nLa cellule\nLe noyau & la membrane\nNotes : Insister sur le noyau.\n\nDiapo 10\nConclusion");
});

test("un document LibreOffice garde ses paragraphes et ses titres", async () => {
  const odt = await zip({
    "content.xml": `<office:document-content><office:body><office:text><text:h text:outline-level="1">La photosynthèse</text:h><text:p>Les plantes<text:s/>produisent du <text:span>sucre</text:span>.</text:p><text:p>Elles libèrent du dioxygène.</text:p></office:text></office:body></office:document-content>`,
  });
  assert.equal(await texteOdf(odt, "cours.odt"), "La photosynthèse\nLes plantes produisent du sucre.\nElles libèrent du dioxygène.");
  await assert.rejects(texteOdf(Buffer.from("pas un zip"), "x.odt"), /abîmé/);
});

test("un RTF perd sa mise en forme mais garde ses accents et ses paragraphes", () => {
  const BS = String.fromCharCode(92); // barre oblique inverse, pour écrire la commande RTF « u8217 » telle quelle
  const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}\f0 La R\'e9volution\par {\b 1789} : prise de la Bastille${BS}u8217?s\par}`;
  assert.equal(texteRtf(rtf), "La Révolution\n1789 : prise de la Bastille’s");
});

test("une page web donne son article sans menus ni scripts", () => {
  const html = `<html><head><title>Les volcans &ndash; Wiki</title><script>alert(1)</script></head><body><nav>Accueil Menu</nav><main><h1>Les volcans</h1><p>Un volcan est une ouverture&nbsp;de la croûte.</p><ul><li>Effusif</li><li>Explosif</li></ul></main><footer>Mentions</footer></body></html>`;
  assert.equal(texteHtml(html), "Les volcans\nUn volcan est une ouverture de la croûte.\n- Effusif\n- Explosif");
  assert.equal(titreHtml(html), "Les volcans &ndash; Wiki");
});

test("les liens vers le réseau local ou le serveur lui-même sont refusés", () => {
  for (const ip of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.10", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1"]) {
    assert.equal(adressePublique(ip), false, ip);
  }
  assert.equal(adressePublique("93.184.216.34"), true);
  assert.equal(adressePublique("2606:4700::1111"), true);
  for (const lien of ["http://localhost:11434/api", "http://127.0.0.1/", "ftp://exemple.fr/cours", "https://exemple.fr:3200/", "http://[::1]/", "https://user:mdp@exemple.fr/", "pas un lien"]) {
    assert.throws(() => verifierAdresse(lien), ErreurLien, lien);
  }
  assert.equal(verifierAdresse("https://fr.wikipedia.org/wiki/Volcan").hostname, "fr.wikipedia.org");
});

test("l'extrait d'une question est retrouvé dans la bonne page du PDF", () => {
  const pages = [
    "Chapitre 1. La Révolution française commence en 1789.",
    "Le 14 juillet 1789, le peuple de Paris s'empare de la Bastille. Puis vient la Grande Peur.",
    "Dans la nuit du 4 août, les députés abolissent les privilèges.",
  ];
  assert.equal(trouverPage(pages, "le peuple de Paris s’empare de la Bastille"), 2);
  assert.equal(trouverPage(pages, "Dans la nuit du 4 août, les députés abolissent tous les privilèges féodaux"), 3);
  assert.equal(trouverPage(pages, "Napoléon devient empereur en 1804 à Paris"), null);
  assert.equal(trouverPage(pages, "court"), null);
});
