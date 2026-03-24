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
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const version = String(manifest.version ?? "0.0.0");
  const packageRoot = join(outputRoot, "extension", `formae-extension-${version}`);
  const releasesRoot = join(outputRoot, "releases");
  const archivePath = join(releasesRoot, `formae-extension-${version}.zip`);
  const firefoxArchivePath = join(releasesRoot, `formae-extension-${version}.xpi`);
  const checksumPath = `${archivePath}.sha256`;
  const firefoxChecksumPath = `${firefoxArchivePath}.sha256`;
  const releaseManifestPath = join(
    releasesRoot,
    `formae-extension-${version}.release-manifest.json`,
  );
  validateManifestReleaseReadiness(manifest);

  await rm(join(outputRoot, "extension"), { force: true, recursive: true });
  await rm(releasesRoot, { force: true, recursive: true });

  await mkdir(packageRoot, { recursive: true });
  await copyFile(manifestPath, join(packageRoot, "manifest.json"));
  await copyOptionalFile(join(extensionRoot, "README.md"), join(packageRoot, "README.md"));
  await copyOptionalFile(join(extensionRoot, "package.json"), join(packageRoot, "package.json"));
  await copyTree(join(extensionRoot, "src"), join(packageRoot, "src"));
  await assertManifestAssetPathsExist({
    packageRoot,
    manifest,
  });
  const packageFiles = await listFiles(packageRoot);
  await writeMetadata({
    manifest,
    repoRoot: providedRepoRoot,
    sourceDateEpoch,
    files: packageFiles,
    packageRoot,
  });
  await normalizeFileTimestamps(packageRoot, sourceDateEpoch);

  const fileList = await listFiles(packageRoot);
  await mkdir(releasesRoot, { recursive: true });
  await createZipArchive({
    archivePath,
    cwd: packageRoot,
    fileList,
  });
  await copyFile(archivePath, firefoxArchivePath);
  const chromeSha256 = await writeChecksumFile({ archivePath, checksumPath });
  const firefoxSha256 = await writeChecksumFile({
    archivePath: firefoxArchivePath,
    checksumPath: firefoxChecksumPath,
  });
  const packageFileDigests = await collectFileDigests(packageRoot);
  await writeReleaseManifest({
    releaseManifestPath,
    manifest,
    sourceDateEpoch,
    packageFiles: packageFileDigests,
    artifacts: [
      {
        target: "chrome",
        file: basename(archivePath),
        sha256: chromeSha256,
      },
      {
        target: "firefox",
        file: basename(firefoxArchivePath),
        sha256: firefoxSha256,
      },
      {
        target: "chrome-checksum",
        file: basename(checksumPath),
      },
      {
        target: "firefox-checksum",
        file: basename(firefoxChecksumPath),
      },
    ],
  });

  return {
    version,
    packageRoot,
    archivePath,
    firefoxArchivePath,
    checksumPath,
    firefoxChecksumPath,
    releaseManifestPath,
    sourceDateEpoch,
  };
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
}) {
  const metadata = {
    name: manifest.name,
    version: String(manifest.version ?? "0.0.0"),
    generatedAt: new Date(sourceDateEpoch * 1000).toISOString(),
    sourceDateEpoch,
    sourceRoot: relative(
      providedRepoRoot,
      resolve(join(providedRepoRoot, "apps", "extension")),
    ).split(sep).join("/"),
    packageRoot: basename(packageRoot),
    distribution: {
      chromeArchive: `formae-extension-${manifest.version}.zip`,
      chromeChecksum: `formae-extension-${manifest.version}.zip.sha256`,
      firefoxArchive: `formae-extension-${manifest.version}.xpi`,
      firefoxChecksum: `formae-extension-${manifest.version}.xpi.sha256`,
    },
    files,
    runtimeTargets: ["chrome", "firefox"],
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
  packageFiles,
  artifacts,
}) {
  const releaseManifest = {
    schemaVersion: 1,
    name: manifest.name,
    version: String(manifest.version ?? "0.0.0"),
    generatedAt: new Date(sourceDateEpoch * 1000).toISOString(),
    sourceDateEpoch,
    runtimeTargets: ["chrome", "firefox"],
    packageFiles,
    artifacts,
  };

  await writeFile(
    releaseManifestPath,
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );
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
