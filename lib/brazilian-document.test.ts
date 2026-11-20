import assert from "node:assert/strict";
import test from "node:test";
import { parseBrazilianDocument } from "./brazilian-document";
import { checkoutAttemptFromPayload } from "./checkout-attempt";

test("validates and normalizes Receita Federal's CPF and CNPJ examples", () => {
  assert.deepEqual(parseBrazilianDocument(" 280.012.389-38 "), { type: "CPF", number: "28001238938" });
  assert.deepEqual(parseBrazilianDocument("12.345.678/0001-95"), {
    type: "CNPJ", number: "12345678000195", alphanumeric: false
  });
  assert.deepEqual(parseBrazilianDocument("00.000.000/0001-91"), {
    type: "CNPJ", number: "00000000000191", alphanumeric: false
  });
  assert.deepEqual(parseBrazilianDocument("12.abc.345/01de-35"), {
    type: "CNPJ", number: "12ABC34501DE35", alphanumeric: true
  });
});

test("rejects wrong check digits, placeholders and malformed input", () => {
  for (const value of [
    "28001238939", "111.111.111-11", "00000000000", "12.345.678/0001-94", "00.000.000/0000-00",
    "12.ABC.345/01DE-36", "12.ABC.345/01DE-A5", "X280.012.389-38", "12.ÁBC.345/01DE-35",
    "12-ABC.345/01DE-35", "12.ABC.345/01DE-350", "", 28001238938, ["28001238938"], null
  ]) {
    assert.equal(parseBrazilianDocument(value), null, `Unexpectedly accepted ${JSON.stringify(value)}`);
  }
});

test("retains the previous checkout attempt hash for a saved CPF payload", () => {
  const checkoutAttemptId = "6beaf47b-3603-4d0c-91be-b9387cc059a6";
  const legacyHash = "ec21286fc2ef24fac184c55e526bf9dcf4126683e37e274130290bf1ccae686f";
  for (const cpf of ["280.012.389-38", "28001238938"]) {
    assert.equal(checkoutAttemptFromPayload({ checkoutAttemptId, customer: { cpf } }).requestHash, legacyHash);
  }
});

test("binds a checkout attempt to every normalized alphanumeric CNPJ character", () => {
  const checkoutAttemptId = "6beaf47b-3603-4d0c-91be-b9387cc059a6";
  const fingerprint = (cpf: string) => checkoutAttemptFromPayload({ checkoutAttemptId, customer: { cpf } }).requestHash;
  assert.equal(fingerprint("12.abc.345/01de-35"), fingerprint("12ABC34501DE35"));
  assert.ok(parseBrazilianDocument("12LBC34501DE35"));
  assert.notEqual(fingerprint("12ABC34501DE35"), fingerprint("12LBC34501DE35"));
});
