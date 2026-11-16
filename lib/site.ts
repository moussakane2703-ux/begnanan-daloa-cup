import "server-only";
import { headers } from "next/headers";

/**
 * Nom de domaine du tournoi, sans « www » : c'est l'adresse que Google connaît et qui est vérifiée dans
 * Search Console. Dans Vercel (Settings > Domains), begnanandaloacup.com doit être l'adresse principale
 * et www doit rediriger vers elle, jamais l'inverse : Google n'indexe pas une adresse qui redirige.
 * L'ancienne adresse begnanan-daloa-cup.vercel.app reste en service.
 */
const ADRESSE_OFFICIELLE = "https://begnanandaloacup.com";

/**
 * Adresse publique du site, pour les liens des QR codes. On vise toujours l'adresse de production :
 * un QR code imprimé depuis une adresse de prévisualisation Vercel (protégée par connexion) ne
 * s'ouvrirait pas sur le téléphone du contrôleur.
 */
export async function adresseDuSite() {
  const fixe = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL ? ADRESSE_OFFICIELLE : null);
  if (fixe) return fixe.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Adresse de production : liens absolus des aperçus de partage, du plan du site et de la fiche Google. */
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? ADRESSE_OFFICIELLE;
