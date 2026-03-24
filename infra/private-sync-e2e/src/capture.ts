import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import type { CaptureConfig } from "./config.js";
import { captureSanitizedPage, sanitizeNetworkEvent, sanitizeText, sanitizeUrl } from "./sanitize.js";
import type { SigaaLoginResult } from "./sigaa.js";
import { navigateToCaptureTarget, signInToSigaa } from "./sigaa.js";

export interface CaptureResult {
  runDir: string;
  metadataPath: string;
  pageHtmlPath: string;
  pageTextPath: string;
  networkPath: string;
}

export async function runCapture(config: CaptureConfig): Promise<CaptureResult> {
  const runDir = path.join(config.outputDir, createRunStamp());
  await mkdir(runDir, { recursive: true });

  const browser = await chromium.launch({ headless: !config.headed });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const networkEvents: Array<{
    kind: "request" | "response";
    url: string;
    method?: string;
    status?: number;
    resourceType?: string;
  }> = [];

  context.on("request", (request) => {
    networkEvents.push(
      sanitizeNetworkEvent({
        kind: "request",
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      }),
    );
  });

  context.on("response", (response) => {
    networkEvents.push(
      sanitizeNetworkEvent({
        kind: "response",
        url: response.url(),
        status: response.status(),
      }),
    );
  });

  let loginResult: SigaaLoginResult | undefined;
  let capturePage = page;
  let captureStep:
    | {
        page: typeof page;
        captureTarget: string;
        matchedSelector: string | null;
        pageText: string;
      }
    | undefined;
  try {
    loginResult = await signInToSigaa(page, config.loginUrl, config.username, config.password, config.timeoutMs);

    if (config.captureUrl) {
      await page.goto(config.captureUrl, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
      await page.waitForLoadState("networkidle", { timeout: Math.min(config.timeoutMs, 10000) }).catch(() => {});
    } else if (config.captureTarget) {
      captureStep = await navigateToCaptureTarget(
        page,
        config.captureTarget,
        config.timeoutMs,
      );
      capturePage = captureStep.page;
    } else {
      await page.waitForLoadState("networkidle", { timeout: Math.min(config.timeoutMs, 10000) }).catch(() => {});
    }

    const snapshot = await captureSanitizedPage(capturePage);
    const metadata = {
      stage: "capture-complete",
      authenticated: loginResult.authenticated,
      loginUrl: config.loginUrl,
      captureUrl: config.captureUrl ?? null,
      captureTarget: config.captureTarget ?? null,
      captureTargetSelector: captureStep?.matchedSelector ?? null,
      finalUrl: sanitizeUrl(capturePage.url()),
      title: snapshot.title,
      selectorsUsed: loginResult.usedSelectors,
      statusText: sanitizeText(captureStep?.pageText ?? loginResult.statusText),
      envFilesLoaded: config.envFilesLoaded,
      capturedAt: new Date().toISOString(),
    };

    await persistArtifacts(runDir, snapshot, networkEvents, metadata);
  } catch (error) {
    const fallback = await captureSanitizedPage(capturePage).catch(() => null);
    await persistArtifacts(runDir, fallback, networkEvents, {
      loginUrl: config.loginUrl,
      captureUrl: config.captureUrl ?? null,
      captureTarget: config.captureTarget ?? null,
      captureTargetSelector: captureStep?.matchedSelector ?? null,
      authenticated: loginResult?.authenticated ?? false,
      error: serializeError(error),
      envFilesLoaded: config.envFilesLoaded,
      stage: loginResult ? "capture-failed" : "login-failed",
      finalUrl: capturePage.url(),
      selectorsUsed: loginResult?.usedSelectors ?? null,
      statusText: sanitizeText(loginResult?.statusText ?? ""),
    });

    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return {
    runDir,
    metadataPath: path.join(runDir, "metadata.json"),
    pageHtmlPath: path.join(runDir, "page.html"),
    pageTextPath: path.join(runDir, "page.txt"),
    networkPath: path.join(runDir, "network.json"),
  };
}

async function persistArtifacts(
  runDir: string,
  snapshot: Awaited<ReturnType<typeof captureSanitizedPage>> | null,
  networkEvents: Array<{
    kind: "request" | "response";
    url: string;
    method?: string;
    status?: number;
    resourceType?: string;
  }>,
  metadata: Record<string, unknown>,
): Promise<void> {
  const htmlPath = path.join(runDir, "page.html");
  const textPath = path.join(runDir, "page.txt");
  const networkPath = path.join(runDir, "network.json");
  const metadataPath = path.join(runDir, "metadata.json");

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await writeFile(networkPath, `${JSON.stringify(networkEvents, null, 2)}\n`, "utf8");

  if (snapshot) {
    await writeFile(htmlPath, `${snapshot.html}\n`, "utf8");
    await writeFile(textPath, `${snapshot.text}\n`, "utf8");
    await writeFile(path.join(runDir, "page.summary.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }
}

function createRunStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}
