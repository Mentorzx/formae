import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWhitespace, sanitizeText, sanitizeUrl } from "../src/sanitize.js";

test("sanitizeUrl strips credentials, query strings and fragments", () => {
  assert.equal(
    sanitizeUrl("https://user:pass@sigaa.ufba.br/sigaa/mobile/touch/login.jsf?foo=bar#section"),
    "https://sigaa.ufba.br/sigaa/mobile/touch/login.jsf",
  );
});

test("normalizeWhitespace collapses spacing", () => {
  assert.equal(normalizeWhitespace("  login \n   ok\t"), "login ok");
});

test("sanitizeText normalizes visible text", () => {
  assert.equal(sanitizeText("  login \n   ok\t"), "login ok");
});
