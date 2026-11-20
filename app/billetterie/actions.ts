"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adresseDuSite } from "@/lib/site";
import { createPublicClient, createServiceClient, supabaseConfigured } from "@/lib/supabase/server";
import { creerSessionWave, waveConfigure } from "@/lib/wave";

export type EtatReservation = { erreur?: string };

const champ = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

const messageErreur = (error: { code?: string; message: string } | null) => {
  // Les règles de la base (places, numéro, quantité) ont des messages faits pour être lus.
  if (error?.code === "P0001") return error.message;
  if (error?.code === "22P02") return "Choisissez un match et une catégorie.";
  return "Réservation impossible pour le moment. Réessayez dans un instant.";
};

/**
 * Réservation. Avec Wave Business configuré, le supporter paie tout de suite sur Wave : ses billets
 * ne sont valables qu'une fois le paiement confirmé. Sans Wave, il paie sur place au contrôle du QR code.
 */
export async function reserver(_: EtatReservation, f: FormData): Promise<EtatReservation> {
  if (!supabaseConfigured) return { erreur: "La réservation ouvrira bientôt." };
  const parametres = {
    p_match: champ(f, "match"),
    p_categorie: champ(f, "categorie"),
    p_quantite: Number.parseInt(champ(f, "quantite"), 10),
    p_nom: champ(f, "nom"),
    p_telephone: champ(f, "telephone"),
  };
  if (waveConfigure) return reserverAvecWave(parametres);

  const { data, error } = await createPublicClient().rpc("reserver_billet", parametres);
  const billet = (data as { reference: string; jeton: string }[] | null)?.[0];
  if (error || !billet) {
    console.error(error);
    return { erreur: messageErreur(error) };
  }
  revalidatePath("/billetterie");
  redirect(`/billet/${billet.jeton}?nouveau=1`);
}

async function reserverAvecWave(parametres: Record<string, unknown>): Promise<EtatReservation> {
  const db = createServiceClient();
  const { data, error } = await db.rpc("reserver_billet_wave", parametres);
  const resa = (data as { reference: string; jeton: string; total_fcfa: number }[] | null)?.[0];
  if (error || !resa) {
    console.error(error);
    return { erreur: messageErreur(error) };
  }

  let lien: string;
  try {
    const base = await adresseDuSite();
    const session = await creerSessionWave({
      montant: resa.total_fcfa,
      reference: resa.reference,
      retourOk: `${base}/billet/${resa.jeton}?paiement=ok`,
      retourErreur: `${base}/billet/${resa.jeton}?paiement=erreur`,
    });
    const { error: e } = await db.rpc("enregistrer_session_wave", {
      p_reference: resa.reference,
      p_session: session.id,
      p_lien: session.wave_launch_url,
      p_expire: session.when_expires,
    });
    if (e) throw new Error(e.message);
    lien = session.wave_launch_url;
  } catch (e) {
    console.error("Session Wave", resa.reference, e instanceof Error ? e.message : e);
    // Pas de paiement possible : la réservation est abandonnée et ses places libérées.
    await db.rpc("abandonner_reservation_wave", { p_reference: resa.reference });
    return { erreur: "Le paiement Wave est indisponible pour le moment. Réessayez dans un instant." };
  }
  revalidatePath("/billetterie");
  // Page de paiement Wave (application Wave sur téléphone, QR code à scanner sur ordinateur).
  redirect(lien);
}

export type EtatRetrouver = { erreur?: string };

/** Billet perdu : la référence et le numéro de la réservation redonnent le lien du billet. */
export async function retrouver(_: EtatRetrouver, f: FormData): Promise<EtatRetrouver> {
  if (!supabaseConfigured) return { erreur: "Service indisponible." };
  const { data, error } = await createPublicClient().rpc("retrouver_billet", {
    p_reference: champ(f, "reference").replace(/\s+/g, ""),
    p_telephone: champ(f, "telephone"),
  });
  if (error) {
    console.error(error);
    return { erreur: "Recherche impossible pour le moment. Réessayez." };
  }
  if (!data) return { erreur: "Aucun billet ne correspond à cette référence et à ce numéro." };
  redirect(`/billet/${data}`);
}
