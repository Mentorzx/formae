import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BuildCatalogSnapshotResult } from "./builder.js";

export async function writeCatalogSnapshot(
  outputPath: string,
  result: BuildCatalogSnapshotResult,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(result.snapshot, null, 2)}\n`,
    "utf8",
  );
}
