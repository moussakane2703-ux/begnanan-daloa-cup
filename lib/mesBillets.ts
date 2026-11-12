/** Billets ouverts sur ce téléphone, gardés dans le navigateur (commodité : le lien reste la vraie clé). */
export interface BilletGarde {
  jeton: string;
  reference: string;
  match: string;
  date: string;
}

const CLE = "bdc-mes-billets";

export function lireMesBillets(): BilletGarde[] {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE) ?? "[]") as BilletGarde[];
    // Les billets des matchs passés depuis plus d'un jour disparaissent de la liste.
    const limite = Date.now() - 24 * 3600 * 1000;
    return Array.isArray(liste) ? liste.filter((b) => b?.jeton && new Date(b.date).getTime() > limite) : [];
  } catch {
    return [];
  }
}

export function garderBillet(b: BilletGarde) {
  try {
    const liste = [b, ...lireMesBillets().filter((x) => x.jeton !== b.jeton)].slice(0, 20);
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // Navigation privée ou stockage bloqué : sans gravité.
  }
}
