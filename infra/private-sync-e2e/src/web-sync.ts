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
    const extensionBaseUrl = await resolveExtensionBaseUrl(context);
    await seedExtensionPopupCredentials(
      context,
      extensionBaseUrl,
      config.username,
      config.password,
      config.timeoutMs,
    );

    const page = await context.newPage();
    await page.goto(config.webUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });

    const automaticSyncButton = page
      .locator("section.import-split-panel")
      .getByRole("button", { name: "Importar automaticamente" });

    await automaticSyncButton.waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
    await automaticSyncButton.click();

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

async function resolveExtensionBaseUrl(
  context: import("playwright").BrowserContext,
): Promise<string> {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker");
  }

  const serviceWorkerUrl = new URL(serviceWorker.url());
  return `${serviceWorkerUrl.protocol}//${serviceWorkerUrl.host}`;
}

async function seedExtensionPopupCredentials(
  context: import("playwright").BrowserContext,
  extensionBaseUrl: string,
  username: string,
  password: string,
  timeoutMs: number,
): Promise<void> {
  const popupPage = await context.newPage();

  try {
    await popupPage.goto(`${extensionBaseUrl}/src/popup.html`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await popupPage.locator("#usernameOrCpf").fill(username);
    await popupPage.locator("#password").fill(password);
    await popupPage
      .locator("#credentialForm button[type='submit']")
      .click();
    await popupPage
      .getByText("Credenciais guardadas apenas em memória.", {
        exact: false,
      })
      .waitFor({ timeout: timeoutMs });
  } finally {
    await popupPage.close().catch(() => {});
  }
}
