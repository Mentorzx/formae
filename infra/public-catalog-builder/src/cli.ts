import path from "node:path";

import { buildCatalogSnapshot } from "./builder.js";
import { parseCliOptions } from "./config.js";
import { writeCatalogSnapshot } from "./output.js";

const BUILDER_VERSION = "0.2.0";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await buildCatalogSnapshot({
    sourcesFilePath: path.resolve(process.cwd(), options.sourcesFilePath),
    fixturesDir: options.fixturesDir
      ? path.resolve(process.cwd(), options.fixturesDir)
      : null,
    builderVersion: BUILDER_VERSION,
  });

  if (options.stdout) {
    process.stdout.write(`${JSON.stringify(result.snapshot, null, 2)}\n`);
    return;
  }

  const outputPath = path.resolve(
    process.cwd(),
    options.outputPath ?? "../static-data/public-catalog.snapshot.json",
  );

  await writeCatalogSnapshot(outputPath, result);

  process.stdout.write(
    [
      `Public catalog snapshot written to ${outputPath}`,
      `sources: ${result.snapshot.sources.length}`,
      `pages: ${result.snapshot.pages.length}`,
      `curriculum structures: ${result.snapshot.curriculumStructures.length}`,
      `components: ${result.snapshot.components.length}`,
      `schedule guide entries: ${result.snapshot.scheduleGuide.length}`,
      `time slots: ${result.snapshot.timeSlots.length}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
