import "server-only";
import { createPublicClient, supabaseConfigured } from "./supabase/server";
import type { ActualiteClub, Alerte, CommentaireClub, JoueurPublic, Partenaire, Buteur, CategorieBillet, EvenementMatch, Club, LigneClassement, Match, Photo, Publication, TirAuBut, Tournoi } from "./types";

const TOURNOI_PAR_DEFAUT: Tournoi = {
  nom: "BÊGNANAN DALOA CUP",
  lieu: "Espace CP1–Orly, Daloa",
  date_debut: "2026-11-22",
  date_fin: "2027-01-01",
  dates_confirmees: false,
  accroche:
    "32 équipes, un terrain de latérite et un seul trophée. Suivez les matchs, les résultats et les classements de la compétition, en direct depuis votre téléphone.",
  capacite_clubs: 32,
};

// Tant que Supabase n'est pas branché, le site s'affiche avec des listes vides
// au lieu de planter : utile pour le premier déploiement.
// Si la base ne répond pas, on lève une erreur plutôt que d'afficher une page vide (« aucun match »,
// « billetterie fermée ») : le site garde la dernière version en cache, sinon il affiche app/error.tsx.
async function lire<T>(requete: (db: ReturnType<typeof createPublicClient>) => PromiseLike<{ data: T | null; error: unknown }>, vide: T): Promise<T> {
  if (!supabaseConfigured) return vide;
  const db = createPublicClient();
  const { data, error } = await requete(db);
  if (error) {
    // Table pas encore créée (migration en attente) : la fonction correspondante reste vide.
    if (["PGRST205", "PGRST202", "42P01"].includes((error as { code?: string }).code ?? "")) return vide;
    console.error(error);
    throw new Error("Base de données indisponible");
  }
  return data ?? vide;
}

export const getTournoi = () =>
  lire<Tournoi>((db) => db.from("tournoi").select("*").eq("id", 1).single(), TOURNOI_PAR_DEFAUT);

/** Saison imprimée sur les cartes : l'année où commence le tournoi, même si les cartes sont imprimées l'année suivante. */
export const getSaison = async () => Number.parseInt((await getTournoi()).date_debut.slice(0, 4), 10);

export const getClubs = () =>
  lire<Club[]>((db) => db.from("clubs").select("*").order("poule").order("nom"), []);

export const getMatchs = () =>
  lire<Match[]>((db) => db.from("matchs").select("*").order("date_heure"), []);

export const getClassement = () =>
  lire<(LigneClassement & { poule: string })[]>((db) => db.from("classement").select("*"), []);

export const getCategories = () =>
  lire<CategorieBillet[]>((db) => db.from("categories_billet").select("*").eq("en_vente", true).order("ordre"), []);

export const getPublications = () =>
  lire<Publication[]>(
    (db) => db.from("publications").select("*").eq("publiee", true).order("publiee_le", { ascending: false }),
    [],
  );

export const getGalerie = () =>
  lire<Photo[]>((db) => db.from("galerie").select("*").eq("publiee", true).order("ordre"), []);

/** Indexe les clubs par identifiant pour retrouver noms et couleurs dans les matchs. */
export const parId = <T extends { id: string }>(liste: T[]) => new Map(liste.map((x) => [x.id, x]));

/** Places restantes par catégorie pour un match (ventes payées et en attente déduites). */
export const getPlacesRestantes = (matchId: string) =>
  lire<{ categorie_id: string; restantes: number }[]>(
    (db) => db.rpc("places_restantes", { p_match: matchId }),
    [],
  );

/** Dernières annonces du comité (incidents, reports, annulations…). */
/** Places restantes de chaque match à venir, par catégorie en vente (formulaire de réservation). */
export const getPlacesMatchs = () =>
  lire<{ match_id: string; categorie_id: string; restantes: number }[]>((db) => db.rpc("places_matchs_a_venir"), []);

export const getAlertes = (nombre = 10) =>
  lire<Alerte[]>((db) => db.from("alertes").select("*").order("publiee_le", { ascending: false }).limit(nombre), []);

/** Buts et cartons d'un match, dans l'ordre du match. */
export const getEvenements = (matchId: string) =>
  lire<EvenementMatch[]>(
    (db) => db.from("evenements_match").select("*").eq("match_id", matchId).order("minute", { nullsFirst: false }).order("cree_le"),
    [],
  );

export const getTirsAuBut = (matchId: string) =>
  lire<TirAuBut[]>((db) => db.from("tirs_au_but").select("*").eq("match_id", matchId).order("ordre"), []);

/** Buteurs et cartons du tournoi (vue « buteurs »). */
export const getButeurs = () => lire<Buteur[]>((db) => db.from("buteurs").select("*"), []);

/** Joueurs à licence active d'un club (sans date de naissance ni numéro de licence). */
export const getEffectif = (clubId: string) =>
  lire<JoueurPublic[]>((db) => db.rpc("effectif_public", { p_club: clubId }), []);

/** Actualités des clubs, les plus récentes d'abord (toutes, ou celles d'un club). */
export const getActualitesClubs = (nombre = 30, clubId?: string) =>
  lire<ActualiteClub[]>((db) => {
    const q = db.from("actualites_club").select("*").eq("masquee", false).order("cree_le", { ascending: false }).limit(nombre);
    return clubId ? q.eq("club_id", clubId) : q;
  }, []);

export const getActualiteClub = (id: string) =>
  lire<ActualiteClub | null>((db) => db.from("actualites_club").select("*").eq("id", id).eq("masquee", false).maybeSingle(), null);

export const getCommentairesClub = (actualiteId: string) =>
  lire<CommentaireClub[]>(
    (db) => db.from("commentaires_club").select("id, actualite_id, auteur, texte, masque, cree_le").eq("actualite_id", actualiteId).eq("masque", false).order("cree_le").limit(300),
    [],
  );

/** Partenaires affichés sur le site : principaux d'abord, puis dans l'ordre choisi. */
export const getPartenaires = async () => {
  const liste = await lire<Partenaire[]>((db) => db.from("partenaires").select("*").eq("visible", true).order("ordre").order("nom"), []);
  const rang = { principal: 0, officiel: 1, soutien: 2 };
  return liste.sort((a, b) => rang[a.niveau] - rang[b.niveau]);
};
