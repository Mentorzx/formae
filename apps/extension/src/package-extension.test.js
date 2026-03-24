import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { packageExtension } from "../../../scripts/package-extension.mjs";

test("packageExtension stages files and produces zip plus sha256", async () => {
  const tempOutputRoot = await mkdtemp(join(tmpdir(), "formae-extension-package-"));
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

  const result = await packageExtension({
    repoRoot,
    outputRoot: tempOutputRoot,
  });

  const archiveStats = await stat(result.archivePath);
  const checksumStats = await stat(result.checksumPath);
  const metadata = JSON.parse(await readFile(join(result.packageRoot, "package-metadata.json"), "utf8"));
  const archiveChecksum = await readFile(result.checksumPath, "utf8");

  assert.ok(archiveStats.size > 0);
  assert.ok(checksumStats.size > 0);
  assert.equal(metadata.runtimeTargets.includes("firefox"), true);
  assert.match(archiveChecksum, /formae-extension-0\.1\.0\.zip/);
});
