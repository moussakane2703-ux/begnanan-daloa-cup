import "server-only";
import { signerRequete } from "./waveSignature";
import { createServiceClient } from "./supabase/server";

/**
 * API Wave Checkout (compte Wave Business du tournoi). La clé API ne quitte jamais le serveur :
 * elle se règle dans Vercel (WAVE_API_KEY), jamais dans le code ni dans le navigateur.
 * Documentation : https://docs.wave.com/checkout
 */
const API = "https://api.wave.com/v1/checkout/sessions";

/** Paiement Wave actif : clé API Wave et clé de service Supabase présentes sur le serveur. */
export const waveConfigure = Boolean(process.env.WAVE_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

export interface SessionWave {
  id: string;
  amount: string;
  currency: string;
  checkout_status: "open" | "complete" | "expired";
  payment_status: "processing" | "cancelled" | "succeeded";
  client_reference: string | null;
  transaction_id: string | null;
  wave_launch_url: string;
  when_expires: string;
  last_payment_error: { code: string; message: string } | null;
}

async function appel(url: string, corps?: object): Promise<SessionWave> {
  const json = corps ? JSON.stringify(corps) : "";
  const entetes: Record<string, string> = { Authorization: `Bearer ${process.env.WAVE_API_KEY}` };
  if (corps) entetes["Content-Type"] = "application/json";
  // Clé API créée avec la signature des requêtes activée : chaque appel doit être signé.
  const secret = process.env.WAVE_SIGNING_SECRET;
  if (secret) entetes["Wave-Signature"] = signerRequete(secret, json);
  const r = await fetch(url, { method: corps ? "POST" : "GET", headers: entetes, body: corps ? json : undefined, cache: "no-store" });
  if (!r.ok) {
    // Ne jamais journaliser la clé : seulement le code d'erreur renvoyé par Wave.
    throw new Error(`Wave ${r.status} : ${(await r.text()).slice(0, 300)}`);
  }
  return r.json() as Promise<SessionWave>;
}

/** Ouvre une session de paiement (30 minutes) pour le total de la réservation, en francs CFA. */
export function creerSessionWave(p: { montant: number; reference: string; retourOk: string; retourErreur: string }) {
  return appel(API, {
    amount: String(Math.round(p.montant)),
    currency: "XOF",
    client_reference: p.reference,
    success_url: p.retourOk,
    error_url: p.retourErreur,
  });
}

export const lireSessionWave = (id: string) => appel(`${API}/${encodeURIComponent(id)}`);

/**
 * Enregistre le paiement si la session Wave est payée. Sert au webhook et au retour du supporter sur
 * son billet (au cas où le webhook arrive en retard ou n'est pas encore branché). Renvoie true si payé.
 */
export async function enregistrerSiPayee(s: SessionWave) {
  if (s.payment_status !== "succeeded" || s.currency !== "XOF") return false;
  const { error } = await createServiceClient().rpc("confirmer_paiement_wave", {
    p_session: s.id,
    p_transaction: s.transaction_id,
    p_montant: Number(s.amount),
  });
  if (error) throw new Error(`confirmer_paiement_wave : ${error.message}`);
  return true;
}
