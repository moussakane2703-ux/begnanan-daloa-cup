// Tableau des phases finales (des 8es à la finale), validé par le comité le 17/11/2026.
// Les 2 premiers de chaque poule sont qualifiés ; un 1er et un 2e d'une même poule ne peuvent se retrouver qu'en finale.

export interface RencontreFinale {
  code: string;
  date: string;
  equipes: [string, string];
}

/** Moitié gauche du tableau (mène à la demie 1). */
export const COTE_GAUCHE = {
  huitiemes: [
    { code: "8e 1", date: "Mer. 16/12 · 15 h", equipes: ["1er A", "2e B"] },
    { code: "8e 3", date: "Jeu. 17/12 · 15 h", equipes: ["1er C", "2e D"] },
    { code: "8e 5", date: "Ven. 18/12 · 15 h", equipes: ["1er E", "2e F"] },
    { code: "8e 7", date: "Sam. 19/12 · 15 h", equipes: ["1er G", "2e H"] },
  ],
  quarts: [
    { code: "Quart 1", date: "Mar. 22/12 · 15 h", equipes: ["Vainq. 8e 1", "Vainq. 8e 3"] },
    { code: "Quart 3", date: "Mer. 23/12 · 15 h", equipes: ["Vainq. 8e 5", "Vainq. 8e 7"] },
  ],
  demie: { code: "Demie 1", date: "Dim. 27/12 · 15 h", equipes: ["Vainq. quart 1", "Vainq. quart 3"] },
} satisfies Record<string, RencontreFinale[] | RencontreFinale>;

/** Moitié droite du tableau (mène à la demie 2). */
export const COTE_DROIT = {
  huitiemes: [
    { code: "8e 2", date: "Mer. 16/12 · 17 h", equipes: ["1er B", "2e A"] },
    { code: "8e 4", date: "Jeu. 17/12 · 17 h", equipes: ["1er D", "2e C"] },
    { code: "8e 6", date: "Ven. 18/12 · 17 h", equipes: ["1er F", "2e E"] },
    { code: "8e 8", date: "Sam. 19/12 · 17 h", equipes: ["1er H", "2e G"] },
  ],
  quarts: [
    { code: "Quart 2", date: "Mar. 22/12 · 17 h", equipes: ["Vainq. 8e 2", "Vainq. 8e 4"] },
    { code: "Quart 4", date: "Mer. 23/12 · 17 h", equipes: ["Vainq. 8e 6", "Vainq. 8e 8"] },
  ],
  demie: { code: "Demie 2", date: "Dim. 27/12 · 17 h", equipes: ["Vainq. quart 2", "Vainq. quart 4"] },
} satisfies Record<string, RencontreFinale[] | RencontreFinale>;

export const FINALE: RencontreFinale = { code: "Finale", date: "Ven. 1er janvier 2027 · 16 h", equipes: ["Vainq. demie 1", "Vainq. demie 2"] };
