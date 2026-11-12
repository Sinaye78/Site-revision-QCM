import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lireUtilisateur, noterVisite, type Utilisateur } from "./db";

// Nom propre à l’application pour isoler sa session des autres applications du domaine.
export const COOKIE_SESSION = "qcm_session";
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
/** Sans compte, le cookie est la seule clé des cours : on le garde un an. */
export const DUREE_INVITE_MS = 365 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court (16 caractères minimum)");
  return s;
}

export function signer(valeur: string): string {
  return crypto.createHmac("sha256", secret()).update(valeur).digest("base64url");
}

export function egal(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Jeton de session : « compte.expiration.signature ». */
export function creerJeton(utilisateurId: string, duree = DUREE_SESSION_MS): string {
  const corps = `${utilisateurId}.${Date.now() + duree}`;
  return `${corps}.${signer(corps)}`;
}

export function lireJeton(jeton: string | undefined): string | null {
  if (!jeton) return null;
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) return null;
  const [id, expire, signature] = morceaux;
  if (!egal(signature, signer(`${id}.${expire}`))) return null;
  if (Number(expire) <= Date.now()) return null;
  return id;
}

/** Réglages du cookie de session (le chemin et « secure » dépendent de l'adresse du site). */
export function optionsCookie(duree: number, base: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.SITE_URL ?? "").startsWith("https:"),
    path: base || "/",
    maxAge: duree / 1000,
  };
}

/** Le compte connecté (ou l'invité de ce navigateur), ou null. */
export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const jar = await cookies();
  const id = lireJeton(jar.get(COOKIE_SESSION)?.value);
  const u = id ? lireUtilisateur(id) : null;
  if (u) noterVisite(u.id);
  return u;
}

/** À appeler en haut de chaque page protégée : renvoie le compte ou redirige vers la connexion. */
export async function exigerConnexion(): Promise<Utilisateur> {
  const u = await utilisateurCourant();
  if (!u) redirect("/");
  return u;
}

export function estInvite(u: Utilisateur): boolean {
  return u.fournisseur === "invite";
}

/* ---------------- Comptes autorisés ---------------- */

/**
 * COMPTES_AUTORISES : e-mails séparés par des virgules (Google ou Discord).
 * « * » laisse entrer n'importe quel compte.
 */
export function emailAutorise(email: string): boolean {
  const liste = (process.env.COMPTES_AUTORISES || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (liste.includes("*")) return true;
  return email !== "" && liste.includes(email.toLowerCase());
}

/* ---------------- Sans compte ---------------- */

/** SANS_COMPTE=0 dans le .env coupe le bouton « Continuer sans compte ». */
export function sansCompteActif(): boolean {
  return process.env.SANS_COMPTE !== "0";
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/*
 * Limites pour les visiteurs sans compte (n'importe qui peut cliquer sur le bouton) :
 * - 10 nouveaux « sans compte » par heure et par adresse IP ;
 * - INVITE_QCM_PAR_JOUR QCM par jour et par adresse IP (10 par défaut).
 * Compteurs en mémoire : ils repartent à zéro si le site redémarre, ce qui suffit ici.
 */
const creations = new Map<string, number[]>();
const qcmDuJour = new Map<string, { jour: string; nombre: number }>();

export function peutCreerInvite(ip: string): boolean {
  const uneHeure = Date.now() - 60 * 60 * 1000;
  const recentes = (creations.get(ip) ?? []).filter((t) => t > uneHeure);
  if (recentes.length >= 10) return false;
  recentes.push(Date.now());
  creations.set(ip, recentes);
  return true;
}

/** Réserve un QCM dans le quota du jour. Renvoie false si le quota est atteint. */
export function reserverQcmInvite(ip: string): boolean {
  const max = Number(process.env.INVITE_QCM_PAR_JOUR || 10);
  const jour = new Date().toISOString().slice(0, 10);
  const c = qcmDuJour.get(ip);
  const actuel = c && c.jour === jour ? c.nombre : 0;
  if (actuel >= max) return false;
  qcmDuJour.set(ip, { jour, nombre: actuel + 1 });
  return true;
}

/** Rend le QCM réservé si la création a échoué (l'élève ne doit pas perdre un essai pour rien). */
export function rendreQcmInvite(ip: string) {
  const c = qcmDuJour.get(ip);
  if (c && c.nombre > 0) c.nombre -= 1;
}
