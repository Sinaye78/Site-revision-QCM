import { illustrationsNonPlacees, type Bloc, type Fiche } from "@/lib/fiche";
import { chemin } from "@/lib/chemin";
import { Icone } from "./icones";

/** Une image du cours, cliquable pour l'ouvrir en grand. */
function ImageCours({ fichier, legende }: { fichier: string; legende: string }) {
  const src = chemin(`/api/fichiers/${fichier}`);
  return (
    <figure className="fiche-image">
      <a href={src} target="_blank" rel="noreferrer" title="Ouvrir en grand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={legende} loading="lazy" />
      </a>
      {legende && <figcaption>{legende}</figcaption>}
    </figure>
  );
}

/** Transforme « un **mot** important » en texte avec le mot surligné. */
function Surligne({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {morceaux.map((m, i) =>
        m.startsWith("**") && m.endsWith("**") && m.length > 4 ? (
          <mark key={i} className="surligne">
            {m.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{m}</span>
        )
      )}
    </>
  );
}

function BlocFiche({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "paragraphe":
      return (
        <p className="fiche-paragraphe">
          <Surligne texte={bloc.texte} />
        </p>
      );
    case "liste":
      return (
        <ul className="fiche-liste">
          {bloc.elements.map((e, i) => (
            <li key={i}>
              <Surligne texte={e} />
            </li>
          ))}
        </ul>
      );
    case "definition":
      return (
        <div className="fiche-definition">
          <span className="fiche-terme">{bloc.terme}</span>
          <span>
            <Surligne texte={bloc.texte} />
          </span>
        </div>
      );
    case "important":
      return (
        <div className="fiche-important">
          <Icone nom="ampoule" />
          <span>
            <Surligne texte={bloc.texte} />
          </span>
        </div>
      );
    case "date":
      return (
        <div className="fiche-date">
          <span className="fiche-date-valeur">{bloc.date}</span>
          <span>
            <Surligne texte={bloc.texte} />
          </span>
        </div>
      );
    case "formule":
      return (
        <div className="fiche-formule">
          <code>{bloc.texte}</code>
          {bloc.explication && <span className="discret petit">{bloc.explication}</span>}
        </div>
      );
    case "image":
      return bloc.fichier ? <ImageCours fichier={bloc.fichier} legende={bloc.legende} /> : null;
    case "exemple":
      return (
        <div className="fiche-exemple">
          <span className="fiche-exemple-titre">Exemple</span>
          <Surligne texte={bloc.texte} />
        </div>
      );
  }
}

/** Les schémas consécutifs restent côte à côte, à l'intérieur de leur notion. */
function BlocsSection({ blocs }: { blocs: Bloc[] }) {
  const groupes: Bloc[][] = [];
  for (const bloc of blocs) {
    const dernier = groupes.at(-1);
    if (bloc.type === "image" && dernier?.[0].type === "image") dernier.push(bloc);
    else groupes.push([bloc]);
  }
  return groupes.map((groupe, i) => groupe[0].type === "image" && groupe.length > 1 ? (
    <div className="fiche-galerie" key={i}>{groupe.map((b, j) => <BlocFiche key={j} bloc={b} />)}</div>
  ) : groupe[0].ajout_ia ? (
    // Contenu ajouté par l'IA lors d'une retouche : pas dans le cours du prof.
    <div className="fiche-ajout-ia" key={i}>
      <span className="fiche-ajout-ia-etiquette">Ajouté par l&apos;IA</span>
      <BlocFiche bloc={groupe[0]} />
    </div>
  ) : <BlocFiche key={i} bloc={groupe[0]} />);
}

/** Le cours remis au propre par l'IA, dessiné comme une fiche de révision. */
export function FicheCours({ fiche }: { fiche: Fiche }) {
  const restantes = illustrationsNonPlacees(fiche);
  return (
    <article className="fiche">
      {fiche.resume && (
        <div className="postit fiche-resume">
          <div className="titre-postit">
            <Icone nom="guillemets" /> En bref
          </div>
          <p style={{ margin: 0 }}>{fiche.resume}</p>
        </div>
      )}
      {fiche.sections.map((s, i) => (
        <section key={i} className="fiche-section">
          <h2 className="fiche-titre">
            <span className="fiche-numero">{i + 1}.</span> {s.titre}
          </h2>
          <BlocsSection blocs={s.blocs} />
        </section>
      ))}
      {restantes.length > 0 && (
        <section className="fiche-section">
          <h2 className="fiche-titre">
            <span className="fiche-numero">{fiche.sections.length + 1}.</span> Images du cours
          </h2>
          <div className="fiche-galerie">
            {restantes.map((i) => (
              <ImageCours key={i.fichier} fichier={i.fichier} legende={i.nom} />
            ))}
          </div>
        </section>
      )}
      {fiche.mots_cles.length > 0 && (
        <div className="fiche-mots">
          <span className="reglage-titre">Mots-clés</span>
          <div className="pastilles">
            {fiche.mots_cles.map((m) => (
              <span key={m} className="etiquette">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
