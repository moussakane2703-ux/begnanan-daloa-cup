"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPublicClient, supabaseConfigured } from "@/lib/supabase/server";

export type EtatReservation = { erreur?: string };

const champ = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Réservation sans paiement : le billet est payé sur place, au contrôle du QR code. */
export async function reserver(_: EtatReservation, f: FormData): Promise<EtatReservation> {
  if (!supabaseConfigured) return { erreur: "La réservation ouvrira bientôt." };
  const quantite = Number.parseInt(champ(f, "quantite"), 10);
  const { data, error } = await createPublicClient().rpc("reserver_billet", {
    p_match: champ(f, "match"),
    p_categorie: champ(f, "categorie"),
    p_quantite: quantite,
    p_nom: champ(f, "nom"),
    p_telephone: champ(f, "telephone"),
  });
  const billet = (data as { reference: string; jeton: string }[] | null)?.[0];
  if (error || !billet) {
    console.error(error);
    // Les règles de la base (places, numéro, quantité) ont des messages faits pour être lus.
    if (error?.code === "P0001") return { erreur: error.message };
    if (error?.code === "22P02") return { erreur: "Choisissez un match et une catégorie." };
    return { erreur: "Réservation impossible pour le moment. Réessayez dans un instant." };
  }
  revalidatePath("/billetterie");
  redirect(`/billet/${billet.jeton}?nouveau=1`);
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
