import Link from "next/link";
import { Icone } from "./icones";
import { BoutonTheme } from "./bouton-theme";
import { MenuCompte } from "./menu-compte";
import { VeilleTaches } from "./veille-taches";
import { chemin } from "@/lib/chemin";
import { estInvite, utilisateurCourant } from "@/lib/auth";
import { listerTaches } from "@/lib/taches-db";
import { compterARevoir } from "@/lib/revision";

export async function Entete() {
  const u = await utilisateurCourant();
  const initiale = (u?.nom || "?").trim().charAt(0).toUpperCase();
  const enCours = u ? listerTaches(u.id).filter((t) => t.statut === "en_attente" || t.statut === "en_cours").length : 0;
  const aRevoir = u ? compterARevoir(u.id) : 0;
  const invite = u !== null && estInvite(u);

  return (
    <header className="entete">
      <Link href="/accueil" className="logo" aria-label="Accueil">
        <span className="logo-pastille">
          <Icone nom="crayon" taille={26} />
        </span>
        <span className="surligne texte-nav">QCM</span>
      </Link>
      <nav>
        <Link href="/nouveau" className="bouton fantome" aria-label="Nouveau QCM">
          <Icone nom="plus" /> <span className="texte-nav">Nouveau QCM</span>
        </Link>
        <Link href="/mes-cours" className="bouton fantome" aria-label="Mes cours">
          <Icone nom="cahier" /> <span className="texte-nav">Mes cours</span>
        </Link>
        <Link href="/mes-qcm" className="bouton fantome" aria-label="Mes QCM">
          <Icone nom="qcm" /> <span className="texte-nav">Mes QCM</span>
        </Link>
        <Link href="/reviser" className="bouton fantome lien-reviser" aria-label={aRevoir > 0 ? `Réviser : ${aRevoir} questions aujourd'hui` : "Réviser"}>
          <Icone nom="recommencer" /> <span className="texte-nav">Réviser</span>
          {aRevoir > 0 && <span className="pastille-compte">{aRevoir > 99 ? "99+" : aRevoir}</span>}
        </Link>
        {enCours > 0 && (
          <Link href="/traitements" className="bouton fantome lien-en-cours" aria-label={`${enCours} traitement${enCours > 1 ? "s" : ""} en cours`}>
            <span className="point-en-cours" aria-hidden="true" /> <span className="texte-nav">En cours</span> ({enCours})
          </Link>
        )}
        <BoutonTheme className="theme-nav" />
        {invite && (
          // Sans compte, se déconnecter ferait perdre les cours : on propose plutôt de créer un compte.
          <Link href="/?compte=1" className="bouton badge-invite" title="Tes cours sont seulement sur ce navigateur. Connecte-toi pour les garder partout.">
            <Icone nom="cadenas" taille={20} /> <span className="texte-nav">Sauvegarder</span>
          </Link>
        )}
        {u && (
          <MenuCompte
            resume={
              invite ? (
                <Icone nom="menu" />
              ) : u.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="profil-image" src={u.avatar} alt="" width={30} height={30} referrerPolicy="no-referrer" />
              ) : (
                <span className="profil-initiale">{initiale}</span>
              )
            }
          >
            {!invite && (
              <p className="menu-compte-nom">
                {u.nom}
                {u.email && <span className="discret petit">{u.email}</span>}
              </p>
            )}
            <Link href="/accueil" className="menu-lien">
              <Icone nom="maison" taille={20} /> Accueil
            </Link>
            <Link href="/controles" className="menu-lien">
              <Icone nom="crayon" taille={20} /> Mes contrôles
            </Link>
            <Link href="/cartes" className="menu-lien">
              <Icone nom="cartes" taille={20} /> Cartes mémoire
            </Link>
            <Link href="/traitements" className="menu-lien">
              <Icone nom="baguette" taille={20} /> Mes traitements
            </Link>
            <Link href="/quotas" className="menu-lien">
              <Icone nom="ampoule" taille={20} /> Utilisation des IA
            </Link>
            <BoutonTheme avecTexte className="theme-menu" />
            {!invite && (
              <form action={chemin("/api/deconnexion")} method="post">
                <button type="submit" className="menu-lien">
                  <Icone nom="sortir" taille={20} /> Se déconnecter
                </button>
              </form>
            )}
          </MenuCompte>
        )}
      </nav>
      {u && <VeilleTaches actives={enCours} />}
    </header>
  );
}
