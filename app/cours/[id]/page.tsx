import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion } from "@/lib/auth";
import { lireCours, lireDossier, listerDossiers, listerQuiz, enregistrerPlacementImages, lireProposition, listerVersionsFiche } from "@/lib/db";
import { illustrationsNonPlacees, repartirIllustrations } from "@/lib/fiche";
import { contextualiserIllustrations } from "@/lib/illustrations";
import { tacheActive } from "@/lib/taches-db";
import { chemin } from "@/lib/chemin";
import { Entete } from "@/components/entete";
import { Icone } from "@/components/icones";
import { FicheCours } from "@/components/fiche-cours";
import { BoutonFiche } from "@/components/bouton-fiche";
import { OutilsCours } from "@/components/outils-cours";
import { LigneQcm } from "@/components/ligne-qcm";
import { ReglagesLecture } from "@/components/reglages-lecture";
import { EditeurFiche } from "@/components/editeur-fiche";
import { BoutonRetouche, DecisionProposition, EditeurTexteCours, HistoriqueFiche } from "@/components/outils-fiche";
import { MenuExport } from "@/components/menu-export";
import { estImageCollee } from "@/lib/ajout-cours";
import { extensionDe, type FichierCours } from "@/lib/fichiers";
import { cartesDeLaFiche } from "@/lib/cartes";
import { iaLitLesImages } from "@/lib/ia";
import { listerControles } from "@/lib/controles-db";
import { formaterNote } from "@/lib/quiz";

/** Le texte collé, avec chaque image remise à la place de son repère « [Image N] ». */
function TexteAvecImages({ texte, collees }: { texte: string; collees: FichierCours[] }) {
  const morceaux = texte.split(/\[Image (\d+)\]/);
  return (
    <div className="carte texte-cours">
      {morceaux.map((m, i) => {
        if (i % 2 === 0) return <span key={i}>{m}</span>;
        const f = collees[Number(m) - 1];
        if (!f) return <span key={i}>[Image {m}]</span>;
        const src = chemin(`/api/fichiers/${f.fichier}`);
        return (
          <a key={i} className="image-dans-texte" href={src} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Image ${m}`} loading="lazy" />
          </a>
        );
      })}
    </div>
  );
}

type Vue = "fiche" | "original" | "proposition" | "modifier";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ vue?: string; page?: string; comparer?: string }> };

export default async function PageCours({ params, searchParams }: Props) {
  const u = await exigerConnexion();
  const { id } = await params;
  const { vue: vueDemandee, page: pageDemandee, comparer } = await searchParams;
  const cours = lireCours(u.id, id);
  if (!cours) notFound();

  const dossier = cours.dossierId ? lireDossier(u.id, cours.dossierId) : null;
  const dossiers = listerDossiers(u.id).map((d) => ({ id: d.id, nom: d.nom }));
  const qcms = listerQuiz(u.id, cours.id);
  const proposition = lireProposition(u.id, cours.id);
  const controles = listerControles(u.id, cours.id);
  // Les images collées avec le texte s'affichent dans le texte ; les autres photos au-dessus.
  const numeroCollee = (f: FichierCours) => Number(f.nom.match(/\d+/)?.[0] ?? 0);
  const collees = cours.fichiers.filter((f) => estImageCollee(f.nom)).sort((a, b) => numeroCollee(a) - numeroCollee(b));
  const images = cours.fichiers.filter((f) => f.type.startsWith("image/") && !estImageCollee(f.nom));
  const pdfs = cours.fichiers.filter((f) => extensionDe(f.fichier) === "pdf");
  const autresDocuments = cours.fichiers.filter((f) => !f.type.startsWith("image/") && extensionDe(f.fichier) !== "pdf");
  const page = Math.max(1, Math.min(5000, Number.parseInt(pageDemandee ?? "1", 10) || 1));

  // Par défaut on montre la fiche si elle existe, sinon le cours d'origine.
  let vue: Vue = cours.fiche ? "fiche" : "original";
  if (vueDemandee === "original") vue = "original";
  else if (vueDemandee === "proposition" && proposition) vue = "proposition";
  else if (vueDemandee === "modifier" && cours.fiche) vue = "modifier";

  const nbCartes = cours.fiche ? cartesDeLaFiche(cours.fiche).length : 0;
  const aDesPhotos = cours.fichiers.some((f) => f.type.startsWith("image/"));
  const retoucheEnCours = tacheActive(u.id, cours.id, "retouche");
  let fiche = cours.fiche;
  if (vue === "fiche" && fiche && illustrationsNonPlacees(fiche).length) {
    const illustrations = await contextualiserIllustrations(cours, fiche.illustrations);
    const ajustee = repartirIllustrations({ ...fiche, illustrations });
    if (JSON.stringify(ajustee) !== JSON.stringify(fiche)) enregistrerPlacementImages(u.id, id, ajustee, cours.ficheLe);
    fiche = ajustee;
  }

  return (
    // « lecture » : feuille blanche sans carreaux, police et taille réglables, pour lire le cours confortablement.
    <main className="feuille lecture">
      <Entete />
      <Link href={dossier ? `/dossiers/${dossier.id}` : "/mes-cours"} className="bouton fantome non-imprime" style={{ marginBottom: 12 }}>
        <Icone nom="precedent" /> {dossier ? dossier.nom : "Mes cours"}
      </Link>

      <div className="titre-page" style={{ alignItems: "flex-start" }}>
        <div>
          <h1>
            <span className="surligne">{cours.titre}</span>
          </h1>
          <div className="petit discret">
            {cours.matiere && <span className="etiquette">{cours.matiere}</span>}
            {/^https?:\/\//.test(cours.source) ? (
              <a href={cours.source} target="_blank" rel="noreferrer nofollow">
                {cours.source.replace(/^https?:\/\//, "").slice(0, 70)}
              </a>
            ) : (
              cours.source
            )}
          </div>
        </div>
        <div className="outils-qcm non-imprime">
          <OutilsCours cours={cours} dossiers={dossiers} apresSuppression={dossier ? `/dossiers/${dossier.id}` : "/mes-cours"} />
        </div>
      </div>

      <div className="pastilles actions-cours non-imprime">
        <Link href={`/nouveau?cours=${cours.id}`} className="bouton principal">
          <Icone nom="crayon" /> Faire un QCM
        </Link>
        <Link href={`/controles/nouveau?cours=${cours.id}`} className="bouton">
          <Icone nom="qcm" /> Faire un contrôle
        </Link>
        <BoutonFiche
          coursId={cours.id}
          dejaFaite={cours.fiche !== null}
          tacheId={tacheActive(u.id, cours.id, "fiche")?.id}
          photos={aDesPhotos}
          lecturePhotos={{ local: iaLitLesImages("local"), rapide: iaLitLesImages("rapide") }}
        />
        {nbCartes > 0 && (
          <Link href={`/cours/${cours.id}/cartes`} className="bouton">
            <Icone nom="cartes" /> Cartes mémoire ({nbCartes})
          </Link>
        )}
      </div>

      {proposition && vue !== "proposition" && (
        <div className="postit bandeau-proposition non-imprime" role="status">
          <span>
            <Icone nom="baguette" /> L&apos;IA a préparé une nouvelle version de ta fiche{proposition.consigne ? ` (« ${proposition.consigne} »)` : ""}.
          </span>
          <Link href={`/cours/${cours.id}?vue=proposition`} className="bouton principal">
            Voir et décider
          </Link>
        </div>
      )}

      <div className="barre-lecture non-imprime">
        {cours.fiche ? (
          <div className="onglets" role="tablist">
            <Link href={`/cours/${cours.id}?vue=fiche`} role="tab" className="onglet" aria-selected={vue === "fiche" || vue === "modifier"}>
              <Icone nom="baguette" taille={20} /> Au propre
            </Link>
            <Link href={`/cours/${cours.id}?vue=original`} role="tab" className="onglet" aria-selected={vue === "original"}>
              <Icone nom="fichier" taille={20} /> Cours d&apos;origine
            </Link>
            {proposition && (
              <Link href={`/cours/${cours.id}?vue=proposition`} role="tab" className="onglet" aria-selected={vue === "proposition"}>
                <Icone nom="ampoule" taille={20} /> Proposition de l&apos;IA
              </Link>
            )}
          </div>
        ) : (
          <span />
        )}
        <ReglagesLecture />
      </div>

      {vue === "fiche" && fiche && (
        <>
          <div className="outils-fiche non-imprime">
            <Link href={`/cours/${cours.id}?vue=modifier`} className="bouton">
              <Icone nom="renommer" /> Modifier
            </Link>
            <BoutonRetouche coursId={cours.id} sections={fiche.sections.map((s) => s.titre)} tacheId={retoucheEnCours?.id} />
            <HistoriqueFiche coursId={cours.id} versions={listerVersionsFiche(u.id, cours.id)} />
            <MenuExport api={`/api/cours/${cours.id}/export`} />
          </div>
          <FicheCours fiche={fiche} />
        </>
      )}

      {vue === "modifier" && cours.fiche && <EditeurFiche coursId={cours.id} fiche={cours.fiche} />}

      {vue === "proposition" && proposition && cours.fiche && (
        <>
          <div className="carte comparaison non-imprime">
            <p style={{ margin: 0 }}>
              <strong>Ta demande :</strong> « {proposition.consigne} »
            </p>
            <p className="discret petit" style={{ margin: "4px 0 12px" }}>
              Compare avec ta fiche actuelle. Ce que l&apos;IA a ajouté et qui n&apos;est pas dans ton cours est encadré « Ajouté par l&apos;IA ». Si tu gardes la nouvelle version, l&apos;ancienne reste dans l&apos;historique.
            </p>
            <div className="comparaison-barre">
              <div className="onglets" role="tablist">
                <Link href={`/cours/${cours.id}?vue=proposition`} role="tab" className="onglet" aria-selected={comparer !== "actuelle"}>
                  Nouvelle version
                </Link>
                <Link href={`/cours/${cours.id}?vue=proposition&comparer=actuelle`} role="tab" className="onglet" aria-selected={comparer === "actuelle"}>
                  Version actuelle
                </Link>
              </div>
              <DecisionProposition coursId={cours.id} />
            </div>
          </div>
          <FicheCours fiche={comparer === "actuelle" ? cours.fiche : proposition.fiche} />
        </>
      )}

      {vue === "original" && (
        <div className="cours-origine">
          {pdfs.map((f, i) => {
            const src = chemin(`/api/fichiers/${f.fichier}?titre=${encodeURIComponent(f.nom)}`);
            return (
              <section key={f.fichier} className="lecteur-pdf" id={i === 0 ? "document" : undefined}>
                <div className="lecteur-pdf-barre">
                  <span>
                    <Icone nom="fichier" taille={20} /> {f.nom}
                    {i === 0 && page > 1 && <span className="etiquette" style={{ marginLeft: 8 }}>page {page}</span>}
                  </span>
                  <a className="bouton fantome" href={`${src}#page=${i === 0 ? page : 1}`} target="_blank" rel="noreferrer">
                    Ouvrir en grand
                  </a>
                </div>
                <iframe key={`${f.fichier}-${page}`} src={`${src}#page=${i === 0 ? page : 1}&view=FitH`} title={f.nom} loading={i === 0 ? "eager" : "lazy"} />
              </section>
            );
          })}
          {autresDocuments.length > 0 && (
            <ul className="liste-fichiers" style={{ marginBottom: 20 }}>
              {autresDocuments.map((f) => (
                <li key={f.fichier}>
                  <Icone nom="fichier" taille={20} />
                  <span>{f.nom}</span>
                  <a className="bouton fantome" href={chemin(`/api/fichiers/${f.fichier}?titre=${encodeURIComponent(f.nom)}`)} target="_blank" rel="noreferrer">
                    Télécharger
                  </a>
                </li>
              ))}
            </ul>
          )}
          {images.length > 0 && (
            <div className="photos-cours">
              {images.map((f) => (
                <a key={f.fichier} href={chemin(`/api/fichiers/${f.fichier}`)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chemin(`/api/fichiers/${f.fichier}`)} alt={f.nom} />
                </a>
              ))}
            </div>
          )}
          {cours.texte && (
            <div className="texte-origine">
              <div className="texte-origine-barre non-imprime">
                <span className="discret petit">{pdfs.length ? "Le texte lu dans le document, utilisé par l'IA" : "Le texte du cours"}</span>
                <EditeurTexteCours coursId={cours.id} texte={cours.texte} />
              </div>
              {pdfs.length ? (
                <details>
                  <summary className="petit">Afficher le texte lu</summary>
                  <TexteAvecImages texte={cours.texte} collees={collees} />
                </details>
              ) : (
                <TexteAvecImages texte={cours.texte} collees={collees} />
              )}
            </div>
          )}
        </div>
      )}

      <h2 style={{ marginTop: 40 }} className="non-imprime">
        QCM sur ce cours
      </h2>
      {qcms.length === 0 ? (
        <p className="discret non-imprime">Pas encore de QCM. Clique sur « Faire un QCM » pour en créer un.</p>
      ) : (
        <ul className="historique non-imprime">
          {qcms.map((q) => (
            <LigneQcm key={q.id} qcm={q} avecCours={false} />
          ))}
        </ul>
      )}

      {controles.length > 0 && (
        <>
          <h2 style={{ marginTop: 32 }} className="non-imprime">
            Contrôles sur ce cours
          </h2>
          <ul className="liste-courte non-imprime">
            {controles.map((k) => (
              <li key={k.id}>
                <Link href={`/controles/${k.id}`}>
                  <Icone nom="qcm" taille={20} />
                  <span className="liste-courte-titre">{k.titre}</span>
                  <span className="mini-note petite-note">{k.meilleure !== null ? `${formaterNote(k.meilleure)}/20` : <span className="discret petit">à faire</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
