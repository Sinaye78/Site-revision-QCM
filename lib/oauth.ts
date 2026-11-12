/**
 * Connexion avec Discord ou Google (OAuth 2, « code d'autorisation »).
 * 1. /api/auth/<fournisseur> envoie vers la page du fournisseur ;
 * 2. le fournisseur revient sur /api/auth/<fournisseur>/retour avec un code ;
 * 3. on échange le code contre un jeton, on lit l'e-mail du compte, on vérifie
 *    qu'il est dans COMPTES_AUTORISES, et on ouvre la session.
 */
export type IdFournisseur = "discord" | "google";

/** Cookie qui garde, le temps de l aller-retour, la valeur au hasard envoyée au fournisseur. */
export const COOKIE_ETAT = "qcm_oauth";

export type ConfigOAuth = {
  id: IdFournisseur;
  nom: string;
  clientId: string;
  clientSecret: string;
  urlAutorisation: string;
  urlJeton: string;
  urlProfil: string;
  scope: string;
  extra: Record<string, string>;
};

export type Profil = { fournisseurId: string; email: string; emailVerifie: boolean; nom: string; avatar: string };

/** Pour les tests seulement : OAUTH_TEST_BASE remplace les adresses de Discord et Google par un faux serveur. */
function base(vraie: string, chemin: string): string {
  const test = process.env.OAUTH_TEST_BASE;
  return test ? `${test}${chemin}` : `${vraie}${chemin}`;
}

export function configOAuth(id: string): ConfigOAuth | null {
  const env = process.env;
  if (id === "discord" && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    return {
      id: "discord",
      nom: "Discord",
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      urlAutorisation: base("https://discord.com", "/oauth2/authorize"),
      urlJeton: base("https://discord.com", "/api/oauth2/token"),
      urlProfil: base("https://discord.com", "/api/users/@me"),
      scope: "identify email",
      extra: { prompt: "none" },
    };
  }
  if (id === "google" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return {
      id: "google",
      nom: "Google",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      urlAutorisation: base("https://accounts.google.com", "/o/oauth2/v2/auth"),
      urlJeton: base("https://oauth2.googleapis.com", "/token"),
      urlProfil: base("https://openidconnect.googleapis.com", "/v1/userinfo"),
      scope: "openid email profile",
      extra: { prompt: "select_account" },
    };
  }
  return null;
}

export function fournisseursActifs(): IdFournisseur[] {
  return (["discord", "google"] as const).filter((id) => configOAuth(id));
}

/** Adresse publique du site, ex. https://mon-domaine.fr/revision (sans / final). */
export function urlSite(): string {
  const url = process.env.SITE_URL?.replace(/\/+$/, "");
  if (!url) throw new Error("SITE_URL manquant dans le .env (ex. https://mon-domaine.fr/revision)");
  return url;
}

export function urlRetour(id: IdFournisseur): string {
  return `${urlSite()}/api/auth/${id}/retour`;
}

export function urlConnexion(c: ConfigOAuth, etat: string): string {
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: urlRetour(c.id),
    response_type: "code",
    scope: c.scope,
    state: etat,
    ...c.extra,
  });
  return `${c.urlAutorisation}?${params}`;
}

export async function lireProfil(c: ConfigOAuth, code: string): Promise<Profil> {
  const repJeton = await fetch(c.urlJeton, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: urlRetour(c.id),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!repJeton.ok) throw new Error(`${c.nom} a refusé le code (${repJeton.status}) ${(await repJeton.text()).slice(0, 200)}`);
  const { access_token } = (await repJeton.json()) as { access_token?: string };
  if (!access_token) throw new Error(`${c.nom} n'a pas renvoyé de jeton`);

  const repProfil = await fetch(c.urlProfil, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!repProfil.ok) throw new Error(`${c.nom} n'a pas donné le profil (${repProfil.status})`);
  const p = (await repProfil.json()) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : "");

  if (c.id === "discord") {
    const id = texte(p.id);
    const avatar = texte(p.avatar);
    return {
      fournisseurId: id,
      email: texte(p.email),
      emailVerifie: p.verified === true,
      nom: texte(p.global_name) || texte(p.username),
      avatar: avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64` : "",
    };
  }
  return {
    fournisseurId: texte(p.sub),
    email: texte(p.email),
    emailVerifie: p.email_verified === true,
    nom: texte(p.given_name) || texte(p.name),
    avatar: texte(p.picture),
  };
}
