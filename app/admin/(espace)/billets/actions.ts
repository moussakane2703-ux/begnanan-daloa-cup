"use server";

import { coche, ecrire, entier, texte, type Etat } from "@/lib/admin";
import { exigerAcces } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { codeDuBillet, type StatutCommande } from "@/lib/billet";

const categorie = (f: FormData) => ({
  nom: texte(f, "nom"),
  description: texte(f, "description"),
  prix_fcfa: entier(f, "prix_fcfa") ?? 0,
  places_par_match: entier(f, "places_par_match") ?? 0,
  en_vente: coche(f, "en_vente"),
  ordre: entier(f, "ordre") ?? 0,
});

export async function ajouterCategorie(_: Etat, f: FormData): Promise<Etat> {
  const c = categorie(f);
  if (!c.nom) return { erreur: "Donnez un nom à la catégorie." };
  return ecrire("billets", (db) => db.from("categories_billet").insert(c), "Catégorie ajoutée.");
}

// Les commandes gardent le prix payé : modifier un tarif ne touche pas aux ventes passées.
export async function modifierCategorie(_: Etat, f: FormData): Promise<Etat> {
  return ecrire("billets", (db) => db.from("categories_billet").update(categorie(f)).eq("id", texte(f, "id")));
}

export async function supprimerCategorie(_: Etat, f: FormData): Promise<Etat> {
  const r = await ecrire("billets", (db) => db.from("categories_billet").delete().eq("id", texte(f, "id")), "Catégorie supprimée.");
  return r.erreur ? { erreur: "Impossible : des billets ont été vendus. Retirez-la plutôt de la vente." } : r;
}

export interface BilletControle {
  reference: string;
  statut: StatutCommande;
  quantite: number;
  entrees_validees: number;
  total_fcfa: number;
  nom_acheteur: string;
  telephone: string;
  categorie: string;
  date_heure: string;
  terrain: string;
  domicile: string | null;
  exterieur: string | null;
  paye_le: string | null;
  derniere_entree: string | null;
}
export type ResultatControle = { billet?: BilletControle; erreur?: string; ok?: string };

/** Lit un billet scanné (lien du QR code) ou tapé (référence), sans rien modifier. */
export async function chercherBillet(lu: string): Promise<ResultatControle> {
  await exigerAcces("billets");
  const code = codeDuBillet(lu);
  if (!code) return { erreur: "Ce QR code n'est pas un billet du tournoi." };
  const db = await createClient();
  const { data, error } = await db.rpc("controle_billet", { p_code: code });
  if (error) {
    console.error(error);
    return { erreur: "Contrôle impossible. Vérifiez le réseau et réessayez." };
  }
  const billet = (data as BilletControle[] | null)?.[0];
  return billet ? { billet } : { erreur: "Billet inconnu : refuser l'entrée." };
}

/** Encaisse (si besoin) et fait entrer `nombre` personnes. */
export async function faireEntrer(reference: string, nombre: number): Promise<ResultatControle> {
  await exigerAcces("billets");
  const db = await createClient();
  const { error } = await db.rpc("enregistrer_entree", { p_reference: reference, p_nombre: nombre });
  if (error) {
    console.error(error);
    if (error.code === "P0001") return { erreur: error.message };
    return { erreur: "Enregistrement impossible. Vérifiez le réseau et réessayez." };
  }
  revalidatePath("/billetterie");
  const r = await chercherBillet(reference);
  return { ...r, ok: `${nombre} entrée${nombre > 1 ? "s" : ""} enregistrée${nombre > 1 ? "s" : ""}.` };
}

/** Annule une réservation non payée : ses places redeviennent libres. */
export async function annulerReservation(reference: string): Promise<ResultatControle> {
  await exigerAcces("billets");
  const db = await createClient();
  const { error } = await db.rpc("annuler_reservation", { p_reference: reference });
  if (error) {
    console.error(error);
    if (error.code === "P0001") return { erreur: error.message };
    return { erreur: "Annulation impossible. Réessayez." };
  }
  revalidatePath("/billetterie");
  const r = await chercherBillet(reference);
  return { ...r, ok: "Réservation annulée." };
}
