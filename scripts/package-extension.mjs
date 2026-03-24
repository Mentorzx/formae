import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
  outputRoot = join(providedRepoRoot, "dist"),
} = {}) {
  const extensionRoot = join(providedRepoRoot, "apps", "extension");
  const manifestPath = join(extensionRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const version = String(manifest.version ?? "0.0.0");
  const packageRoot = join(outputRoot, "extension", `formae-extension-${version}`);
  const releasesRoot = join(outputRoot, "releases");
  const archivePath = join(releasesRoot, `formae-extension-${version}.zip`);
  const checksumPath = `${archivePath}.sha256`;

  await rm(join(outputRoot, "extension"), { force: true, recursive: true });
  await rm(releasesRoot, { force: true, recursive: true });

  await mkdir(packageRoot, { recursive: true });
  await copyFile(manifestPath, join(packageRoot, "manifest.json"));
  await copyOptionalFile(join(extensionRoot, "README.md"), join(packageRoot, "README.md"));
  await copyOptionalFile(join(extensionRoot, "package.json"), join(packageRoot, "package.json"));
  await copyTree(join(extensionRoot, "src"), join(packageRoot, "src"));
  await writeMetadata({
    manifest,
    repoRoot: providedRepoRoot,
    extensionRoot,
    packageRoot,
    archivePath,
    checksumPath,
  });

  const fileList = await listFiles(packageRoot);
  await mkdir(releasesRoot, { recursive: true });
  await createZipArchive({
    archivePath,
    cwd: packageRoot,
    fileList,
  });
  await writeChecksumFile({ archivePath, checksumPath });

  return {
    version,
    packageRoot,
    archivePath,
    checksumPath,
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
}

async function writeMetadata({
  manifest,
  repoRoot: providedRepoRoot,
  extensionRoot,
  packageRoot,
  archivePath,
  checksumPath,
}) {
  const metadata = {
    name: manifest.name,
    version: String(manifest.version ?? "0.0.0"),
    generatedAt: new Date().toISOString(),
    sourceRoot: relative(providedRepoRoot, resolve(extensionRoot)),
    packageRoot: relative(providedRepoRoot, resolve(packageRoot)),
    distribution: {
      archive: relative(providedRepoRoot, resolve(archivePath)),
      checksum: relative(providedRepoRoot, resolve(checksumPath)),
    },
    runtimeTargets: ["chrome", "firefox"],
    permissions: manifest.permissions ?? [],
    browserSpecificSettings: manifest.browser_specific_settings ?? null,
  };

  await writeFile(
    join(packageRoot, "package-metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );
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
