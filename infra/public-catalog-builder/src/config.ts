import path from "node:path";

export interface CliOptions {
  command: "build";
  sourcesFilePath: string;
  fixturesDir: string | null;
  outputPath: string | null;
  discoveryOutputPath: string | null;
  stdout: boolean;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "build",
    sourcesFilePath: process.env.FORMAE_PUBLIC_CATALOG_SOURCES ?? "./sources.yaml",
    fixturesDir:
      process.env.FORMAE_PUBLIC_CATALOG_FIXTURES_DIR?.trim() ??
      "../../fixtures/public",
    outputPath: process.env.FORMAE_PUBLIC_CATALOG_OUTPUT?.trim() ?? null,
    discoveryOutputPath:
      process.env.FORMAE_PUBLIC_CATALOG_DISCOVERY_OUTPUT?.trim() ?? null,
    stdout: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token || token === "build") {
      continue;
    }

    if (token === "--stdout") {
      options.stdout = true;
      continue;
    }

    const [flag, inlineValue] = token.split("=", 2);
    const readValue = () => inlineValue ?? argv[++index];

    if (flag === "--sources") {
      options.sourcesFilePath = readValue() ?? options.sourcesFilePath;
      continue;
    }

    if (flag === "--fixtures-dir") {
      options.fixturesDir = readValue() ?? options.fixturesDir;
      continue;
    }

    if (flag === "--output") {
      options.outputPath = readValue() ?? options.outputPath;
      continue;
    }

    if (flag === "--discovery-output") {
      options.discoveryOutputPath =
        readValue() ?? options.discoveryOutputPath;
      continue;
    }

    if (flag === "--help" || flag === "-h") {
      printUsageAndExit();
    }
  }

  return options;
}

export function resolvePath(baseDir: string, relativePath: string): string {
  return path.resolve(baseDir, relativePath);
}

function printUsageAndExit(): never {
  process.stdout.write(`
Usage:
  pnpm build [--sources <path>] [--fixtures-dir <path>] [--output <path>] [--discovery-output <path>] [--stdout]

Defaults:
  sources file   ./sources.yaml
  fixtures dir   ../../fixtures/public
  output path    ../static-data/public-catalog.snapshot.json
  discovery path ../static-data/public-catalog.discovery.json
`);
  process.exit(0);
}
