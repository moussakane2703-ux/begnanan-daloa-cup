"use server";

import { coche, ecrire, entier, texte, type Etat } from "@/lib/admin";
import { exigerAcces } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { codeDuBillet, type StatutBillet } from "@/lib/billet";

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

/** Matchs ouverts à la réservation : les cases cochées, les autres sont fermés. */
export async function definirMatchsOuverts(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("billets");
  const ids = f.getAll("match").map(String);
  const db = await createClient();
  const { data, error } = await db.rpc("definir_matchs_reservables", { p_ids: ids });
  if (error) {
    console.error(error);
    return { erreur: "Enregistrement impossible. Réessayez." };
  }
  revalidatePath("/billetterie");
  return { ok: `${data} match${data > 1 ? "s" : ""} ouvert${data > 1 ? "s" : ""} à la réservation.` };
}

export interface BilletControle {
  jeton: string;
  reference: string;
  numero: number;
  quantite: number;
  statut: StatutBillet;
  prix_unitaire_fcfa: number;
  nom_acheteur: string;
  telephone: string;
  categorie: string;
  date_heure: string;
  terrain: string;
  domicile: string | null;
  exterieur: string | null;
  utilise_le: string | null;
  entrees_commande: number;
}
export type ResultatControle = {
  billet?: BilletControle;
  erreur?: string;
  ok?: string;
  /** Rempli par le scanner : ce billet vient d'être validé (et payé si `payeMaintenant`). */
  valide?: boolean;
  payeMaintenant?: boolean;
};

/** Lit UN billet, scanné (QR code) ou tapé (référence BDC-XXXXXX-2), sans rien modifier. */
export async function chercherBillet(lu: string): Promise<ResultatControle> {
  await exigerAcces("billets");
  const code = codeDuBillet(lu);
  if (!code) return { erreur: "Ce QR code n'est pas un billet du tournoi." };
  const db = await createClient();
  const { data, error } = await db.rpc("controle_billet_unique", { p_code: code });
  if (error) {
    console.error(error);
    if (error.code === "P0001") return { erreur: error.message };
    return { erreur: "Contrôle impossible. Vérifiez le réseau et réessayez." };
  }
  const billet = (data as BilletControle[] | null)?.[0];
  return billet ? { billet } : { erreur: "Billet inconnu : refuser l'entrée." };
}

/** Encaisse (si besoin) et valide ce billet : une personne entre, une seule fois. */
export async function faireEntrer(jeton: string): Promise<ResultatControle> {
  await exigerAcces("billets");
  const db = await createClient();
  const { error } = await db.rpc("entrer_billet", { p_jeton: jeton });
  if (error) {
    console.error(error);
    if (error.code === "P0001") return { ...(await chercherBillet(jeton)), erreur: error.message };
    return { erreur: "Enregistrement impossible. Vérifiez le réseau et réessayez." };
  }
  revalidatePath("/billetterie");
  return { ...(await chercherBillet(jeton)), ok: "Billet validé." };
}

/** Annule la réservation de ce billet si aucun de ses billets n'est payé : ses places redeviennent libres. */
export async function annulerReservation(jeton: string): Promise<ResultatControle> {
  await exigerAcces("billets");
  const db = await createClient();
  const { error } = await db.rpc("annuler_reservation_billet", { p_jeton: jeton });
  if (error) {
    console.error(error);
    if (error.code === "P0001") return { ...(await chercherBillet(jeton)), erreur: error.message };
    return { erreur: "Annulation impossible. Réessayez." };
  }
  revalidatePath("/billetterie");
  return { ...(await chercherBillet(jeton)), ok: "Réservation annulée." };
}
