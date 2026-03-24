import assert from "node:assert/strict";
import test from "node:test";
import {
  createSigaaDomContract,
  identifySigaaPage,
  normalizeSigaaText,
} from "./dom-contract.js";

test("identifies core SIGAA page kinds from the URL", () => {
  assert.equal(
    identifySigaaPage("https://sigaa.ufba.br/sigaa/mobile/touch/login.jsf"),
    "login",
  );
  assert.equal(
    identifySigaaPage("https://sigaa.ufba.br/sigaa/consultarHistorico.do"),
    "history",
  );
});

test("exposes selector contracts for known page kinds", () => {
  const contract = createSigaaDomContract("login");

  assert.equal(contract.selectorVersion, "sigaa-contract-v1");
  assert.equal(contract.selectors.usernameInput, 'input[name="user"]');
});

test("normalizes whitespace from extracted text", () => {
  assert.equal(normalizeSigaaText("  MATA37   35N12  "), "MATA37 35N12");
});
