/** Outils de la billetterie (réservation en ligne, paiement sur place), sans dépendance au serveur. */

export type StatutCommande = "en attente" | "payée" | "échouée" | "annulée";

/**
 * Libellé affiché d'une commande. « en attente » veut dire « réservée, à payer sur place », ou, pour Wave,
 * « paiement pas encore confirmé » ; « échouée » est un paiement Wave qui n'a pas abouti.
 */
export const libelleStatut = (s: StatutCommande, moyen?: string | null) => {
  const wave = moyen === "wave";
  if (s === "en attente") return wave ? "Paiement Wave en attente" : "Réservé · à payer sur place";
  if (s === "payée") return wave ? "Payé · Wave" : "Payé";
  return s === "échouée" ? "Paiement non abouti" : "Annulé";
};

const JETON = /^[0-9a-f]{32}$/i;
const REFERENCE = /^BDC-?([A-Z0-9]{6})(?:-(\d{1,2}))?$/i;

/** Statut d'un billet (une place) : chaque billet se paie et se valide séparément à l'entrée. */
export type StatutBillet = "à payer" | "paiement en attente" | "payé" | "utilisé" | "annulé";

/** Référence d'un billet : celle de la réservation suivie de son numéro (BDC-XXXXXX-2). */
export const referenceBillet = (reference: string, numero: number, quantite: number) =>
  quantite > 1 ? `${reference}-${numero}` : reference;

/** Contenu du QR code : un code propre au tournoi, sans lien, qui n'ouvre rien sur un autre téléphone. */
export const contenuQr = (jeton: string) => `BDC:${jeton.toLowerCase()}`;

/**
 * Code à contrôler, tiré de ce que lit le scanner ou de ce que tape le contrôleur :
 * le contenu du QR code (BDC:<jeton>), un ancien lien (…/billet/<jeton>), le jeton seul ou la référence
 * (BDC-XXXXXX ou BDC-XXXXXX-2 pour le 2e billet d'une réservation, premier tiret facultatif).
 * Renvoie null si ce n'est pas un billet du tournoi (QR code d'une licence, d'un site, etc.).
 */
export function codeDuBillet(lu: string): string | null {
  const brut = lu.trim();
  const qr = brut.match(/^BDC:([0-9a-f]{32})$/i);
  if (qr) return qr[1].toLowerCase();
  const lien = brut.match(/\/billet\/([0-9a-f]{32})(?:[/?#]|$)/i);
  if (lien) return lien[1].toLowerCase();
  if (JETON.test(brut)) return brut.toLowerCase();
  const ref = brut.replace(/\s+/g, "").toUpperCase();
  const r = ref.match(REFERENCE);
  if (r) return `BDC-${r[1]}${r[2] ? `-${Number(r[2])}` : ""}`;
  return null;
}

export const estJeton = (s: string) => JETON.test(s);
