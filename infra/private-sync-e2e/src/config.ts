import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

export interface CliOptions {
  command: "capture" | "web-sync";
  envFile?: string;
  loginUrl?: string;
  captureUrl?: string;
  captureTarget?: "portal-home" | "history" | "classes" | "grades";
  webUrl?: string;
  outputDir?: string;
  headed: boolean;
  timeoutMs?: number;
}

export interface CaptureConfig {
  username: string;
  password: string;
  loginUrl: string;
  captureUrl?: string;
  captureTarget?: "portal-home" | "history" | "classes" | "grades";
  outputDir: string;
  headed: boolean;
  timeoutMs: number;
  envFilesLoaded: string[];
}

export interface WebSyncConfig {
  username: string;
  password: string;
  webUrl: string;
  extensionPath: string;
  headed: boolean;
  timeoutMs: number;
  envFilesLoaded: string[];
}

const DEFAULT_LOGIN_URL = "https://sigaa.ufba.br/sigaa/mobile/touch/login.jsf";
const DEFAULT_WEB_URL = "http://localhost:4173/#/importacao";

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "capture",
    headed: process.env.SIGAA_HEADED === "1",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token) {
      continue;
    }

    if (token === "capture" || token === "web-sync") {
      options.command = token;
      continue;
    }

    if (token === "--headed") {
      options.headed = true;
      continue;
    }

    if (token === "--headless") {
      options.headed = false;
      continue;
    }

    const [flag, inlineValue] = token.split("=", 2);
    const readValue = () => inlineValue ?? argv[++index];

    if (flag === "--env-file") {
      options.envFile = readValue();
      continue;
    }

    if (flag === "--login-url") {
      options.loginUrl = readValue();
      continue;
    }

    if (flag === "--capture-url") {
      options.captureUrl = readValue();
      continue;
    }

    if (flag === "--capture-target") {
      const captureTarget = readValue();
      if (
        captureTarget === "portal-home" ||
        captureTarget === "history" ||
        captureTarget === "classes" ||
        captureTarget === "grades"
      ) {
        options.captureTarget = captureTarget;
      }
      continue;
    }

    if (flag === "--web-url") {
      options.webUrl = readValue();
      continue;
    }

    if (flag === "--output-dir") {
      options.outputDir = readValue();
      continue;
    }

    if (flag === "--timeout-ms") {
      const timeoutValue = readValue();
      if (timeoutValue) {
        options.timeoutMs = Number(timeoutValue);
      }
      continue;
    }

    if (flag === "--help" || flag === "-h") {
      printUsageAndExit();
    }
  }

  return options;
}

export function resolveCaptureConfig(options: CliOptions): CaptureConfig {
  const envFilesLoaded = loadLocalEnvFiles(options.envFile);

  const username = requireEnv("SIGAA_USERNAME");
  const password = requireEnv("SIGAA_PASSWORD");
  const captureUrl = options.captureUrl ?? process.env.SIGAA_CAPTURE_URL?.trim();
  const captureTarget =
    options.captureTarget ??
    normalizeCaptureTarget(process.env.SIGAA_CAPTURE_TARGET?.trim());

  return {
    username,
    password,
    loginUrl: options.loginUrl ?? process.env.SIGAA_LOGIN_URL ?? DEFAULT_LOGIN_URL,
    captureUrl: captureUrl ? captureUrl : undefined,
    captureTarget,
    outputDir: path.resolve(
      process.cwd(),
      options.outputDir ?? process.env.SIGAA_CAPTURE_DIR ?? "artifacts",
    ),
    headed: options.headed,
    timeoutMs: options.timeoutMs ?? Number(process.env.SIGAA_TIMEOUT_MS ?? "45000"),
    envFilesLoaded,
  };
}

export function resolveWebSyncConfig(options: CliOptions): WebSyncConfig {
  const envFilesLoaded = loadLocalEnvFiles(options.envFile);

  return {
    username: requireEnv("SIGAA_USERNAME"),
    password: requireEnv("SIGAA_PASSWORD"),
    webUrl: options.webUrl ?? process.env.FORMAE_WEB_URL ?? DEFAULT_WEB_URL,
    extensionPath: path.resolve(
      process.cwd(),
      process.env.FORMAE_EXTENSION_PATH ?? "../../apps/extension",
    ),
    headed: options.headed,
    timeoutMs: options.timeoutMs ?? Number(process.env.SIGAA_TIMEOUT_MS ?? "45000"),
    envFilesLoaded,
  };
}

function loadLocalEnvFiles(explicitEnvFile?: string): string[] {
  const candidates = [
    explicitEnvFile,
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const loaded: string[] = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    dotenv.config({ path: candidate, override: false });
    loaded.push(candidate);
  }

  return loaded;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Set it directly or load a .env file before running the capture tool.`,
    );
  }

  return value;
}

function printUsageAndExit(): never {
  process.stdout.write(`
Usage:
  pnpm capture [--headed] [--env-file <path>] [--login-url <url>] [--capture-url <url>] [--capture-target <portal-home|history|classes|grades>] [--output-dir <dir>] [--timeout-ms <ms>]
  pnpm sync:web [--headed] [--env-file <path>] [--web-url <url>] [--timeout-ms <ms>]

Defaults:
  login url   ${DEFAULT_LOGIN_URL}
  web url     ${DEFAULT_WEB_URL}
  env files   ../../.env, ./.env, ./.env.local
  output dir  artifacts/
`);
  process.exit(0);
}

function normalizeCaptureTarget(
  value?: string,
): CaptureConfig["captureTarget"] | undefined {
  if (
    value === "portal-home" ||
    value === "history" ||
    value === "classes" ||
    value === "grades"
  ) {
    return value;
  }

  return undefined;
}
