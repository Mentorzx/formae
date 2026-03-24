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
      firstZipChecksum,
      secondZipChecksum,
      firstZipArchive,
      secondZipArchive,
      firstFirefoxChecksum,
      secondFirefoxChecksum,
      firstFirefoxArchive,
      secondFirefoxArchive,
      firstReleaseManifest,
      secondReleaseManifest,
      firstPackageMetadata,
      secondPackageMetadata,
      firstPackagedManifest,
      secondPackagedManifest,
    ] = await Promise.all([
      readFile(firstBuild.checksumPath, "utf8"),
      readFile(secondBuild.checksumPath, "utf8"),
      readFile(firstBuild.archivePath),
      readFile(secondBuild.archivePath),
      readFile(firstBuild.firefoxChecksumPath, "utf8"),
      readFile(secondBuild.firefoxChecksumPath, "utf8"),
      readFile(firstBuild.firefoxArchivePath),
      readFile(secondBuild.firefoxArchivePath),
      readFile(firstBuild.releaseManifestPath, "utf8"),
      readFile(secondBuild.releaseManifestPath, "utf8"),
      readFile(join(firstBuild.packageRoot, "package-metadata.json"), "utf8"),
      readFile(join(secondBuild.packageRoot, "package-metadata.json"), "utf8"),
      readFile(join(firstBuild.packageRoot, "manifest.json"), "utf8"),
      readFile(join(secondBuild.packageRoot, "manifest.json"), "utf8"),
    ]);

    assert.equal(
      firstZipChecksum,
      secondZipChecksum,
      "Chrome extension zip checksum drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstFirefoxChecksum,
      secondFirefoxChecksum,
      "Firefox extension xpi checksum drifted across deterministic rebuilds.",
    );
    assert.equal(
      Buffer.compare(firstZipArchive, firstFirefoxArchive),
      0,
      "Firefox archive should be byte-identical to the packaged Chrome archive in the current release baseline.",
    );
    assert.equal(
      Buffer.compare(secondZipArchive, secondFirefoxArchive),
      0,
      "Firefox archive should be byte-identical to the packaged Chrome archive in the current release baseline.",
    );
    assert.equal(
      firstReleaseManifest,
      secondReleaseManifest,
      "Release manifest drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstPackageMetadata,
      secondPackageMetadata,
      "Packaged metadata drifted across deterministic rebuilds.",
    );
    assert.equal(
      firstPackagedManifest,
      secondPackagedManifest,
      "Packaged manifest drifted across deterministic rebuilds.",
    );

    const releaseManifest = JSON.parse(firstReleaseManifest);
    const packageMetadata = JSON.parse(firstPackageMetadata);

    assert.equal(releaseManifest.runtimeTargets.includes("chrome"), true);
    assert.equal(releaseManifest.runtimeTargets.includes("firefox"), true);
    assert.deepEqual(releaseManifest.runtimeTargets, ["chrome", "firefox"]);
    assert.equal(packageMetadata.browserSpecificSettings?.gecko?.id != null, true);
    assert.equal(packageMetadata.distribution.chromeArchive.endsWith(".zip"), true);
    assert.equal(packageMetadata.distribution.firefoxArchive.endsWith(".xpi"), true);
    assert.deepEqual(
      JSON.parse(firstPackagedManifest).permissions,
      ["scripting", "tabs"],
    );
    assert.equal(packageMetadata.permissions.includes("<all_urls>"), false);
    assert.equal(packageMetadata.hostPermissions.includes("<all_urls>"), false);
    assert.equal(
      packageMetadata.hostPermissions.includes("http://127.0.0.1:*/*"),
      false,
    );

    process.stdout.write(
      [
        `verified version: ${firstBuild.version}`,
        `source date epoch: ${firstBuild.sourceDateEpoch}`,
        `chrome archive: ${firstBuild.archivePath}`,
        `firefox archive: ${firstBuild.firefoxArchivePath}`,
        `release manifest: ${firstBuild.releaseManifestPath}`,
      ].join("\n") + "\n",
    );

    return {
      version: firstBuild.version,
      sourceDateEpoch: firstBuild.sourceDateEpoch,
      archivePath: firstBuild.archivePath,
      firefoxArchivePath: firstBuild.firefoxArchivePath,
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
