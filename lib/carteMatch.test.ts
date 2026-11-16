import { test } from "node:test";
import assert from "node:assert/strict";
import { buteursEquipe, detailScore, periodeDuBut } from "./carteMatch.ts";
import type { EvenementMatch, Match } from "./types.ts";

const match = (x: Partial<Match> = {}): Match => ({
  id: "m", phase: "Poules", poule: "A", club_domicile: "a", club_exterieur: "b", date_heure: "2026-11-22T16:00:00Z",
  terrain: "Terrain A", statut: "terminé", buts_domicile: 2, buts_exterieur: 1, resultat_valide: true, ...x,
});
const but = (club: string, x: Partial<EvenementMatch> = {}): EvenementMatch => ({
  id: Math.random().toString(), match_id: "m", club_id: club, type: "but", joueur_id: null, joueur_nom: "Koné", minute: null, cree_le: "", ...x,
});

test("période déduite de la minute", () => {
  assert.equal(periodeDuBut({ periode: null, minute: 10 }, 20), "mt1");
  assert.equal(periodeDuBut({ periode: null, minute: 25 }, 20), "mt2");
  assert.equal(periodeDuBut({ periode: null, minute: 45 }, 20), "prol1");
  assert.equal(periodeDuBut({ periode: null, minute: 10 }, null), null);
  assert.equal(periodeDuBut({ periode: "mt2", minute: 1 }, 20), "mt2");
});

test("détail par mi-temps à partir des buts saisis", () => {
  const ev = [but("a", { periode: "mt1" }), but("b", { periode: "mt2" }), but("a", { periode: "mt2" })];
  assert.deepEqual(detailScore(match(), ev, 20), { mt1: [1, 0], mt2: [1, 1], prol: null });
});

test("score de mi-temps saisi à la main quand les buts ne sont pas tous connus", () => {
  assert.deepEqual(detailScore(match({ mt_buts_domicile: 1, mt_buts_exterieur: 1 }), [], 20), { mt1: [1, 1], mt2: [1, 0], prol: null });
  assert.equal(detailScore(match(), [], 20), null);
  assert.equal(detailScore(match({ buts_domicile: null }), [], 20), null);
});

test("prolongations", () => {
  const ev = [but("a", { periode: "mt1" }), but("b", { periode: "mt2" }), but("a", { periode: "prol2" })];
  assert.deepEqual(detailScore(match(), ev, 20), { mt1: [1, 0], mt2: [0, 1], prol: [1, 0] });
});

test("buteurs regroupés par joueur", () => {
  const ev = [but("a", { minute: 3 }), but("a", { minute: 18 }), but("a", { joueur_nom: "Traoré", type: "csc", minute: 30 }), but("b")];
  assert.deepEqual(buteursEquipe(ev, "m", "a"), [
    { nom: "Koné", minutes: ["3'", "18'"], csc: false },
    { nom: "Traoré", minutes: ["30'"], csc: true },
  ]);
});
