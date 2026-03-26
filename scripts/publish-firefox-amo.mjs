import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageExtension } from "./package-extension.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (isMain(import.meta.url, process.argv[1])) {
  publishFirefoxAmo({ repoRoot }).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

export async function publishFirefoxAmo({
  repoRoot: providedRepoRoot = repoRoot,
  channel = process.env.AMO_CHANNEL ?? "listed",
  apiKey = process.env.AMO_JWT_ISSUER ?? null,
  apiSecret = process.env.AMO_JWT_SECRET ?? null,
} = {}) {
  assertEnvValue(apiKey, "AMO_JWT_ISSUER");
  assertEnvValue(apiSecret, "AMO_JWT_SECRET");

  const build = await packageExtension({ repoRoot: providedRepoRoot });
  const sourceDir = build.packageRoots.firefox;
  const metadataPath = join(
    providedRepoRoot,
    "apps",
    "extension",
    "store",
    "amo-metadata.json",
  );
  const artifactsDir = join(providedRepoRoot, "dist", "store-publish", "firefox");

  await mkdir(artifactsDir, { recursive: true });

  await runCommand("npx", [
    "--yes",
    "web-ext",
    "sign",
    `--channel=${channel}`,
    `--source-dir=${sourceDir}`,
    `--artifacts-dir=${artifactsDir}`,
    `--api-key=${apiKey}`,
    `--api-secret=${apiSecret}`,
    `--amo-metadata=${metadataPath}`,
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        sourceDir,
        artifactsDir,
        channel,
        metadataPath,
      },
      null,
      2,
    )}\n`,
  );
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

function assertEnvValue(value, name) {
  if (typeof value === "string" && value.length > 0) {
    return;
  }

  throw new Error(`Missing ${name}. Configure o segredo no ambiente.`);
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
