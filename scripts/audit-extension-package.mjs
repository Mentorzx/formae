import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageExtension } from "./package-extension.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".txt",
]);

const FORBIDDEN_PACKAGE_PATH_PATTERNS = [
  {
    pattern: /(^|\/)\.env(\.|$)/i,
    reason: "env files must never ship in the extension artifact",
  },
  {
    pattern: /(^|\/)artifacts\//i,
    reason: "local capture artifacts must never ship in the extension artifact",
  },
  {
    pattern: /(^|\/)fixtures\//i,
    reason: "fixtures must never ship in the extension artifact",
  },
  {
    pattern: /\.map$/i,
    reason: "source maps are not part of the current release baseline",
  },
  {
    pattern: /\.test\.js$/i,
    reason: "test files must not ship in the extension artifact",
  },
  {
    pattern: /(^|\/)node_modules\//i,
    reason: "vendored node_modules must not ship in the extension artifact",
  },
];

const FORBIDDEN_PACKAGE_CONTENT_PATTERNS = [
  {
    pattern: /\bSIGAA_PASSWORD\s*=/i,
    reason: "found a SIGAA password assignment in packaged text",
  },
  {
    pattern: /\bSIGAA_USERNAME\s*=/i,
    reason: "found a SIGAA username assignment in packaged text",
  },
  {
    pattern: /jsessionid=/i,
    reason: "found an unsanitized session identifier in packaged text",
  },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    reason: "found a private key block in packaged text",
  },
];

if (isMain(import.meta.url, process.argv[1])) {
  auditExtensionPackage({ repoRoot }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function auditExtensionPackage({
  repoRoot: providedRepoRoot = repoRoot,
  sourceDateEpoch = process.env.SOURCE_DATE_EPOCH,
} = {}) {
  const outputRoot = await mkdtemp(join(tmpdir(), "formae-extension-audit-"));

  try {
    const build = await packageExtension({
      repoRoot: providedRepoRoot,
      outputRoot,
      sourceDateEpoch,
    });

    const chromeAudit = await auditTargetPackage({
      packageRoot: build.packageRoots.chrome,
      runtimeTarget: "chrome",
      version: build.version,
    });
    const firefoxAudit = await auditTargetPackage({
      packageRoot: build.packageRoots.firefox,
      runtimeTarget: "firefox",
      version: build.version,
    });

    process.stdout.write(
      [
        `audited version: ${build.version}`,
        `chrome packaged files checked: ${chromeAudit.packagedFileCount}`,
        `firefox packaged files checked: ${firefoxAudit.packagedFileCount}`,
        `release manifest: ${build.releaseManifestPath}`,
      ].join("\n") + "\n",
    );

    return {
      version: build.version,
      releaseManifestPath: build.releaseManifestPath,
      chromeAudit,
      firefoxAudit,
    };
  } finally {
    await rm(outputRoot, { force: true, recursive: true });
  }
}

async function auditTargetPackage({ packageRoot, runtimeTarget, version }) {
  const packageMetadata = JSON.parse(
    await readFile(join(packageRoot, "package-metadata.json"), "utf8"),
  );
  const packagedManifest = JSON.parse(
    await readFile(join(packageRoot, "manifest.json"), "utf8"),
  );
  const packagedFiles = packageMetadata.files;

  assert.ok(Array.isArray(packagedFiles) && packagedFiles.length > 0);
  assert.equal(packageMetadata.version, version);
  assert.equal(packageMetadata.runtimeTarget, runtimeTarget);
  assert.equal(packagedManifest.manifest_version, 3);
  assert.deepEqual(packagedManifest.permissions, ["scripting", "tabs"]);
  assert.equal(packagedManifest.permissions.includes("<all_urls>"), false);
  assert.equal(packagedManifest.host_permissions.includes("<all_urls>"), false);
  assert.equal(
    packagedManifest.browser_specific_settings?.gecko?.id,
    "formae-extension@formae.local",
  );
  assert.equal(
    packagedManifest.browser_specific_settings?.gecko?.strict_min_version,
    "140.0",
  );
  assert.deepEqual(
    packagedManifest.browser_specific_settings?.gecko?.data_collection_permissions,
    {
      required: ["none"],
    },
  );
  assert.equal(
    packagedManifest.browser_specific_settings?.gecko_android?.strict_min_version,
    "142.0",
  );

  if (runtimeTarget === "chrome") {
    assert.equal(packagedManifest.background.service_worker, "src/background.js");
    assert.equal("scripts" in packagedManifest.background, false);
    assert.equal(packagedManifest.externally_connectable != null, true);
    assert.equal(
      packageMetadata.runtimeProof.requiresMozillaSignature,
      false,
    );
  } else {
    assert.deepEqual(packagedManifest.background.scripts, ["src/background.js"]);
    assert.equal("service_worker" in packagedManifest.background, false);
    assert.equal("externally_connectable" in packagedManifest, false);
    assert.equal(
      packageMetadata.distribution.requiresMozillaSignature,
      true,
    );
    assert.equal(
      packageMetadata.distribution.signatureStatus,
      "unsigned-artifact",
    );
    assert.equal(
      packageMetadata.runtimeProof.directRuntimeBridge,
      false,
    );
  }

  let inspectedTextFileCount = 0;

  for (const relativePath of packagedFiles) {
    assertAllowedPackagePath(relativePath);

    if (!shouldInspectTextFile(relativePath)) {
      continue;
    }

    inspectedTextFileCount += 1;
    const contents = await readFile(join(packageRoot, relativePath), "utf8");
    assertAllowedPackageContents(relativePath, contents);
  }

  return {
    runtimeTarget,
    packagedFileCount: packagedFiles.length,
    inspectedTextFileCount,
  };
}

function assertAllowedPackagePath(relativePath) {
  for (const rule of FORBIDDEN_PACKAGE_PATH_PATTERNS) {
    assert.equal(
      rule.pattern.test(relativePath),
      false,
      `Packaged file ${relativePath} violates release policy: ${rule.reason}.`,
    );
  }
}

function shouldInspectTextFile(relativePath) {
  return TEXT_FILE_EXTENSIONS.has(extname(relativePath).toLowerCase());
}

function assertAllowedPackageContents(relativePath, contents) {
  for (const rule of FORBIDDEN_PACKAGE_CONTENT_PATTERNS) {
    assert.equal(
      rule.pattern.test(contents),
      false,
      `Packaged file ${relativePath} violates privacy policy: ${rule.reason}.`,
    );
  }
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
