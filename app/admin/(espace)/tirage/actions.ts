"use server";

import { randomInt } from "node:crypto";
import { coche, ecrire, entier, texte, type Etat } from "@/lib/admin";
import { genererCalendrier, LETTRES_POULES, tirerPoules } from "@/lib/calendrier";
import { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Plusieurs écritures d'affilée : la première erreur est renvoyée. */
const toutes = async (ops: PromiseLike<{ error: { message: string; code?: string } | null }>[]) => ({
  error: (await Promise.all(ops)).find((r) => r.error)?.error ?? null,
});

const clubsEngages = async (db: Db) => {
  const { data } = await db.from("clubs").select("id, poule, disqualifie, tete_de_serie, poules_possibles").order("nom");
  return (data ?? []).filter((c) => !c.disqualifie) as { id: string; poule: string | null; tete_de_serie: boolean; poules_possibles: string | null }[];
};

/** Tirage au sort : les têtes de série sont placées une par poule, puis les autres clubs au hasard. */
export async function tirerAuSort(_: Etat, f: FormData): Promise<Etat> {
  const nb = entier(f, "nb_poules") ?? 0;
  if (nb < 1 || nb > LETTRES_POULES.length) return { erreur: "Choisissez entre 1 et 8 poules." };
  const db = await createClient();
  const clubs = await clubsEngages(db);
  if (clubs.length < nb * 2) return { erreur: `Il faut au moins ${nb * 2} clubs pour ${nb} poules (${clubs.length} engagés).` };
  const tetes = clubs.filter((c) => c.tete_de_serie).map((c) => ({ id: c.id, poules: c.poules_possibles }));
  let poules;
  try {
    poules = tirerPoules(clubs.map((c) => c.id), nb, randomInt, tetes);
  } catch (e) {
    return { erreur: (e as Error).message };
  }
  return ecrire(
    "tirage",
    (db) => toutes(Object.entries(poules).flatMap(([p, ids]) => ids.map((id) => db.from("clubs").update({ poule: p }).eq("id", id)))),
    `Tirage effectué : ${clubs.length} clubs répartis en ${nb} poules. Vous pouvez encore déplacer des clubs ci-dessous.`,
  );
}

/** Corrections manuelles après le tirage. */
export async function enregistrerPoules(_: Etat, f: FormData): Promise<Etat> {
  const changes = [...f.keys()]
    .filter((k) => k.startsWith("poule_"))
    .map((k) => ({ id: k.slice(6), poule: texte(f, k) || null, avant: texte(f, `avant_${k.slice(6)}`) || null }))
    .filter((c) => c.poule !== c.avant);
  if (!changes.length) return { ok: "Aucun changement." };
  if (changes.some((c) => c.poule && !(LETTRES_POULES as readonly string[]).includes(c.poule))) return { erreur: "Poule invalide." };
  return ecrire(
    "tirage",
    (db) => toutes(changes.map((c) => db.from("clubs").update({ poule: c.poule }).eq("id", c.id))),
    `${changes.length} club${changes.length > 1 ? "s" : ""} déplacé${changes.length > 1 ? "s" : ""}.`,
  );
}

/** Calendrier automatique des matchs de poule ; chaque match reste modifiable dans « Clubs et matchs ». */
export async function creerCalendrier(_: Etat, f: FormData): Promise<Etat> {
  const jours = f.getAll("jours").map(Number).filter((j) => j >= 0 && j <= 6);
  // « 15:00 », « 15h », « 15h30 » ou « 9:30 » → « HH:MM ».
  const heures = texte(f, "heures").split(/[\s,;]+/).filter(Boolean).map((h) => {
    const m = /^(\d{1,2})(?:[:h](\d{2})?)?$/i.exec(h);
    return m ? `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` : h;
  });
  const terrains = texte(f, "terrains").split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  if (heures.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) return { erreur: "Heures invalides : écrivez par exemple 15:00, 17:00." };

  const db = await createClient();
  const clubs = await clubsEngages(db);
  const poules: Record<string, string[]> = {};
  for (const c of clubs) if (c.poule) (poules[c.poule] ??= []).push(c.id);
  if (!Object.keys(poules).length) return { erreur: "Faites d'abord le tirage au sort des poules." };

  let prevus;
  try {
    prevus = genererCalendrier(poules, { debut: texte(f, "debut"), jours, heures, terrains });
  } catch (e) {
    return { erreur: (e as Error).message };
  }

  const { count } = await db.from("matchs").select("id", { count: "exact", head: true }).eq("phase", "Poules");
  const remplacer = coche(f, "remplacer");
  if (count && !remplacer) return { erreur: `${count} matchs de poule existent déjà : cochez « Remplacer les matchs de poule programmés » pour recommencer.` };

  return ecrire(
    "tirage",
    async (db) => {
      if (remplacer) {
        const { error } = await db.from("matchs").delete().eq("phase", "Poules").eq("statut", "programmé");
        // Un match pour lequel des billets ont été vendus ne peut pas être supprimé.
        if (error?.code === "23503") return { error: { code: "P0001", message: "Des billets ont déjà été vendus pour des matchs de poule : modifiez ces matchs un par un dans « Clubs et matchs »." } };
        if (error) return { error };
      }
      const { error } = await db.from("matchs").insert(
        prevus.map(({ poule, club_domicile, club_exterieur, date_heure, terrain }) => ({ phase: "Poules", poule, club_domicile, club_exterieur, date_heure, terrain })),
      );
      if (error || !coche(f, "annoncer")) return { error };
      return db.from("alertes").insert({
        type: "calendrier",
        titre: "Le calendrier des poules est publié",
        texte: `${prevus.length} matchs du ${prevus[0].date_heure.slice(8, 10)}/${prevus[0].date_heure.slice(5, 7)} au ${prevus.at(-1)!.date_heure.slice(8, 10)}/${prevus.at(-1)!.date_heure.slice(5, 7)}. Retrouvez les horaires de votre club sur le site, rubrique Matchs.`,
      });
    },
    `Calendrier créé : ${prevus.length} matchs. Chaque match reste modifiable dans « Clubs et matchs ».`,
  );
}
