import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { packageExtension } from "../../../scripts/package-extension.mjs";

test("packageExtension stages browser-specific artifacts and manifests", async () => {
  const tempOutputRoot = await mkdtemp(join(tmpdir(), "formae-extension-package-"));
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

  const result = await packageExtension({
    repoRoot,
    outputRoot: tempOutputRoot,
  });

  const chromeArchiveStats = await stat(result.archives.chrome);
  const firefoxArchiveStats = await stat(result.archives.firefox);
  const chromeChecksumStats = await stat(result.checksums.chrome);
  const firefoxChecksumStats = await stat(result.checksums.firefox);
  const chromeMetadata = JSON.parse(
    await readFile(join(result.packageRoots.chrome, "package-metadata.json"), "utf8"),
  );
  const firefoxMetadata = JSON.parse(
    await readFile(join(result.packageRoots.firefox, "package-metadata.json"), "utf8"),
  );
  const chromeManifest = JSON.parse(
    await readFile(join(result.packageRoots.chrome, "manifest.json"), "utf8"),
  );
  const firefoxManifest = JSON.parse(
    await readFile(join(result.packageRoots.firefox, "manifest.json"), "utf8"),
  );
  const chromeArchiveChecksum = await readFile(result.checksums.chrome, "utf8");
  const firefoxArchiveChecksum = await readFile(result.checksums.firefox, "utf8");

  assert.ok(chromeArchiveStats.size > 0);
  assert.ok(firefoxArchiveStats.size > 0);
  assert.ok(chromeChecksumStats.size > 0);
  assert.ok(firefoxChecksumStats.size > 0);
  assert.equal(chromeMetadata.runtimeTarget, "chrome");
  assert.equal(firefoxMetadata.runtimeTarget, "firefox");
  assert.ok(chromeMetadata.files.includes("src/popup.html"));
  assert.ok(firefoxMetadata.files.includes("src/popup.html"));
  assert.ok(chromeMetadata.files.includes("assets/icon-128.png"));
  assert.ok(firefoxMetadata.files.includes("assets/icon-128.png"));
  assert.equal(chromeManifest.background.service_worker, "src/background.js");
  assert.equal("scripts" in chromeManifest.background, false);
  assert.deepEqual(firefoxManifest.background.scripts, ["src/background.js"]);
  assert.equal("service_worker" in firefoxManifest.background, false);
  assert.equal("externally_connectable" in firefoxManifest, false);
  assert.equal(chromeManifest.icons["128"], "assets/icon-128.png");
  assert.equal(firefoxManifest.icons["128"], "assets/icon-128.png");
  assert.match(chromeArchiveChecksum, /formae-extension-0\.1\.0\.zip/);
  assert.match(firefoxArchiveChecksum, /formae-extension-0\.1\.0\.xpi/);
});
