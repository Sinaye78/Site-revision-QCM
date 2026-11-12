import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Télécharge une page web donnée par l'élève (cours en ligne). Le serveur
 * héberge d'autres services : on refuse toute adresse privée ou locale, en
 * vérifiant l'adresse IP au moment même de la connexion (pas seulement avant),
 * et on limite la taille, le temps et le nombre de redirections.
 */
export class ErreurLien extends Error {}

const TAILLE_MAX = 15 * 1024 * 1024;
const DELAI_MS = 12_000;
const REDIRECTIONS_MAX = 3;

export function adressePublique(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // réseau partagé des opérateurs
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return false;
    const mappe = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mappe) return adressePublique(mappe[1]);
    if (/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v)) return false;
    return true;
  }
  return false;
}

/** Résolution DNS qui refuse les adresses privées : utilisée par la connexion elle-même. */
const rechercheSure: LookupFunction = (nom, options, rappel) => {
  dns.lookup(nom, { ...options, all: true }, (erreur, adresses) => {
    if (erreur) return rappel(erreur, "", 0);
    const liste = (Array.isArray(adresses) ? adresses : [adresses]) as dns.LookupAddress[];
    const sures = liste.filter((a) => adressePublique(a.address));
    if (!sures.length || sures.length !== liste.length) return rappel(new ErreurLien("Cette adresse n'est pas autorisée."), "", 0);
    if (options.all) return (rappel as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, sures);
    rappel(null, sures[0].address, sures[0].family);
  });
};

export function verifierAdresse(brute: string): URL {
  let url: URL;
  try {
    url = new URL(brute.trim());
  } catch {
    throw new ErreurLien("Ce lien n'est pas une adresse web valide (elle doit commencer par https://).");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ErreurLien("Seuls les liens http:// et https:// sont acceptés.");
  if (url.username || url.password) throw new ErreurLien("Ce lien n'est pas accepté.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ErreurLien("Ce lien n'est pas accepté.");
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && !adressePublique(url.hostname.replace(/^\[|\]$/g, ""))) throw new ErreurLien("Cette adresse n'est pas autorisée.");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(url.hostname)) throw new ErreurLien("Cette adresse n'est pas autorisée.");
  return url;
}

export type PageTelechargee = { url: string; type: string; contenu: Buffer };

function telecharger(url: URL, restantes: number): Promise<PageTelechargee> {
  return new Promise((resoudre, rejeter) => {
    const module = url.protocol === "https:" ? https : http;
    const requete = module.get(
      url,
      {
        lookup: rechercheSure,
        timeout: DELAI_MS,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RevisionQCM/1.0)", Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5" },
      },
      (rep) => {
        const statut = rep.statusCode ?? 0;
        if (statut >= 300 && statut < 400 && rep.headers.location) {
          rep.resume();
          if (restantes <= 0) return rejeter(new ErreurLien("Ce lien redirige trop de fois."));
          try {
            return resoudre(telecharger(verifierAdresse(new URL(rep.headers.location, url).toString()), restantes - 1));
          } catch (e) {
            return rejeter(e);
          }
        }
        if (statut !== 200) {
          rep.resume();
          return rejeter(new ErreurLien(`La page n'a pas pu être ouverte (erreur ${statut}). Vérifie le lien, ou enregistre la page et envoie-la en fichier.`));
        }
        const morceaux: Buffer[] = [];
        let taille = 0;
        rep.on("data", (m: Buffer) => {
          taille += m.length;
          if (taille > TAILLE_MAX) {
            requete.destroy();
            rejeter(new ErreurLien("Cette page est trop lourde (15 Mo maximum)."));
          } else morceaux.push(m);
        });
        rep.on("end", () => resoudre({ url: url.toString(), type: String(rep.headers["content-type"] ?? "").toLowerCase(), contenu: Buffer.concat(morceaux) }));
        rep.on("error", rejeter);
      }
    );
    requete.on("timeout", () => requete.destroy(new ErreurLien("La page met trop de temps à répondre.")));
    requete.on("error", (e) => rejeter(e instanceof ErreurLien ? e : new ErreurLien("La page n'a pas pu être ouverte. Vérifie le lien.")));
  });
}

export async function telechargerPage(brute: string): Promise<PageTelechargee> {
  return telecharger(verifierAdresse(brute), REDIRECTIONS_MAX);
}
