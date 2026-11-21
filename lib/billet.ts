/** Outils de la billetterie (réservation en ligne, paiement sur place), sans dépendance au serveur. */

export type StatutCommande = "en attente" | "payée" | "échouée" | "annulée";

/** Libellé affiché d'une commande : « en attente » veut dire « réservée, à payer sur place ». */
export const libelleStatut = (s: StatutCommande) =>
  s === "en attente" ? "Réservé · à payer sur place" : s === "payée" ? "Payé" : "Annulé";

const JETON = /^[0-9a-f]{32}$/i;
const REFERENCE = /^BDC-?([A-Z0-9]{6})(?:-(\d{1,2}))?$/i;

/** Statut d'un billet (une place) : chaque billet se paie et se valide séparément à l'entrée. */
export type StatutBillet = "à payer" | "payé" | "utilisé" | "annulé";

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

/** Un billet réservé (une place), tel que le lit l'espace pro pour le bilan de la billetterie. */
export interface BilletReserve {
  match_id: string;
  categorie_id: string;
  paye: boolean;
  entre: boolean;
}

/** Compteurs d'un groupe de billets réservés. */
export interface Compteurs {
  reserves: number;
  payes: number;
  aPayer: number;
  entres: number;
}

const zero = (): Compteurs => ({ reserves: 0, payes: 0, aPayer: 0, entres: 0 });
const compter = (c: Compteurs, b: BilletReserve) => {
  c.reserves += 1;
  if (b.paye) c.payes += 1;
  else c.aPayer += 1;
  if (b.entre) c.entres += 1;
};

/**
 * Bilan des tickets réservés : total, par catégorie et par match (puis par catégorie dans chaque match).
 * Les billets des réservations annulées ne doivent pas être passés.
 */
export function bilanReservations(billets: BilletReserve[]) {
  const total = zero();
  const parCategorie = new Map<string, Compteurs>();
  const parMatch = new Map<string, { total: Compteurs; parCategorie: Map<string, Compteurs> }>();
  for (const b of billets) {
    compter(total, b);
    if (!parCategorie.has(b.categorie_id)) parCategorie.set(b.categorie_id, zero());
    compter(parCategorie.get(b.categorie_id)!, b);
    if (!parMatch.has(b.match_id)) parMatch.set(b.match_id, { total: zero(), parCategorie: new Map() });
    const m = parMatch.get(b.match_id)!;
    compter(m.total, b);
    if (!m.parCategorie.has(b.categorie_id)) m.parCategorie.set(b.categorie_id, zero());
    compter(m.parCategorie.get(b.categorie_id)!, b);
  }
  return { total, parCategorie, parMatch };
}
