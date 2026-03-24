import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  PRIVATE_SIGAA_REDACTION_RULES,
  runPrivateFixtureReplay,
} from "../src/privateFixtureReplay.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/private/sigaa",
);

test("redacted SIGAA fixtures replay offline with the expected selectors", async () => {
  const report = await runPrivateFixtureReplay(fixtureRoot);

  assert.equal(report.fixtureCount, 4);
  assert.equal(report.selectorCount, 20);
  assert.equal(report.forbiddenPatternCount, 2);
});

test("redacted SIGAA fixtures do not retain known personal data", async () => {
  const fixtureNames = ["login.html", "portal-home.html", "classes.html", "grades.html"];

  for (const fixtureName of fixtureNames) {
    const html = await readFile(path.join(fixtureRoot, fixtureName), "utf8");

    for (const forbiddenText of PRIVATE_SIGAA_REDACTION_RULES.forbiddenText) {
      assert.ok(
        !html.includes(forbiddenText),
        `${fixtureName} still contains forbidden text ${forbiddenText}`,
      );
    }

    for (const forbiddenPattern of PRIVATE_SIGAA_REDACTION_RULES.forbiddenPatterns) {
      assert.ok(
        !new RegExp(forbiddenPattern, "i").test(html),
        `${fixtureName} still matches forbidden pattern ${forbiddenPattern}`,
      );
    }
  }
});
