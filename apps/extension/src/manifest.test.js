import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("extension manifest is hardened for release and Firefox portability", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const expectedHostPermissions = [
    "http://localhost/*",
    "https://mentorzx.github.io/*",
    "https://sigaa.ufba.br/*",
  ].sort();

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["scripting", "tabs"]);
  assert.equal(manifest.action.default_popup, "src/popup.html");
  assert.deepEqual(manifest.background.scripts, ["src/background.js"]);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(manifest.background.type, "module");
  assert.equal(manifest.browser_specific_settings.gecko.id, "formae-extension@formae.local");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions,
    {
      required: ["none"],
    },
  );
  assert.equal(
    manifest.browser_specific_settings.gecko_android.strict_min_version,
    "142.0",
  );
  assert.deepEqual([...manifest.host_permissions].sort(), expectedHostPermissions);
  assert.ok(manifest.externally_connectable.matches.includes("https://mentorzx.github.io/*"));
  assert.ok(!manifest.externally_connectable.matches.includes("https://sigaa.ufba.br/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://mentorzx.github.io/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("http://localhost/*"));
  assert.ok(!manifest.content_scripts[0].matches.includes("http://127.0.0.1:*/*"));
  assert.ok(!manifest.content_scripts[0].matches.includes("https://sigaa.ufba.br/*"));
  assert.ok(!manifest.permissions.includes("<all_urls>"));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
});
