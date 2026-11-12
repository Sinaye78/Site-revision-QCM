import { redirect } from "next/navigation";
import { estInvite, sansCompteActif, utilisateurCourant } from "@/lib/auth";
import { fournisseursActifs } from "@/lib/oauth";
import { chemin } from "@/lib/chemin";
import { LogoDiscord, LogoGoogle } from "@/components/logos";
import { Icone } from "@/components/icones";

const ERREURS: Record<string, string> = {
  annule: "Connexion annulée.",
  expire: "La connexion a pris trop de temps. Réessaie.",
  fournisseur: "Le service de connexion n'a pas répondu. Réessaie dans un instant.",
  email: "Ce compte n'a pas d'adresse e-mail vérifiée.",
  indisponible: "Cette connexion n'est pas encore configurée sur le site.",
  "sans-compte": "L'utilisation sans compte est désactivée sur ce site.",
  trop: "Trop d'essais depuis cet appareil. Réessaie dans une heure.",
};

function FicheConnexion({ id, actif }: { id: "discord" | "google"; actif: boolean }) {
  const nom = id === "discord" ? "Discord" : "Google";
  const contenu = (
    <>
      {id === "discord" ? <LogoDiscord /> : <LogoGoogle />}
      <span>
        Continuer avec {nom}
        {!actif && <span className="pas-active">pas encore activé sur le site</span>}
      </span>
    </>
  );
  return actif ? (
    <a className={`fiche-connexion fiche-${id}`} href={chemin(`/api/auth/${id}`)}>
      {contenu}
    </a>
  ) : (
    <span className={`fiche-connexion fiche-${id} fiche-inactive`} aria-disabled="true" title={`Ajoute les clés ${nom} dans le fichier .env pour l'activer.`}>
      {contenu}
    </span>
  );
}

type Props = { searchParams: Promise<{ erreur?: string; email?: string; compte?: string }> };

export default async function PageConnexion({ searchParams }: Props) {
  const { erreur, email, compte } = await searchParams;
  const u = await utilisateurCourant();
  // Un invité peut revenir ici (?compte=1) pour se connecter et garder ses cours.
  const inviteQuiSeConnecte = u !== null && estInvite(u) && compte === "1";
  if (u && !inviteQuiSeConnecte) redirect("/accueil");

  const fournisseurs = fournisseursActifs();
  const sansCompte = sansCompteActif() && !inviteQuiSeConnecte;
  const message =
    erreur === "refuse"
      ? `Le compte ${email ?? ""} n'est pas autorisé sur ce site. Demande à ce qu'il soit ajouté.`
      : erreur
        ? (ERREURS[erreur] ?? "La connexion n'a pas marché.")
        : "";

  return (
    <main className="feuille">
      <div className="connexion">
        <div className="carte">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="illustration-connexion" src={chemin("/illustrations/connexion.webp")} alt="" width={800} height={500} />
          {inviteQuiSeConnecte ? (
            <>
              <h1>
                <span className="surligne">Sauvegarde</span> tes cours
              </h1>
              <p className="consigne-sauvegarde">
                Connecte-toi avec <strong>Discord</strong> ou <strong>Google</strong> : tes cours passent sur ton compte.
              </p>
            </>
          ) : (
            <>
              <h1>
                Prêt à <span className="surligne">réviser</span> ?
              </h1>
              <p className="discret">Connecte-toi pour retrouver tes cours.</p>
            </>
          )}

          {/* Les deux fiches sont toujours là ; une fiche pas encore configurée le dit au lieu de disparaître. */}
          <div className="fiches-connexion">
            <FicheConnexion id="discord" actif={fournisseurs.includes("discord")} />
            <FicheConnexion id="google" actif={fournisseurs.includes("google")} />
          </div>

          {sansCompte && (
            <>
              <p className="separateur">ou</p>
              <form action={chemin("/api/auth/invite")} method="post" style={{ marginTop: 14 }}>
                <button type="submit" className="bouton" style={{ width: "100%" }}>
                  Continuer sans compte <Icone nom="suivant" />
                </button>
              </form>
            </>
          )}
          {inviteQuiSeConnecte && (
            <a href={chemin("/nouveau")} className="bouton fantome" style={{ marginTop: 14 }}>
              <Icone nom="precedent" /> Revenir sans me connecter
            </a>
          )}
          {message && (
            <p className="erreur" role="alert" style={{ justifyContent: "center" }}>
              {message}
            </p>
          )}
        </div>

        {!inviteQuiSeConnecte && (
        <div className="postit postit-compte">
          <div className="titre-postit">
            <Icone nom="cahier" />
            Où sont rangés tes cours ?
          </div>
          <p style={{ margin: "0 0 6px" }}>
            <strong>Avec un compte</strong> : tout est sauvegardé en ligne. Tu retrouves tes cours sur n&apos;importe quel appareil.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Sans compte</strong> : tes cours restent seulement sur ce navigateur, sur cet appareil.
          </p>
        </div>
        )}
      </div>
    </main>
  );
}
