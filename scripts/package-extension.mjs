import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNTIME_TARGETS = ["chrome", "firefox"];

if (isMain(import.meta.url, process.argv[1])) {
  packageExtension({ repoRoot }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function packageExtension({
  repoRoot: providedRepoRoot = repoRoot,
  outputRoot = resolve(
    process.env.FORMAE_EXTENSION_OUTPUT_ROOT ?? join(providedRepoRoot, "dist"),
  ),
  sourceDateEpoch = resolveSourceDateEpoch(providedRepoRoot),
} = {}) {
  const extensionRoot = join(providedRepoRoot, "apps", "extension");
  const manifestPath = join(extensionRoot, "manifest.json");
  const sourceManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const version = String(sourceManifest.version ?? "0.0.0");
  const releasesRoot = join(outputRoot, "releases");

  validateManifestReleaseReadiness(sourceManifest);

  await rm(join(outputRoot, "extension"), { force: true, recursive: true });
  await rm(releasesRoot, { force: true, recursive: true });

  await mkdir(releasesRoot, { recursive: true });

  const targetBuilds = {};

  for (const runtimeTarget of RUNTIME_TARGETS) {
    const packageRoot = join(
      outputRoot,
      "extension",
      packageDirectoryName({ runtimeTarget, version }),
    );
    const manifest = buildTargetManifest(sourceManifest, runtimeTarget);

    await stageTargetPackage({
      extensionRoot,
      packageRoot,
      manifest,
    });

    const packageFiles = await listFiles(packageRoot);
    const distribution = buildTargetDistribution({
      runtimeTarget,
      version,
    });

    await writeMetadata({
      manifest,
      repoRoot: providedRepoRoot,
      sourceDateEpoch,
      files: packageFiles,
      packageRoot,
      runtimeTarget,
      distribution,
    });
    await normalizeFileTimestamps(packageRoot, sourceDateEpoch);

    const fileList = await listFiles(packageRoot);
    await createZipArchive({
      archivePath: join(releasesRoot, distribution.archive),
      cwd: packageRoot,
      fileList,
    });

    const checksumPath = join(releasesRoot, distribution.checksum);
    const sha256 = await writeChecksumFile({
      archivePath: join(releasesRoot, distribution.archive),
      checksumPath,
    });
    const packageFileDigests = await collectFileDigests(packageRoot);

    targetBuilds[runtimeTarget] = {
      runtimeTarget,
      manifest,
      packageRoot,
      archivePath: join(releasesRoot, distribution.archive),
      checksumPath,
      sha256,
      distribution,
      packageFiles,
      packageFileDigests,
    };
  }

  const releaseManifestPath = join(
    releasesRoot,
    `formae-extension-${version}.release-manifest.json`,
  );
  await writeReleaseManifest({
    releaseManifestPath,
    manifest: sourceManifest,
    sourceDateEpoch,
    targetBuilds,
  });

  return {
    version,
    sourceDateEpoch,
    releaseManifestPath,
    packageRoots: {
      chrome: targetBuilds.chrome.packageRoot,
      firefox: targetBuilds.firefox.packageRoot,
    },
    archives: {
      chrome: targetBuilds.chrome.archivePath,
      firefox: targetBuilds.firefox.archivePath,
    },
    checksums: {
      chrome: targetBuilds.chrome.checksumPath,
      firefox: targetBuilds.firefox.checksumPath,
    },
    archivePath: targetBuilds.chrome.archivePath,
    firefoxArchivePath: targetBuilds.firefox.archivePath,
    checksumPath: targetBuilds.chrome.checksumPath,
    firefoxChecksumPath: targetBuilds.firefox.checksumPath,
    packageRoot: targetBuilds.chrome.packageRoot,
    chromePackageRoot: targetBuilds.chrome.packageRoot,
    firefoxPackageRoot: targetBuilds.firefox.packageRoot,
  };
}

async function stageTargetPackage({
  extensionRoot,
  packageRoot,
  manifest,
}) {
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    join(packageRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await copyOptionalFile(join(extensionRoot, "README.md"), join(packageRoot, "README.md"));
  await copyOptionalFile(join(extensionRoot, "package.json"), join(packageRoot, "package.json"));
  await copyTree(join(extensionRoot, "src"), join(packageRoot, "src"));
  await assertManifestAssetPathsExist({
    packageRoot,
    manifest,
  });
}

function buildTargetManifest(sourceManifest, runtimeTarget) {
  const manifest = structuredClone(sourceManifest);
  const backgroundScriptPath =
    manifest.background?.service_worker ??
    manifest.background?.scripts?.[0] ??
    null;

  if (!backgroundScriptPath) {
    throw new Error(
      `Cannot build ${runtimeTarget} manifest without a background entrypoint.`,
    );
  }

  if (runtimeTarget === "chrome") {
    manifest.background = {
      service_worker: backgroundScriptPath,
      type: manifest.background?.type ?? "module",
    };
    return manifest;
  }

  manifest.background = {
    scripts: uniqueStrings([
      ...(manifest.background?.scripts ?? []),
      backgroundScriptPath,
    ]),
    type: manifest.background?.type ?? "module",
  };
  delete manifest.externally_connectable;

  return manifest;
}

function buildTargetDistribution({ runtimeTarget, version }) {
  const archive = `formae-extension-${version}.${runtimeTarget === "chrome" ? "zip" : "xpi"}`;

  return {
    archive,
    checksum: `${archive}.sha256`,
    target: runtimeTarget,
  };
}

function packageDirectoryName({ runtimeTarget, version }) {
  return `formae-extension-${runtimeTarget}-${version}`;
}

async function copyTree(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });

  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    const sourcePath = join(sourceDir, entry.name);
    const destinationPath = join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyTree(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function copyOptionalFile(sourcePath, destinationPath) {
  try {
    await copyFile(sourcePath, destinationPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function copyFile(sourcePath, destinationPath) {
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { force: true });
}

function shouldSkip(name) {
  return name.endsWith(".test.js");
}

async function listFiles(rootDir) {
  const files = [];

  await walk(rootDir, rootDir, files);

  return files.sort((left, right) => left.localeCompare(right));
}

async function walk(rootDir, currentDir, files) {
  for (const entry of await readdir(currentDir, { withFileTypes: true })) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(rootDir, absolutePath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(rootDir, absolutePath).split(sep).join("/"));
    }
  }
}

async function createZipArchive({ archivePath, cwd, fileList }) {
  const result = spawnSync("zip", ["-X", "-q", "-@", archivePath], {
    cwd,
    input: `${fileList.join("\n")}\n`,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to create extension zip archive: ${result.stderr || result.stdout || "unknown zip error"}`,
    );
  }
}

async function writeChecksumFile({ archivePath, checksumPath }) {
  const archiveBytes = await readFile(archivePath);
  const hash = createHash("sha256").update(archiveBytes).digest("hex");
  await writeFile(checksumPath, `${hash}  ${basename(archivePath)}\n`, "utf8");
  return hash;
}

async function writeMetadata({
  manifest,
  repoRoot: providedRepoRoot,
  sourceDateEpoch,
  files,
  packageRoot,
  runtimeTarget,
  distribution,
}) {
  const metadata = {
    name: manifest.name,
    version: String(manifest.version ?? "0.0.0"),
    runtimeTarget,
    generatedAt: new Date(sourceDateEpoch * 1000).toISOString(),
    sourceDateEpoch,
    sourceRoot: relative(
      providedRepoRoot,
      resolve(join(providedRepoRoot, "apps", "extension")),
    ).split(sep).join("/"),
    packageRoot: basename(packageRoot),
    distribution: {
      archive: distribution.archive,
      checksum: distribution.checksum,
      requiresMozillaSignature: runtimeTarget === "firefox",
      signatureStatus:
        runtimeTarget === "firefox" ? "unsigned-artifact" : "not-required",
    },
    runtimeProof: buildRuntimeProof({
      runtimeTarget,
      manifest,
    }),
    files,
    permissions: manifest.permissions ?? [],
    hostPermissions: manifest.host_permissions ?? [],
    browserSpecificSettings: manifest.browser_specific_settings ?? null,
  };

  await writeFile(
    join(packageRoot, "package-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
}

async function writeReleaseManifest({
  releaseManifestPath,
  manifest,
  sourceDateEpoch,
  targetBuilds,
}) {
  const releaseManifest = {
    schemaVersion: 2,
    name: manifest.name,
    version: String(manifest.version ?? "0.0.0"),
    generatedAt: new Date(sourceDateEpoch * 1000).toISOString(),
    sourceDateEpoch,
    runtimeTargets: RUNTIME_TARGETS,
    targets: Object.fromEntries(
      RUNTIME_TARGETS.map((runtimeTarget) => {
        const build = targetBuilds[runtimeTarget];

        return [
          runtimeTarget,
          {
            archive: basename(build.archivePath),
            checksum: basename(build.checksumPath),
            sha256: build.sha256,
            packageRoot: basename(build.packageRoot),
            packageFiles: build.packageFileDigests,
            runtimeProof: buildRuntimeProof({
              runtimeTarget,
              manifest: build.manifest,
            }),
          },
        ];
      }),
    ),
  };

  await writeFile(
    releaseManifestPath,
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );
}

function buildRuntimeProof({ runtimeTarget, manifest }) {
  return {
    backgroundMode:
      runtimeTarget === "firefox" ? "background-scripts" : "service-worker",
    directRuntimeBridge:
      runtimeTarget === "chrome" && manifest.externally_connectable != null,
    contentScriptBridge: Array.isArray(manifest.content_scripts) &&
      manifest.content_scripts.length > 0,
    externallyConnectable: manifest.externally_connectable ?? null,
    requiresMozillaSignature: runtimeTarget === "firefox",
  };
}

async function collectFileDigests(rootDir) {
  const files = await listFiles(rootDir);
  const digests = [];

  for (const file of files) {
    const contents = await readFile(join(rootDir, file));
    digests.push({
      path: file,
      sha256: createHash("sha256").update(contents).digest("hex"),
      bytes: contents.byteLength,
    });
  }

  return digests;
}

async function normalizeFileTimestamps(rootDir, sourceDateEpoch) {
  const timestamp = new Date(sourceDateEpoch * 1000);
  const files = await listFiles(rootDir);

  await Promise.all(
    files.map((file) => utimes(join(rootDir, file), timestamp, timestamp)),
  );
}

function validateManifestReleaseReadiness(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error("Extension packaging requires manifest_version 3.");
  }

  if (!manifest.name || !manifest.version) {
    throw new Error("Extension packaging requires manifest name and version.");
  }

  if (!manifest.action?.default_popup) {
    throw new Error("Extension packaging requires action.default_popup for Chrome and Firefox.");
  }

  if (!manifest.background?.service_worker) {
    throw new Error("Extension packaging requires background.service_worker.");
  }

  if (
    !Array.isArray(manifest.background?.scripts) ||
    manifest.background.scripts.length === 0
  ) {
    throw new Error(
      "Extension packaging requires background.scripts as a Firefox fallback.",
    );
  }

  if (!manifest.browser_specific_settings?.gecko?.id) {
    throw new Error("Firefox packaging requires browser_specific_settings.gecko.id.");
  }
}

async function assertManifestAssetPathsExist({ packageRoot, manifest }) {
  const paths = collectManifestAssetPaths(manifest);
  const missing = [];

  for (const relativePath of paths) {
    try {
      await readFile(join(packageRoot, relativePath));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        missing.push(relativePath);
        continue;
      }

      throw error;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Extension manifest references missing packaged assets: ${missing.join(", ")}.`,
    );
  }
}

function collectManifestAssetPaths(manifest) {
  const paths = new Set();

  if (typeof manifest.action?.default_popup === "string") {
    paths.add(manifest.action.default_popup);
  }

  if (typeof manifest.background?.service_worker === "string") {
    paths.add(manifest.background.service_worker);
  }

  for (const entry of manifest.background?.scripts ?? []) {
    if (typeof entry === "string") {
      paths.add(entry);
    }
  }

  for (const contentScript of manifest.content_scripts ?? []) {
    for (const entry of contentScript.js ?? []) {
      if (typeof entry === "string") {
        paths.add(entry);
      }
    }

    for (const entry of contentScript.css ?? []) {
      if (typeof entry === "string") {
        paths.add(entry);
      }
    }
  }

  for (const resourceGroup of manifest.web_accessible_resources ?? []) {
    for (const entry of resourceGroup.resources ?? []) {
      if (typeof entry === "string" && !entry.includes("*")) {
        paths.add(entry);
      }
    }
  }

  for (const iconPath of Object.values(manifest.icons ?? {})) {
    if (typeof iconPath === "string") {
      paths.add(iconPath);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function resolveSourceDateEpoch(providedRepoRoot) {
  const sourceDateFromEnv = process.env.SOURCE_DATE_EPOCH?.trim();
  if (sourceDateFromEnv) {
    const parsed = Number(sourceDateFromEnv);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  const gitResult = spawnSync("git", ["log", "-1", "--format=%ct", "HEAD"], {
    cwd: providedRepoRoot,
    encoding: "utf8",
  });

  if (gitResult.status === 0) {
    const parsed = Number(gitResult.stdout.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function basename(inputPath) {
  return inputPath.split(/[\\/]/).pop() ?? inputPath;
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
