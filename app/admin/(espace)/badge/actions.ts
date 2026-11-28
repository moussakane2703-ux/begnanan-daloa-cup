"use server";

import { revalidatePath } from "next/cache";
import { exigerAcces, peutVoir } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type BadgePresident = {
  jeton: string;
  actif: boolean;
  club: string;
  poule: string | null;
  logo_url: string | null;
  disqualifie: boolean;
};
export type ResultatBadge = { badge?: BadgePresident; erreur?: string; valide?: boolean };


/**
 * Vérifie un badge Président d'équipe : réservé aux comptes de l'organisation (espace pro).
 * Le président d'une équipe engagée entre gratuitement aux matchs.
 */
export async function verifierBadge(jeton: string): Promise<ResultatBadge> {
  const orga = await exigerAcces();
  if (orga.role === "president") return { erreur: "Réservé aux comptes de l'organisation." };
  const { data, error } = await createServiceClient()
    .from("badges_presidents")
    .select("jeton, actif, clubs(nom, poule, logo_url, disqualifie)")
    .eq("jeton", jeton)
    .maybeSingle<{ jeton: string; actif: boolean; clubs: { nom: string; poule: string | null; logo_url: string | null; disqualifie: boolean } | null }>();
  if (error) {
    console.error(error);
    return { erreur: "Vérification impossible. Vérifiez le réseau et réessayez." };
  }
  if (!data?.clubs) return { erreur: "Badge inconnu : ce n'est pas un badge délivré par l'organisation. Refuser l'entrée gratuite." };
  const badge = { jeton: data.jeton, actif: data.actif, club: data.clubs.nom, poule: data.clubs.poule, logo_url: data.clubs.logo_url, disqualifie: data.clubs.disqualifie };
  return { badge, valide: badge.actif && !badge.disqualifie };
}

/** Désactive (badge perdu ou volé) ou réactive un badge. Réservé à l'administrateur et au comité. */
export async function changerBadge(jeton: string, actif: boolean): Promise<ResultatBadge> {
  const orga = await exigerAcces();
  if (!peutVoir(orga.role, "cartes")) return { erreur: "Seuls l'administrateur et le comité peuvent désactiver un badge." };
  const { error } = await createServiceClient().from("badges_presidents").update({ actif }).eq("jeton", jeton);
  if (error) {
    console.error(error);
    return { erreur: "Enregistrement impossible. Réessayez." };
  }
  revalidatePath(`/admin/badge/${jeton}`);
  return verifierBadge(jeton);
}
