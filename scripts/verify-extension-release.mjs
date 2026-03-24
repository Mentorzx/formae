import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageExtension } from "./package-extension.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (isMain(import.meta.url, process.argv[1])) {
  verifyExtensionRelease({ repoRoot }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function verifyExtensionRelease({
  repoRoot: providedRepoRoot = repoRoot,
  sourceDateEpoch = process.env.SOURCE_DATE_EPOCH,
} = {}) {
  const outputA = await mkdtemp(join(tmpdir(), "formae-extension-release-a-"));
  const outputB = await mkdtemp(join(tmpdir(), "formae-extension-release-b-"));

  try {
    const firstBuild = await packageExtension({
      repoRoot: providedRepoRoot,
      outputRoot: outputA,
      sourceDateEpoch,
    });
    const secondBuild = await packageExtension({
      repoRoot: providedRepoRoot,
      outputRoot: outputB,
      sourceDateEpoch,
    });

    const [
      firstChromeChecksum,
      secondChromeChecksum,
      firstFirefoxChecksum,
      secondFirefoxChecksum,
      firstChromeArchive,
      secondChromeArchive,
      firstFirefoxArchive,
      secondFirefoxArchive,
      firstReleaseManifest,
      secondReleaseManifest,
      firstChromeMetadata,
      secondChromeMetadata,
      firstFirefoxMetadata,
      secondFirefoxMetadata,
      firstChromeManifest,
      secondChromeManifest,
      firstFirefoxManifest,
      secondFirefoxManifest,
    ] = await Promise.all([
      readFile(firstBuild.checksums.chrome, "utf8"),
      readFile(secondBuild.checksums.chrome, "utf8"),
      readFile(firstBuild.checksums.firefox, "utf8"),
      readFile(secondBuild.checksums.firefox, "utf8"),
      readFile(firstBuild.archives.chrome),
      readFile(secondBuild.archives.chrome),
      readFile(firstBuild.archives.firefox),
      readFile(secondBuild.archives.firefox),
      readFile(firstBuild.releaseManifestPath, "utf8"),
      readFile(secondBuild.releaseManifestPath, "utf8"),
      readFile(
        join(firstBuild.packageRoots.chrome, "package-metadata.json"),
        "utf8",
      ),
      readFile(
        join(secondBuild.packageRoots.chrome, "package-metadata.json"),
        "utf8",
      ),
      readFile(
        join(firstBuild.packageRoots.firefox, "package-metadata.json"),
        "utf8",
      ),
      readFile(
        join(secondBuild.packageRoots.firefox, "package-metadata.json"),
        "utf8",
      ),
      readFile(join(firstBuild.packageRoots.chrome, "manifest.json"), "utf8"),
      readFile(join(secondBuild.packageRoots.chrome, "manifest.json"), "utf8"),
      readFile(join(firstBuild.packageRoots.firefox, "manifest.json"), "utf8"),
      readFile(join(secondBuild.packageRoots.firefox, "manifest.json"), "utf8"),
    ]);

    assert.equal(
      firstChromeChecksum,
      secondChromeChecksum,
      "Chrome extension checksum drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstFirefoxChecksum,
      secondFirefoxChecksum,
      "Firefox extension checksum drifted across deterministic rebuilds.",
    );
    assert.equal(
      Buffer.compare(firstChromeArchive, secondChromeArchive),
      0,
      "Chrome extension archive drifted across deterministic rebuilds.",
    );
    assert.equal(
      Buffer.compare(firstFirefoxArchive, secondFirefoxArchive),
      0,
      "Firefox extension archive drifted across deterministic rebuilds.",
    );
    assert.notEqual(
      Buffer.compare(firstChromeArchive, firstFirefoxArchive),
      0,
      "Chrome and Firefox archives should differ once target-specific packaging is enabled.",
    );
    assert.equal(
      firstReleaseManifest,
      secondReleaseManifest,
      "Release manifest drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstChromeMetadata,
      secondChromeMetadata,
      "Chrome package metadata drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstFirefoxMetadata,
      secondFirefoxMetadata,
      "Firefox package metadata drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstChromeManifest,
      secondChromeManifest,
      "Chrome packaged manifest drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstFirefoxManifest,
      secondFirefoxManifest,
      "Firefox packaged manifest drifted across deterministic rebuilds.",
    );

    const releaseManifest = JSON.parse(firstReleaseManifest);
    const chromeMetadata = JSON.parse(firstChromeMetadata);
    const firefoxMetadata = JSON.parse(firstFirefoxMetadata);
    const chromeManifest = JSON.parse(firstChromeManifest);
    const firefoxManifest = JSON.parse(firstFirefoxManifest);

    assert.deepEqual(releaseManifest.runtimeTargets, ["chrome", "firefox"]);
    assert.equal(releaseManifest.targets.chrome.archive.endsWith(".zip"), true);
    assert.equal(releaseManifest.targets.firefox.archive.endsWith(".xpi"), true);
    assert.equal(
      releaseManifest.targets.firefox.runtimeProof.requiresMozillaSignature,
      true,
    );
    assert.equal(
      releaseManifest.targets.chrome.runtimeProof.backgroundMode,
      "service-worker",
    );
    assert.equal(
      releaseManifest.targets.firefox.runtimeProof.backgroundMode,
      "background-scripts",
    );

    assert.equal(chromeMetadata.runtimeTarget, "chrome");
    assert.equal(
      chromeMetadata.distribution.requiresMozillaSignature,
      false,
    );
    assert.equal(
      chromeMetadata.runtimeProof.directRuntimeBridge,
      true,
    );
    assert.equal(
      chromeMetadata.runtimeProof.contentScriptBridge,
      true,
    );

    assert.equal(firefoxMetadata.runtimeTarget, "firefox");
    assert.equal(
      firefoxMetadata.distribution.requiresMozillaSignature,
      true,
    );
    assert.equal(
      firefoxMetadata.distribution.signatureStatus,
      "unsigned-artifact",
    );
    assert.equal(
      firefoxMetadata.runtimeProof.directRuntimeBridge,
      false,
    );
    assert.equal(
      firefoxMetadata.runtimeProof.contentScriptBridge,
      true,
    );

    assert.deepEqual(chromeManifest.permissions, ["scripting", "tabs"]);
    assert.equal(chromeManifest.background.service_worker, "src/background.js");
    assert.equal(Array.isArray(chromeManifest.background.scripts), false);
    assert.equal(chromeManifest.externally_connectable != null, true);

    assert.deepEqual(firefoxManifest.permissions, ["scripting", "tabs"]);
    assert.equal(Array.isArray(firefoxManifest.background.scripts), true);
    assert.deepEqual(firefoxManifest.background.scripts, ["src/background.js"]);
    assert.equal("service_worker" in firefoxManifest.background, false);
    assert.equal("externally_connectable" in firefoxManifest, false);
    assert.equal(
      firefoxManifest.browser_specific_settings?.gecko?.id != null,
      true,
    );
    assert.deepEqual(
      firefoxManifest.browser_specific_settings?.gecko?.data_collection_permissions,
      {
        required: ["none"],
      },
    );
    assert.equal(
      firefoxManifest.browser_specific_settings?.gecko_android?.strict_min_version,
      "142.0",
    );

    process.stdout.write(
      [
        `verified version: ${firstBuild.version}`,
        `source date epoch: ${firstBuild.sourceDateEpoch}`,
        `chrome archive: ${firstBuild.archives.chrome}`,
        `firefox archive: ${firstBuild.archives.firefox}`,
        `release manifest: ${firstBuild.releaseManifestPath}`,
      ].join("\n") + "\n",
    );

    return {
      version: firstBuild.version,
      sourceDateEpoch: firstBuild.sourceDateEpoch,
      archives: firstBuild.archives,
      releaseManifestPath: firstBuild.releaseManifestPath,
    };
  } finally {
    await rm(outputA, { force: true, recursive: true });
    await rm(outputB, { force: true, recursive: true });
  }
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
