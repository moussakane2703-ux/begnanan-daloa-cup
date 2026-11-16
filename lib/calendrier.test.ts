import { test } from "node:test";
import assert from "node:assert/strict";
import { genererCalendrier, journeesPoule, tirerPoules } from "./calendrier.ts";

// Hasard déterministe pour les tests.
const graine = (s: number) => (n: number) => {
  s = (s * 1103515245 + 12345) % 2 ** 31;
  return s % n;
};
const clubs = (n: number) => Array.from({ length: n }, (_, i) => `C${i + 1}`);

test("le tirage répartit 32 clubs en 8 poules de 4, sans doublon ni oubli", () => {
  const p = tirerPoules(clubs(32), 8, graine(7));
  assert.deepEqual(Object.keys(p), ["A", "B", "C", "D", "E", "F", "G", "H"]);
  for (const l of Object.values(p)) assert.equal(l.length, 4);
  assert.deepEqual(Object.values(p).flat().sort(), clubs(32).sort());
});

test("31 clubs en 8 poules : A à G ont 4 clubs, H en a 3", () => {
  const p = tirerPoules(clubs(31), 8, graine(3));
  assert.deepEqual(Object.values(p).map((l) => l.length), [4, 4, 4, 4, 4, 4, 4, 3]);
  assert.deepEqual(Object.values(p).flat().sort(), clubs(31).sort());
});

test("têtes de série : une par poule, et les poules permises sont respectées", () => {
  const tetes = [...clubs(7).map((id) => ({ id })), { id: "C8", poules: "FG" }];
  const vues = new Set<string>();
  for (let g = 1; g <= 200; g++) {
    const p = tirerPoules(clubs(31), 8, graine(g), tetes);
    assert.deepEqual(Object.values(p).map((l) => l.length), [4, 4, 4, 4, 4, 4, 4, 3]);
    assert.deepEqual(Object.values(p).flat().sort(), clubs(31).sort());
    for (const l of Object.values(p)) assert.equal(l.filter((c) => tetes.some((t) => t.id === c)).length, 1);
    const pC8 = Object.keys(p).find((k) => p[k].includes("C8"))!;
    assert.ok(["F", "G"].includes(pC8));
    vues.add(pC8);
  }
  assert.equal(vues.size, 2);
});

test("trop de têtes de série : le tirage refuse", () => {
  assert.throws(() => tirerPoules(clubs(31), 4, graine(1), clubs(5).map((id) => ({ id }))));
});

test("le tirage dépend du hasard", () => {
  assert.notDeepEqual(tirerPoules(clubs(32), 8, graine(1)), tirerPoules(clubs(32), 8, graine(2)));
});

test("poule de 4 : 3 journées de 2 matchs, chaque rencontre une seule fois", () => {
  const j = journeesPoule(clubs(4));
  assert.equal(j.length, 3);
  const rencontres = j.flat().map(([a, b]) => [a, b].sort().join("-"));
  assert.equal(rencontres.length, 6);
  assert.equal(new Set(rencontres).size, 6);
  for (const journee of j) assert.equal(new Set(journee.flat()).size, 4);
});

test("poule impaire : un club exempt par journée", () => {
  const j = journeesPoule(clubs(5));
  assert.equal(j.length, 5);
  assert.equal(j.flat().length, 10);
  for (const journee of j) assert.equal(journee.length, 2);
});

test("calendrier : jours de match respectés, aucune journée ne partage un jour, aucun créneau en double", () => {
  const poules = tirerPoules(clubs(32), 8, graine(3));
  // Le 21/11/2026 est un samedi ; matchs les samedis et dimanches, 3 horaires, 1 terrain.
  const m = genererCalendrier(poules, { debut: "2026-11-21", jours: [6, 0], heures: ["17:00", "15:00", "19:00"], terrains: ["Terrain A"] });
  assert.equal(m.length, 48);
  for (const x of m) assert.ok([0, 6].includes(new Date(x.date_heure).getUTCDay()));
  assert.equal(new Set(m.map((x) => `${x.date_heure}|${x.terrain}`)).size, 48);
  const joursParJournee = new Map<string, number>();
  for (const x of m) {
    const d = x.date_heure.slice(0, 10);
    assert.ok(!joursParJournee.has(d) || joursParJournee.get(d) === x.journee, "deux journées le même jour");
    joursParJournee.set(d, x.journee);
  }
  assert.equal(m[0].date_heure, "2026-11-21T15:00:00Z");
  // Un club ne joue jamais deux fois le même jour.
  const parJour = new Map<string, Set<string>>();
  for (const x of m) {
    const s = parJour.get(x.date_heure.slice(0, 10)) ?? new Set();
    assert.ok(!s.has(x.club_domicile) && !s.has(x.club_exterieur));
    s.add(x.club_domicile).add(x.club_exterieur);
    parJour.set(x.date_heure.slice(0, 10), s);
  }
});

test("calendrier : refuse une configuration vide", () => {
  assert.throws(() => genererCalendrier({ A: clubs(4) }, { debut: "2026-11-21", jours: [], heures: ["15:00"], terrains: ["T"] }));
});
