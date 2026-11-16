"use server";

import { coche, ecrire, texte, texteOuNull, type Etat } from "@/lib/admin";
import { exigerClub } from "@/lib/auth";

/**
 * Enregistre la composition du club pour un match : pour chaque joueur, titulaire, remplaçant ou
 * absent (champ « r_<id> »), le capitaine, le coach, et si elle est publiée sur le site.
 * La base vérifie que les joueurs sont ceux du club, licence active, et que le match n'a pas commencé.
 */
export async function enregistrerComposition(_: Etat, f: FormData): Promise<Etat> {
  const { club_id } = await exigerClub();
  const titulaires: string[] = [];
  const remplacants: string[] = [];
  for (const [cle, valeur] of f.entries()) {
    if (!cle.startsWith("r_")) continue;
    if (valeur === "t") titulaires.push(cle.slice(2));
    if (valeur === "r") remplacants.push(cle.slice(2));
  }
  if (!titulaires.length) return { erreur: "Choisissez au moins un titulaire." };
  const capitaine = texte(f, "capitaine") || null;
  if (capitaine && !titulaires.includes(capitaine) && !remplacants.includes(capitaine)) return { erreur: "Le capitaine doit être titulaire ou remplaçant." };
  const publiee = coche(f, "publiee");
  return ecrire(
    "club",
    (db) =>
      db.from("compositions").upsert({
        match_id: texte(f, "match_id"),
        club_id,
        titulaires,
        remplacants,
        capitaine,
        coach: texteOuNull(f, "coach")?.slice(0, 150) ?? null,
        publiee,
      }),
    publiee ? `Composition publiée : ${titulaires.length} titulaires, ${remplacants.length} remplaçants.` : "Composition enregistrée (pas encore visible sur le site).",
  );
}

export async function retirerComposition(_: Etat, f: FormData): Promise<Etat> {
  const { club_id } = await exigerClub();
  return ecrire("club", (db) => db.from("compositions").delete().eq("match_id", texte(f, "match_id")).eq("club_id", club_id), "Composition retirée.");
}
