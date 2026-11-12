/** Outils de la billetterie (réservation en ligne, paiement sur place), sans dépendance au serveur. */

export type StatutCommande = "en attente" | "payée" | "échouée" | "annulée";

/** Libellé affiché d'une commande : « en attente » veut dire « réservée, à payer sur place ». */
export const libelleStatut = (s: StatutCommande) =>
  s === "en attente" ? "Réservé · à payer sur place" : s === "payée" ? "Payé" : "Annulé";

const JETON = /^[0-9a-f]{32}$/i;
const REFERENCE = /^BDC-?[A-Z0-9]{6}$/i;

/**
 * Code à contrôler, tiré de ce que lit le scanner ou de ce que tape le contrôleur :
 * le lien du billet (…/billet/<jeton>), le jeton seul ou la référence (BDC-XXXXXX, tiret facultatif).
 * Renvoie null si ce n'est pas un billet du tournoi (QR code d'une licence, d'un site, etc.).
 */
export function codeDuBillet(lu: string): string | null {
  const brut = lu.trim();
  const lien = brut.match(/\/billet\/([0-9a-f]{32})(?:[/?#]|$)/i);
  if (lien) return lien[1].toLowerCase();
  if (JETON.test(brut)) return brut.toLowerCase();
  const ref = brut.replace(/\s+/g, "").toUpperCase();
  if (REFERENCE.test(ref)) return ref.includes("-") ? ref : `BDC-${ref.slice(3)}`;
  return null;
}

export const estJeton = (s: string) => JETON.test(s);
