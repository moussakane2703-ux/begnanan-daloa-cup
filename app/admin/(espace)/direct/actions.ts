"use server";

import { ecrire, entier, texte, type Etat } from "@/lib/admin";
import { exigerAcces } from "@/lib/auth";
import { bilanTirs, minuteDeJeu, secondesJouees, suites, type Durees } from "@/lib/chrono";
import { createClient } from "@/lib/supabase/server";
import { EVENEMENTS, type Match, type Periode, type TirAuBut, type TypeEvenement } from "@/lib/types";

// Saisie en direct. Le score du match est recalculé par la base à chaque but ajouté ou retiré.

const TYPES = ["but", "csc", "jaune", "rouge"];

export async function ajouterEvenement(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("direct");
  const type = texte(f, "type");
  const matchId = texte(f, "match_id");
  const equipe = texte(f, "club_id");
  const joueurId = texte(f, "joueur_id") || null;
  const minute = entier(f, "minute");
  if (!TYPES.includes(type)) return { erreur: "Choisissez but, but contre son camp ou carton." };
  if (minute !== null && (Number.isNaN(minute) || minute < 0 || minute > 130)) return { erreur: "Minute invalide." };

  const db = await createClient();
  const [{ data: m }, { data: j }, durees] = await Promise.all([
    db.from("matchs").select("*").eq("id", matchId).single<Match>(),
    joueurId ? db.from("joueurs").select("nom, prenoms").eq("id", joueurId).single() : Promise.resolve({ data: null }),
    lireDurees(db),
  ]);
  if (!m) return { erreur: "Match introuvable." };
  // Minute laissée vide : celle du chrono.
  const minuteJouee = minute ?? minuteDeJeu(m, durees)?.valeur ?? null;
  // Un but contre son camp est compté à l'adversaire de l'équipe du joueur.
  const club = type === "csc" ? (equipe === m.club_domicile ? m.club_exterieur : m.club_domicile) : equipe;
  const libelle = EVENEMENTS[type as TypeEvenement].libelle;
  return ecrire(
    "direct",
    (d) => d.from("evenements_match").insert({ match_id: matchId, club_id: club, type, joueur_id: joueurId, joueur_nom: j ? `${j.prenoms} ${j.nom}` : null, minute: minuteJouee, ...periodeSaisie(m) }),
    `${libelle} enregistré${type === "but" || type === "csc" ? " : score mis à jour" : ""}.`,
  );
}

// Période du but (détail par mi-temps sur les cartes de match). Rien tant que la migration 0016 n'est pas faite.
const periodeSaisie = (m: Match) => (m.periode && m.periode !== "tab" && "hdm_nom" in m ? { periode: m.periode } : {});

/** Homme du match : un joueur de l'une des deux équipes, ou un nom saisi à la main. */
export async function choisirHommeDuMatch(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("direct");
  const id = texte(f, "match_id");
  const choix = texte(f, "hdm");
  const libre = texte(f, "hdm_libre").slice(0, 150);
  const db = await createClient();
  const { data: m } = await db.from("matchs").select("club_domicile, club_exterieur").eq("id", id).single();
  if (!m) return { erreur: "Match introuvable." };
  let maj: { hdm_joueur_id: string | null; hdm_nom: string | null; hdm_club_id: string | null } = { hdm_joueur_id: null, hdm_nom: null, hdm_club_id: null };
  if (choix.startsWith("libre:")) {
    const club = choix.slice(6);
    if (!libre) return { erreur: "Écrivez le nom du joueur." };
    if (![m.club_domicile, m.club_exterieur].includes(club)) return { erreur: "Équipe invalide." };
    maj = { hdm_joueur_id: null, hdm_nom: libre, hdm_club_id: club };
  } else if (choix) {
    const { data: j } = await db.from("joueurs").select("id, nom, prenoms, club_id").eq("id", choix).single();
    if (!j || ![m.club_domicile, m.club_exterieur].includes(j.club_id)) return { erreur: "Ce joueur ne joue pas ce match." };
    maj = { hdm_joueur_id: j.id, hdm_nom: `${j.prenoms} ${j.nom}`, hdm_club_id: j.club_id };
  }
  return ecrire("direct", (d) => d.from("matchs").update(maj).eq("id", id), maj.hdm_nom ? `Homme du match : ${maj.hdm_nom}.` : "Homme du match retiré.");
}

export async function retirerEvenement(_: Etat, f: FormData): Promise<Etat> {
  return ecrire("direct", (db) => db.from("evenements_match").delete().eq("id", texte(f, "id")), "Retiré : score mis à jour.");
}

async function lireDurees(db: Awaited<ReturnType<typeof createClient>>): Promise<Durees> {
  const { data } = await db.from("tournoi").select("*").eq("id", 1).single();
  return { mi_temps: data?.duree_mi_temps ?? null, prolongation: data?.duree_prolongation ?? null };
}

/** Coup d'envoi (le chrono de la 1re mi-temps part) et fin du match. La validation du résultat reste dans « Clubs et matchs ». */
export async function changerStatut(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("direct");
  const statut = texte(f, "statut");
  const id = texte(f, "match_id");
  if (statut !== "en cours" && statut !== "terminé") return { erreur: "Statut invalide." };
  // Coup d'envoi : le score part de 0-0 ; un match terminé sans but reste à 0-0.
  const { data: m } = await (await createClient()).from("matchs").select("*").eq("id", id).single<Match>();
  if (!m) return { erreur: "Match introuvable." };
  const maintenant = new Date();
  // Tant que la migration 0009 n'est pas appliquée, le match n'a pas de chrono.
  const chrono = !("periode" in m)
    ? {}
    : statut === "en cours"
      ? { periode: "mt1", periode_terminee: false, chrono_ecoule: 0, chrono_lance: maintenant.toISOString() }
      : { periode_terminee: true, chrono_ecoule: secondesJouees(m, maintenant.getTime()), chrono_lance: null };
  const maj = { statut, buts_domicile: m.buts_domicile ?? 0, buts_exterieur: m.buts_exterieur ?? 0, modifie_le: maintenant.toISOString(), ...chrono };
  return ecrire(
    "direct",
    (db) => db.from("matchs").update(maj).eq("id", id),
    statut === "en cours" ? "Coup d'envoi : le chrono tourne et le match apparaît « en cours » sur le site." : "Match terminé. Validez le résultat dans « Clubs et matchs ».",
  );
}

/**
 * Commandes du chrono : arrêter et reprendre (blessure, incident), corriger d'une minute,
 * siffler la fin de la période, lancer la période suivante (2e mi-temps, prolongations, tirs au but).
 */
export async function piloterChrono(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("direct");
  const id = texte(f, "match_id");
  const op = texte(f, "op");
  const { data: m } = await (await createClient()).from("matchs").select("*").eq("id", id).single<Match>();
  if (!m || m.statut !== "en cours" || !m.periode) return { erreur: "Lancez d'abord le match (coup d'envoi)." };
  const maintenant = new Date();
  const joue = secondesJouees(m, maintenant.getTime());
  let maj: Partial<Match>;
  let ok = "Enregistré.";
  if (op === "arreter" && m.chrono_lance) {
    maj = { chrono_ecoule: joue, chrono_lance: null };
    ok = "Chrono arrêté.";
  } else if (op === "reprendre" && !m.chrono_lance && !m.periode_terminee && m.periode !== "tab") {
    maj = { chrono_lance: maintenant.toISOString() };
    ok = "Chrono relancé.";
  } else if ((op === "plus" || op === "moins") && !m.periode_terminee && m.periode !== "tab") {
    // On repart de maintenant pour garder le chrono qui tourne (ou arrêté) dans le même état.
    maj = { chrono_ecoule: Math.max(0, joue + (op === "plus" ? 60 : -60)), chrono_lance: m.chrono_lance ? maintenant.toISOString() : null };
    ok = op === "plus" ? "Une minute ajoutée." : "Une minute retirée.";
  } else if (op === "fin_periode" && !m.periode_terminee && m.periode !== "tab") {
    maj = { chrono_ecoule: joue, chrono_lance: null, periode_terminee: true };
    ok = "Fin de la période.";
  } else if (suites(m).includes(op as Periode)) {
    const p = op as Periode;
    maj = { periode: p, periode_terminee: false, chrono_ecoule: 0, chrono_lance: p === "tab" ? null : maintenant.toISOString() };
    ok = p === "tab" ? "Séance de tirs au but : saisissez chaque tir." : "C'est reparti : le chrono tourne.";
  } else {
    return { erreur: "Action impossible à ce moment du match : la page n'était peut-être plus à jour." };
  }
  return ecrire("direct", (db) => db.from("matchs").update({ ...maj, modifie_le: maintenant.toISOString() }).eq("id", id), ok);
}

/** Durées des mi-temps et prolongations, nombre de tireurs aux tirs au but. */
export async function reglerTemps(_: Etat, f: FormData): Promise<Etat> {
  const mt = entier(f, "duree_mi_temps");
  const prol = entier(f, "duree_prolongation");
  const tireurs = entier(f, "tab_tireurs") ?? 3;
  const hors = (v: number | null, max: number) => v !== null && (Number.isNaN(v) || v < 1 || v > max);
  if (hors(mt, 60) || hors(prol, 30) || hors(tireurs, 11)) return { erreur: "Durées invalides." };
  return ecrire(
    "direct",
    (db) => db.from("tournoi").update({ duree_mi_temps: mt, duree_prolongation: prol, tab_tireurs: tireurs, modifie_le: new Date().toISOString() }).eq("id", 1),
    "Temps de jeu enregistré.",
  );
}

/** Un tir de la séance : marqué ou manqué. L'ordre des équipes et la fin de la séance sont contrôlés. */
export async function ajouterTir(_: Etat, f: FormData): Promise<Etat> {
  await exigerAcces("direct");
  const matchId = texte(f, "match_id");
  const club = texte(f, "club_id");
  const joueurId = texte(f, "joueur_id") || null;
  const reussi = texte(f, "reussi");
  if (reussi !== "oui" && reussi !== "non") return { erreur: "Indiquez si le tir est marqué ou manqué." };
  const db = await createClient();
  const [{ data: m }, { data: t }, { data: tournoi }, { data: j }] = await Promise.all([
    db.from("matchs").select("*").eq("id", matchId).single<Match>(),
    db.from("tirs_au_but").select("*").eq("match_id", matchId),
    db.from("tournoi").select("*").eq("id", 1).single(),
    joueurId ? db.from("joueurs").select("nom, prenoms").eq("id", joueurId).single() : Promise.resolve({ data: null }),
  ]);
  if (!m || m.periode !== "tab" || m.statut !== "en cours") return { erreur: "La séance de tirs au but n'est pas lancée." };
  const tirs = (t ?? []) as TirAuBut[];
  const bilan = bilanTirs(tirs, m.club_domicile, m.club_exterieur, tournoi?.tab_tireurs ?? 3);
  if (bilan.vainqueur) return { erreur: "La séance est terminée : sifflez la fin du match." };
  if (bilan.prochain && bilan.prochain !== club) return { erreur: "C'est au tour de l'autre équipe de tirer." };
  const ordre = Math.max(0, ...tirs.map((x) => x.ordre)) + 1;
  return ecrire(
    "direct",
    (d) => d.from("tirs_au_but").insert({ match_id: matchId, club_id: club, ordre, joueur_id: joueurId, joueur_nom: j ? `${j.prenoms} ${j.nom}` : null, reussi: reussi === "oui" }),
    reussi === "oui" ? "Tir marqué." : "Tir manqué.",
  );
}

export async function retirerTir(_: Etat, f: FormData): Promise<Etat> {
  return ecrire("direct", (db) => db.from("tirs_au_but").delete().eq("id", texte(f, "id")), "Tir retiré.");
}
