import {
  parseCliOptions,
  resolveCaptureConfig,
  resolveWebSyncConfig,
} from "./config.js";
import { runCapture } from "./capture.js";
import { runWebSync } from "./web-sync.js";

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.command === "capture") {
    const config = resolveCaptureConfig(options);
    const result = await runCapture(config);

    process.stdout.write(
      [
        `Capture finished: ${result.runDir}`,
        `metadata: ${result.metadataPath}`,
        `html: ${result.pageHtmlPath}`,
        `text: ${result.pageTextPath}`,
        `network: ${result.networkPath}`,
      ].join("\n") + "\n",
    );
    return;
  }

  if (options.command === "web-sync") {
    const config = resolveWebSyncConfig(options);
    const result = await runWebSync(config);

    process.stdout.write(
      [
        `Web sync finished: ${result.webUrl}`,
        `automatic sync: ${result.automaticMessage}`,
        `snapshot save: ${result.snapshotMessage}`,
        `vault sealed: ${result.vaultSealed ? "yes" : "no"}`,
        `detected components: ${result.detectedComponentCount}`,
        `detected schedules: ${result.detectedScheduleCount}`,
        `duration ms: ${result.durationMs}`,
      ].join("\n") + "\n",
    );
    return;
  }

  throw new Error(`Unsupported command: ${options.command}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
