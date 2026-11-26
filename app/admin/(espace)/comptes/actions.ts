"use server";

import { revalidatePath } from "next/cache";
import { coche, texte, type Etat } from "@/lib/admin";
import { exigerAcces } from "@/lib/auth";
import { emailDepuisIdentifiant } from "@/lib/identifiant";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ROLES_ORGANISATEURS, type RoleOrganisateur } from "@/lib/types";

// Les comptes de présidents se créent en acceptant la demande d'inscription du club, ou ici pour un club déjà inscrit.
const roleValide = (r: string): r is RoleOrganisateur => (ROLES_ORGANISATEURS as readonly string[]).includes(r);

/**
 * Crée le compte d'un organisateur avec un mot de passe provisoire,
 * à lui remettre en main propre : il le change dès sa première connexion.
 */
export async function creerCompte(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("comptes");
  const nom = texte(f, "nom");
  const role = texte(f, "role");
  const mdp = texte(f, "motdepasse");
  if (!texte(f, "email") || !nom || !roleValide(role)) return { erreur: "Identifiant, nom et rôle sont obligatoires." };
  const id = emailDepuisIdentifiant(texte(f, "email"));
  if ("erreur" in id) return { erreur: id.erreur };
  const { email } = id;
  if (mdp.length < 10) return { erreur: "Mot de passe provisoire : 10 caractères minimum." };

  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password: mdp, email_confirm: true });
  if (error || !data.user) return { erreur: error?.message.includes("already") ? "Cet identifiant est déjà utilisé." : "Création impossible." };
  const { error: e2 } = await admin.from("profils").insert({ user_id: data.user.id, nom, role });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { erreur: "Création impossible." };
  }
  revalidatePath("/admin/comptes");
  return { ok: `Compte créé pour ${nom}. Remettez-lui le mot de passe provisoire en main propre.` };
}

/**
 * Compte du président d'un club déjà inscrit (équipes officielles ajoutées par le comité),
 * avec un mot de passe provisoire à lui remettre en main propre. Remplit aussi sa fiche
 * de président (carte validée) si le club n'en a pas encore.
 */
export async function creerComptePresident(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("comptes");
  const clubId = texte(f, "club_id");
  const nom = texte(f, "nom").slice(0, 60);
  const prenoms = texte(f, "prenoms").slice(0, 80);
  const telephone = texte(f, "telephone").slice(0, 30) || null;
  const mdp = texte(f, "motdepasse");
  if (!clubId || !nom || !prenoms || !texte(f, "email")) return { erreur: "Club, nom, prénoms et identifiant sont obligatoires." };
  const id = emailDepuisIdentifiant(texte(f, "email"));
  if ("erreur" in id) return { erreur: id.erreur };
  if (mdp.length < 10) return { erreur: "Mot de passe provisoire : 10 caractères minimum." };

  const admin = createServiceClient();
  const { data: club } = await admin.from("clubs").select("id, nom").eq("id", clubId).maybeSingle();
  if (!club) return { erreur: "Club introuvable." };
  const { count } = await admin.from("presidents").select("user_id", { count: "exact", head: true }).eq("club_id", club.id);
  if (count) return { erreur: `${club.nom} a déjà un compte président : utilisez « Mot de passe oublié ? » plus bas.` };

  const { data, error } = await admin.auth.admin.createUser({ email: id.email, password: mdp, email_confirm: true });
  if (error || !data.user) return { erreur: error?.message.includes("already") ? "Cet identifiant est déjà utilisé." : "Création impossible." };
  const nomComplet = `${prenoms} ${nom}`;
  const { error: e2 } = await admin.from("presidents").insert({ user_id: data.user.id, club_id: club.id, nom: nomComplet });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { erreur: "Création impossible." };
  }
  // Fiche du président, créée avec la session de l'administrateur : seule la base du comité valide une carte.
  const db = await createClient();
  const { data: fiche } = await db.from("encadrants").select("id").eq("club_id", club.id).eq("fonction", "président").maybeSingle();
  if (!fiche) await db.from("encadrants").insert({ club_id: club.id, fonction: "président", nom, prenoms, telephone, valide: true });

  revalidatePath("/admin/comptes");
  return { ok: `Compte créé pour ${nomComplet} (${club.nom}). Identifiant : « ${texte(f, "email").trim().toLowerCase()} ». Remettez-lui le mot de passe provisoire en main propre ; il se connecte sur /espace-club.` };
}

export async function modifierCompte(_: Etat, f: FormData): Promise<Etat> {
  const moi = await exigerAcces("comptes");
  const id = texte(f, "id");
  const role = texte(f, "role");
  const actif = coche(f, "actif");
  if (!roleValide(role)) return { erreur: "Rôle invalide." };
  if (id === moi.id && (role !== "admin" || !actif)) return { erreur: "Vous ne pouvez pas retirer vos propres droits d'administrateur." };
  const { error } = await createServiceClient().from("profils").update({ role, actif }).eq("user_id", id);
  if (error) return { erreur: "Modification impossible." };
  revalidatePath("/admin/comptes");
  return { ok: "Enregistré." };
}

/**
 * Mot de passe oublié : l'administrateur fixe un mot de passe provisoire, à remettre en main propre.
 * Seulement pour un organisateur ou un président de club, jamais pour un autre compte.
 */
export async function nouveauMotDePasse(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("comptes");
  const id = texte(f, "id");
  const mdp = texte(f, "motdepasse");
  if (mdp.length < 10) return { erreur: "Mot de passe provisoire : 10 caractères minimum." };
  const admin = createServiceClient();
  const [{ data: profil }, { data: president }] = await Promise.all([
    admin.from("profils").select("user_id").eq("user_id", id).maybeSingle(),
    admin.from("presidents").select("user_id").eq("user_id", id).maybeSingle(),
  ]);
  if (!profil && !president) return { erreur: "Compte introuvable." };
  const { error } = await admin.auth.admin.updateUserById(id, { password: mdp });
  if (error) {
    console.error(error);
    return { erreur: "Modification impossible. Réessayez." };
  }
  return { ok: "Nouveau mot de passe enregistré. Remettez-le en main propre : il le changera après connexion." };
}
