import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("extension manifest is hardened for release and Firefox portability", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["scripting", "storage", "tabs"]);
  assert.equal(manifest.browser_specific_settings.gecko.id, "formae-extension@formae.local");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "128.0");
  assert.ok(manifest.host_permissions.includes("https://sigaa.ufba.br/*"));
  assert.ok(manifest.host_permissions.includes("http://localhost:*/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://*.github.io/*"));
});
