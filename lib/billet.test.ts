import { test } from "node:test";
import assert from "node:assert/strict";
import { bilanReservations, codeDuBillet, contenuQr, libelleStatut, referenceBillet } from "./billet.ts";

const J = "43de68f3efa040c3bf19bb94691865af";

test("le lien du QR code donne le jeton", () => {
  assert.equal(codeDuBillet(`https://begnanandaloacup.com/billet/${J}`), J);
  assert.equal(codeDuBillet(`https://begnanandaloacup.com/billet/${J.toUpperCase()}?x=1`), J);
  assert.equal(codeDuBillet(` ${J} `), J);
});

test("le contenu du QR code (sans lien) redonne le jeton", () => {
  assert.equal(contenuQr(J.toUpperCase()), `BDC:${J}`);
  assert.equal(codeDuBillet(contenuQr(J)), J);
  assert.equal(codeDuBillet(`bdc:${J.toUpperCase()}`), J);
});

test("la référence tapée à la main, avec ou sans tiret", () => {
  assert.equal(codeDuBillet("bdc-ey8ktj"), "BDC-EY8KTJ");
  assert.equal(codeDuBillet("BDC EY8KTJ"), "BDC-EY8KTJ");
  assert.equal(codeDuBillet("bdcey8ktj"), "BDC-EY8KTJ");
});

test("la référence d'un billet précis d'une réservation", () => {
  assert.equal(codeDuBillet("bdc-ey8ktj-2"), "BDC-EY8KTJ-2");
  assert.equal(codeDuBillet("BDCEY8KTJ-02"), "BDC-EY8KTJ-2");
  assert.equal(referenceBillet("BDC-EY8KTJ", 2, 3), "BDC-EY8KTJ-2");
  assert.equal(referenceBillet("BDC-EY8KTJ", 1, 1), "BDC-EY8KTJ");
});

test("un autre QR code n'est pas un billet", () => {
  assert.equal(codeDuBillet("https://begnanandaloacup.com/licence/BDC-2026-0001?s=abc"), null);
  assert.equal(codeDuBillet("bonjour"), null);
  assert.equal(codeDuBillet(`https://exemple.com/billet/${J}x`), null);
});

test("libellés des statuts", () => {
  assert.equal(libelleStatut("en attente"), "Réservé · à payer sur place");
  assert.equal(libelleStatut("payée"), "Payé");
});

test("bilan des tickets réservés : total, par catégorie et par match", () => {
  const b = (match_id: string, categorie_id: string, paye = false, entre = false) => ({ match_id, categorie_id, paye, entre });
  const bilan = bilanReservations([b("m1", "gradins"), b("m1", "gradins", true, true), b("m1", "vip", true), b("m2", "gradins")]);
  assert.deepEqual(bilan.total, { reserves: 4, payes: 2, aPayer: 2, entres: 1 });
  assert.deepEqual(bilan.parCategorie.get("gradins"), { reserves: 3, payes: 1, aPayer: 2, entres: 1 });
  assert.deepEqual(bilan.parMatch.get("m1")?.total, { reserves: 3, payes: 2, aPayer: 1, entres: 1 });
  assert.deepEqual(bilan.parMatch.get("m1")?.parCategorie.get("vip"), { reserves: 1, payes: 1, aPayer: 0, entres: 0 });
  assert.equal(bilan.parMatch.get("m2")?.total.reserves, 1);
  assert.equal(bilanReservations([]).total.reserves, 0);
});
