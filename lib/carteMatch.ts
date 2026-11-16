import type { EvenementMatch, Match, Periode } from "./types.ts";

// Données d'une carte de match : score par mi-temps et buteurs, calculés à partir des buts saisis.

type PeriodeJeu = Exclude<Periode, "tab">;
type Score = [number, number];

export interface DetailScore {
  mt1: Score | null;
  mt2: Score | null;
  /** Buts des prolongations (les deux réunies), null s'il n'y en a pas eu. */
  prol: Score | null;
}

/** Période d'un but : celle enregistrée, sinon déduite de la minute et de la durée d'une mi-temps. */
export function periodeDuBut(e: Pick<EvenementMatch, "periode" | "minute">, miTemps: number | null): PeriodeJeu | null {
  if (e.periode) return e.periode;
  if (e.minute === null || !miTemps) return null;
  if (e.minute <= miTemps) return "mt1";
  if (e.minute <= 2 * miTemps) return "mt2";
  return "prol1";
}

const estBut = (e: EvenementMatch) => e.type === "but" || e.type === "csc";

/**
 * Détail « 1re MT / 2e MT » d'un match joué. Priorité aux buts saisis en direct (si tous ont une période),
 * sinon au score de la mi-temps saisi à la main. Null quand on ne peut pas le savoir.
 */
export function detailScore(m: Match, evenements: EvenementMatch[], miTemps: number | null): DetailScore | null {
  if (m.buts_domicile === null || m.buts_exterieur === null) return null;
  const buts = evenements.filter((e) => e.match_id === m.id && estBut(e));
  const final: Score = [m.buts_domicile, m.buts_exterieur];
  const total = final[0] + final[1];
  if (buts.length === total) {
    const periodes = buts.map((e) => periodeDuBut(e, miTemps));
    if (periodes.every((p) => p !== null)) {
      const compter = (ps: PeriodeJeu[]): Score => [
        buts.filter((e, i) => ps.includes(periodes[i]!) && e.club_id === m.club_domicile).length,
        buts.filter((e, i) => ps.includes(periodes[i]!) && e.club_id === m.club_exterieur).length,
      ];
      const prolongations = m.periode === "prol1" || m.periode === "prol2" || m.periode === "tab" || periodes.some((p) => p === "prol1" || p === "prol2");
      return { mt1: compter(["mt1"]), mt2: compter(["mt2"]), prol: prolongations ? compter(["prol1", "prol2"]) : null };
    }
  }
  if (m.mt_buts_domicile != null && m.mt_buts_exterieur != null) {
    const mt1: Score = [m.mt_buts_domicile, m.mt_buts_exterieur];
    const mt2: Score = [final[0] - mt1[0], final[1] - mt1[1]];
    return mt2[0] >= 0 && mt2[1] >= 0 ? { mt1, mt2, prol: null } : { mt1, mt2: null, prol: null };
  }
  return null;
}

export interface LigneButeur {
  nom: string;
  minutes: string[];
  csc: boolean;
}

/** Buteurs d'une équipe, regroupés par joueur avec leurs minutes (« Koné 12', 40' »). */
export function buteursEquipe(evenements: EvenementMatch[], matchId: string, clubId: string): LigneButeur[] {
  const lignes = new Map<string, LigneButeur>();
  for (const e of evenements) {
    if (e.match_id !== matchId || e.club_id !== clubId || !estBut(e)) continue;
    const nom = e.joueur_nom ?? "But";
    const cle = `${nom}|${e.type}`;
    const l = lignes.get(cle) ?? { nom, minutes: [], csc: e.type === "csc" };
    if (e.minute !== null) l.minutes.push(`${e.minute}'`);
    lignes.set(cle, l);
  }
  return [...lignes.values()];
}

/** Texte court d'une période (« 1-0 »). */
export const texteScore = (s: Score) => `${s[0]}-${s[1]}`;

/** Libellé de la phase affiché sur les cartes (« Poule A », « Huitièmes »…). */
export const libellePhase = (m: Pick<Match, "phase" | "poule">) => (m.poule ? `Poule ${m.poule}` : m.phase);
