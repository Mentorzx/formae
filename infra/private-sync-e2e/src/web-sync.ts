import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";

import type { WebSyncConfig } from "./config.js";

const AUTOMATIC_SYNC_SUCCESS_TEXT =
  "Minhas Turmas e Minhas Notas foram lidas localmente do SIGAA pela extensao.";
const SNAPSHOT_SAVED_PATTERN = /Snapshot automatico salvo localmente em .+\./;
const DETECTED_COMPONENT_PATTERN = /\b[A-Z]{4}\d{2,3}\b/g;
const DETECTED_SCHEDULE_PATTERN = /\b[2-7]+[MTN]\d{1,4}\b/g;

export interface WebSyncResult {
  webUrl: string;
  automaticMessage: string;
  snapshotMessage: string;
  vaultSealed: boolean;
  detectedComponentCount: number;
  detectedScheduleCount: number;
  durationMs: number;
}

export async function runWebSync(
  config: WebSyncConfig,
): Promise<WebSyncResult> {
  const startedAt = Date.now();
  const userDataDir = await mkdtemp(
    path.join(os.tmpdir(), "formae-web-sync-e2e-"),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: !config.headed,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
    ],
  });

  try {
    const page = await context.newPage();
    await page.goto(config.webUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });

    await page.locator("#sigaa-username").fill(config.username);
    await page.locator("#sigaa-password").fill(config.password);
    await page
      .getByRole("button", { name: "Importar automaticamente" })
      .click();

    await page
      .getByText(AUTOMATIC_SYNC_SUCCESS_TEXT, {
        exact: false,
      })
      .waitFor({ timeout: config.timeoutMs * 3 });

    await page
      .getByText(SNAPSHOT_SAVED_PATTERN)
      .waitFor({ timeout: config.timeoutMs });

    const bodyText = await page.locator("body").innerText();

    return {
      webUrl: config.webUrl,
      automaticMessage: AUTOMATIC_SYNC_SUCCESS_TEXT,
      snapshotMessage:
        bodyText.match(SNAPSHOT_SAVED_PATTERN)?.[0] ??
        "Snapshot automatico salvo localmente.",
      vaultSealed: /Estado:\s+selado/i.test(bodyText),
      detectedComponentCount: countDistinctMatches(
        bodyText,
        DETECTED_COMPONENT_PATTERN,
      ),
      detectedScheduleCount: countDistinctMatches(
        bodyText,
        DETECTED_SCHEDULE_PATTERN,
      ),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await context.close().catch(() => {});
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

function countDistinctMatches(input: string, pattern: RegExp): number {
  return new Set(input.match(pattern) ?? []).size;
}
