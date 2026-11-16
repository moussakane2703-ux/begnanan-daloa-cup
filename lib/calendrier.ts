// Tirage au sort des poules et génération du calendrier des matchs de poule.
// Fonctions pures : le hasard est injecté, ce qui permet de les tester.

export const LETTRES_POULES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Mélange de Fisher-Yates ; `hasard(n)` renvoie un entier dans [0, n[. */
export function melanger<T>(liste: readonly T[], hasard: (n: number) => number): T[] {
  const r = [...liste];
  for (let i = r.length - 1; i > 0; i--) {
    const j = hasard(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Tête de série : un seul club par poule ; `poules` limite éventuellement les poules possibles (ex. « FG »). */
export interface TeteDeSerie {
  id: string;
  poules?: string | null;
}

/**
 * Répartit les clubs au hasard dans `nbPoules` poules d'effectifs égaux (à un club près ; les premières
 * poules prennent le club en plus). Les têtes de série sont d'abord placées une par poule, au hasard
 * parmi les poules permises ; tous les autres clubs sont ensuite tirés au hasard dans les places restantes.
 */
export function tirerPoules(
  clubs: readonly string[],
  nbPoules: number,
  hasard: (n: number) => number,
  tetes: readonly TeteDeSerie[] = [],
): Record<string, string[]> {
  if (nbPoules < 1 || nbPoules > LETTRES_POULES.length) throw new Error("Nombre de poules invalide.");
  const lettres: string[] = LETTRES_POULES.slice(0, nbPoules);
  const tetesEngagees = tetes.filter((t) => clubs.includes(t.id));
  if (tetesEngagees.length > nbPoules) throw new Error(`${tetesEngagees.length} têtes de série pour ${nbPoules} poules : une seule par poule est possible.`);
  const permises = (t: TeteDeSerie) => lettres.filter((p) => !t.poules || t.poules.includes(p));

  const poules: Record<string, string[]> = Object.fromEntries(lettres.map((p) => [p, []]));
  // Les têtes de série les plus limitées choisissent en premier, pour qu'aucune ne reste sans poule.
  const libres = new Set(lettres);
  for (const t of melanger(tetesEngagees, hasard).sort((a, b) => permises(a).length - permises(b).length)) {
    const choix = permises(t).filter((p) => libres.has(p));
    if (!choix.length) throw new Error("Impossible de placer toutes les têtes de série avec les poules permises.");
    const p = choix[hasard(choix.length)];
    poules[p].push(t.id);
    libres.delete(p);
  }

  const places = lettres.flatMap((p, i) => {
    const taille = Math.floor(clubs.length / nbPoules) + (i < clubs.length % nbPoules ? 1 : 0);
    return Array<string>(Math.max(0, taille - poules[p].length)).fill(p);
  });
  const ids = new Set(tetesEngagees.map((t) => t.id));
  melanger(clubs.filter((c) => !ids.has(c)), hasard).forEach((c, i) => poules[places[i]].push(c));
  return poules;
}

/**
 * Tous les matchs d'une poule, en journées (méthode du cercle) : chaque club joue une fois
 * par journée (ou est exempt si la poule est impaire), et alterne domicile et extérieur.
 */
export function journeesPoule(clubs: readonly string[]): [string, string][][] {
  const tour: (string | null)[] = [...clubs];
  if (tour.length < 2) return [];
  if (tour.length % 2) tour.push(null);
  const n = tour.length;
  const journees: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const j: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = tour[i];
      const b = tour[n - 1 - i];
      if (a && b) j.push(i === 0 && r % 2 ? [b, a] : [a, b]);
    }
    journees.push(j);
    // Le premier reste fixe, les autres tournent d'un cran.
    tour.splice(1, 0, tour.pop()!);
  }
  return journees;
}

export interface MatchPrevu {
  poule: string;
  journee: number;
  club_domicile: string;
  club_exterieur: string;
  /** Heure de Daloa (UTC toute l'année), au format ISO. */
  date_heure: string;
  terrain: string;
}

export interface OptionsCalendrier {
  /** Premier jour possible, AAAA-MM-JJ. */
  debut: string;
  /** Jours de match, 0 = dimanche … 6 = samedi. */
  jours: number[];
  /** Heures de coup d'envoi, « HH:MM ». */
  heures: string[];
  terrains: string[];
}

/**
 * Place les journées de toutes les poules dans le temps : une journée occupe un ou plusieurs
 * jours de match, et la suivante commence un autre jour. Dans une journée, les créneaux sont
 * remplis heure par heure, terrain par terrain, en alternant les poules.
 */
export function genererCalendrier(poules: Record<string, readonly string[]>, o: OptionsCalendrier): MatchPrevu[] {
  if (!o.jours.length || !o.heures.length || !o.terrains.length) throw new Error("Indiquez au moins un jour, une heure et un terrain.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.debut)) throw new Error("Date de début invalide.");
  const heures = [...o.heures].sort();
  const parPoule = Object.entries(poules).map(([p, clubs]) => [p, journeesPoule(clubs)] as const);
  const nbJournees = Math.max(0, ...parPoule.map(([, j]) => j.length));

  const jour = new Date(`${o.debut}T00:00:00Z`);
  const avancerAuJourDeMatch = () => {
    while (!o.jours.includes(jour.getUTCDay())) jour.setUTCDate(jour.getUTCDate() + 1);
  };
  const prevus: MatchPrevu[] = [];

  for (let r = 0; r < nbJournees; r++) {
    // Entrelace les poules : A1, B1, C1…, A2, B2… pour que chaque poule joue tôt.
    const matchs: Omit<MatchPrevu, "date_heure" | "terrain">[] = [];
    const listes = parPoule.map(([p, j]) => (j[r] ?? []).map(([d, e]) => ({ poule: p, journee: r + 1, club_domicile: d, club_exterieur: e })));
    for (let i = 0; listes.some((l) => i < l.length); i++) for (const l of listes) if (l[i]) matchs.push(l[i]);
    if (!matchs.length) continue;

    avancerAuJourDeMatch();
    let creneau = 0;
    for (const m of matchs) {
      if (creneau === heures.length * o.terrains.length) {
        jour.setUTCDate(jour.getUTCDate() + 1);
        avancerAuJourDeMatch();
        creneau = 0;
      }
      const h = heures[Math.floor(creneau / o.terrains.length)];
      const terrain = o.terrains[creneau % o.terrains.length];
      prevus.push({ ...m, date_heure: `${jour.toISOString().slice(0, 10)}T${h}:00Z`, terrain });
      creneau++;
    }
    jour.setUTCDate(jour.getUTCDate() + 1);
  }
  return prevus;
}
