import { test } from "node:test";
import assert from "node:assert/strict";
import { codeDuBillet, contenuQr, libelleStatut } from "./billet.ts";

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

test("un autre QR code n'est pas un billet", () => {
  assert.equal(codeDuBillet("https://begnanandaloacup.com/licence/BDC-2026-0001?s=abc"), null);
  assert.equal(codeDuBillet("bonjour"), null);
  assert.equal(codeDuBillet(`https://exemple.com/billet/${J}x`), null);
});

test("libellés des statuts", () => {
  assert.equal(libelleStatut("en attente"), "Réservé · à payer sur place");
  assert.equal(libelleStatut("payée"), "Payé");
});
