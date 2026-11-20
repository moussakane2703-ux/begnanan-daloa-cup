import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signerRequete, verifierSecretPartage, verifierSignatureWebhook } from "./waveSignature.ts";

const SECRET = "wave_sn_WHS_essai";
const CORPS = '{"id":"AE_1","type":"checkout.session.completed","data":{"id":"cos-1","amount":"600"}}';
const T = 1_800_000_000;
const sig = (secret: string, t: number, corps: string) => createHmac("sha256", secret).update(`${t}${corps}`).digest("hex");

test("signature Wave valide acceptée", () => {
  assert.equal(verifierSignatureWebhook(`t=${T},v1=${sig(SECRET, T, CORPS)}`, CORPS, SECRET, T + 10), true);
});

test("un des v1 suffit pendant un changement de secret", () => {
  const entete = `t=${T}, v1=${sig("ancien", T, CORPS)}, v1=${sig(SECRET, T, CORPS)}`;
  assert.equal(verifierSignatureWebhook(entete, CORPS, SECRET, T), true);
});

test("corps modifié, mauvais secret ou en-tête absent : refusé", () => {
  const ok = `t=${T},v1=${sig(SECRET, T, CORPS)}`;
  assert.equal(verifierSignatureWebhook(ok, CORPS.replace("600", "6000"), SECRET, T), false);
  assert.equal(verifierSignatureWebhook(ok, CORPS, "autre", T), false);
  assert.equal(verifierSignatureWebhook(null, CORPS, SECRET, T), false);
  assert.equal(verifierSignatureWebhook(`t=${T}`, CORPS, SECRET, T), false);
  assert.equal(verifierSignatureWebhook(`t=${T},v1=zz`, CORPS, SECRET, T), false);
});

test("signature trop ancienne refusée (rejeu)", () => {
  assert.equal(verifierSignatureWebhook(`t=${T},v1=${sig(SECRET, T, CORPS)}`, CORPS, SECRET, T + 301), false);
});

test("signature de nos appels à l'API", () => {
  assert.equal(signerRequete("wave_sn_AKS_x", "", T), `t=${T},v1=${sig("wave_sn_AKS_x", T, "")}`);
});

test("secret partagé (Authorization: Bearer)", () => {
  assert.equal(verifierSecretPartage(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(verifierSecretPartage("Bearer autre", SECRET), false);
  assert.equal(verifierSecretPartage(null, SECRET), false);
});
