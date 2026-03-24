import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(repoRoot, "target", "wasm-pack", "wasm_core");
const destinationDir = join(repoRoot, "apps", "web", "public", "wasm");
const requiredFiles = ["formae_wasm_core.js", "formae_wasm_core_bg.wasm"];

await ensureSourceExists();
await mkdir(destinationDir, { recursive: true });
await clearDirectory(destinationDir);

for (const entry of await readdir(sourceDir)) {
  await cp(join(sourceDir, entry), join(destinationDir, entry), {
    force: true,
    recursive: true,
  });
}

console.log(`Synced WASM bundle into ${destinationDir}`);

async function ensureSourceExists() {
  const entries = new Set(await readdir(sourceDir));
  const missingFiles = requiredFiles.filter((file) => !entries.has(file));

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing wasm-pack outputs: ${missingFiles.join(", ")}. Run "pnpm build:wasm" first.`,
    );
  }
}

async function clearDirectory(directoryPath) {
  for (const entry of await readdir(directoryPath)) {
    await rm(join(directoryPath, entry), { force: true, recursive: true });
  }
}

