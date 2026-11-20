/**
 * Signatures Wave (en-tête « Wave-Signature: t=<secondes>,v1=<hmac hex> »), sans dépendance au serveur.
 * Wave signe « horodatage + corps brut » en HMAC-SHA256 : pour les webhooks avec le secret du webhook
 * (wave_sn_WHS_…), et pour nos appels à l'API si la clé API a la signature activée (wave_sn_AKS_…).
 * Documentation : https://docs.wave.com/webhook et https://docs.wave.com/business
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Écart toléré entre l'horodatage de Wave et notre horloge. */
export const TOLERANCE_SECONDES = 5 * 60;

const hmac = (secret: string, horodatage: string, corps: string) =>
  createHmac("sha256", secret).update(horodatage + corps).digest("hex");

/** En-tête Wave-Signature d'un appel à l'API Wave (corps vide pour un GET). */
export function signerRequete(secret: string, corps: string, maintenant = Math.floor(Date.now() / 1000)) {
  const t = String(maintenant);
  return `t=${t},v1=${hmac(secret, t, corps)}`;
}

/**
 * Vérifie l'en-tête Wave-Signature d'un webhook sur le corps BRUT (tel que reçu, jamais re-sérialisé).
 * Plusieurs v1 peuvent être présents pendant un changement de secret : un seul doit correspondre.
 */
export function verifierSignatureWebhook(entete: string | null, corps: string, secret: string, maintenant = Math.floor(Date.now() / 1000)) {
  if (!entete || !secret) return false;
  const parties = entete.split(",").map((p) => p.trim());
  const t = parties.find((p) => p.startsWith("t="))?.slice(2) ?? "";
  const signatures = parties.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!/^\d+$/.test(t) || !signatures.length) return false;
  if (Math.abs(maintenant - Number(t)) > TOLERANCE_SECONDES) return false;
  const attendue = Buffer.from(hmac(secret, t, corps), "hex");
  return signatures.some((s) => {
    if (!/^[0-9a-f]+$/i.test(s)) return false;
    const recue = Buffer.from(s, "hex");
    return recue.length === attendue.length && timingSafeEqual(recue, attendue);
  });
}

/** Autre méthode de Wave (« secret partagé ») : le secret arrive en « Authorization: Bearer <secret> ». */
export function verifierSecretPartage(authorization: string | null, secret: string) {
  if (!authorization || !secret) return false;
  const recu = Buffer.from(authorization.replace(/^Bearer\s+/i, "").trim());
  const attendu = Buffer.from(secret);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

