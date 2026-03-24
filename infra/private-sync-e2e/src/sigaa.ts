import type { Locator, Page } from "playwright";

import { locatorText } from "./sanitize.js";

export interface SigaaLoginResult {
  usedSelectors: {
    username: string;
    password: string;
    submit: string;
  };
  authenticated: boolean;
  loginUrl: string;
  finalUrl: string;
  statusText: string;
}

export type SigaaCaptureTarget = "portal-home" | "history" | "classes" | "grades";

interface LocatorCandidate {
  description: string;
  match(page: Page): Promise<boolean>;
  locator(page: Page): Locator;
}

const USERNAME_CANDIDATES: LocatorCandidate[] = [
  {
    description: "label:Usuario",
    match: async (page) => (await page.getByLabel(/usu[a\u00e1]rio/i).count()) > 0,
    locator: (page) => page.getByLabel(/usu[a\u00e1]rio/i).first(),
  },
  {
    description: "label:Login",
    match: async (page) => (await page.getByLabel(/login/i).count()) > 0,
    locator: (page) => page.getByLabel(/login/i).first(),
  },
  {
    description: "css:input[name*=user]",
    match: async (page) => (await page.locator('input[name*="user" i]').count()) > 0,
    locator: (page) => page.locator('input[name*="user" i]').first(),
  },
  {
    description: "css:input[type=text]",
    match: async (page) => (await page.locator('input[type="text"]').count()) > 0,
    locator: (page) => page.locator('input[type="text"]').first(),
  },
];

const PASSWORD_CANDIDATES: LocatorCandidate[] = [
  {
    description: "label:Senha",
    match: async (page) => (await page.getByLabel(/senha/i).count()) > 0,
    locator: (page) => page.getByLabel(/senha/i).first(),
  },
  {
    description: "css:input[type=password]",
    match: async (page) => (await page.locator('input[type="password"]').count()) > 0,
    locator: (page) => page.locator('input[type="password"]').first(),
  },
];

const SUBMIT_CANDIDATES: LocatorCandidate[] = [
  {
    description: "role:button/entrar",
    match: async (page) => (await page.getByRole("button", { name: /entrar|acessar|login|ok/i }).count()) > 0,
    locator: (page) => page.getByRole("button", { name: /entrar|acessar|login|ok/i }).first(),
  },
  {
    description: "css:button[type=submit]",
    match: async (page) => (await page.locator('button[type="submit"]').count()) > 0,
    locator: (page) => page.locator('button[type="submit"]').first(),
  },
  {
    description: "css:input[type=submit]",
    match: async (page) => (await page.locator('input[type="submit"]').count()) > 0,
    locator: (page) => page.locator('input[type="submit"]').first(),
  },
];

export async function signInToSigaa(
  page: Page,
  loginUrl: string,
  username: string,
  password: string,
  timeoutMs: number,
): Promise<SigaaLoginResult> {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  const usernameCandidate = await resolveCandidate(page, USERNAME_CANDIDATES, "username field");
  const passwordCandidate = await resolveCandidate(page, PASSWORD_CANDIDATES, "password field");
  const submitCandidate = await resolveCandidate(page, SUBMIT_CANDIDATES, "submit control");

  await usernameCandidate.locator(page).fill(username);
  await passwordCandidate.locator(page).fill(password);
  await submitCandidate.locator(page).click();

  const authenticated = await waitForAuthentication(page, timeoutMs);
  const statusText = authenticated
    ? "authenticated"
    : await collectVisibleStatusText(page);

  return {
    usedSelectors: {
      username: usernameCandidate.description,
      password: passwordCandidate.description,
      submit: submitCandidate.description,
    },
    authenticated,
    loginUrl,
    finalUrl: page.url(),
    statusText,
  };
}

async function resolveCandidate(
  page: Page,
  candidates: LocatorCandidate[],
  label: string,
): Promise<LocatorCandidate> {
  for (const candidate of candidates) {
    if (await candidate.match(page)) {
      return candidate;
    }
  }

  const screenshotHint = await page.title().catch(() => "");
  throw new Error(`Unable to find ${label} on the SIGAA login page. Current title: ${screenshotHint}`);
}

async function waitForAuthentication(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    const hasPasswordField = (await page.locator('input[type="password"]').count().catch(() => 0)) > 0;
    const hasLoginLabel = (await page.getByLabel(/senha|usu[a\u00e1]rio|login/i).count().catch(() => 0)) > 0;
    const pageText = await collectVisibleStatusText(page);
    const hasErrorBanner = /erro|invalid|falha|incorre/i.test(pageText);
    const hasPortalMarker = /consultar hist[oó]rico|minhas turmas|minhas notas/i.test(pageText);

    if (hasPortalMarker) {
      return true;
    }

    if (!hasPasswordField && !hasLoginLabel && !/login/i.test(url)) {
      return true;
    }

    if (hasErrorBanner) {
      return false;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

export async function navigateToCaptureTarget(
  page: Page,
  captureTarget: SigaaCaptureTarget,
  timeoutMs: number,
): Promise<{
  page: Page;
  captureTarget: SigaaCaptureTarget;
  matchedSelector: string | null;
  pageText: string;
}> {
  if (captureTarget === "portal-home") {
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(timeoutMs, 10000),
    }).catch(() => {});

    return {
      page,
      captureTarget,
      matchedSelector: null,
      pageText: await collectVisibleStatusText(page),
    };
  }

  const portalActionId =
    captureTarget === "history"
      ? "form-portal-discente:lnkConsultarHistorico"
      : captureTarget === "classes"
        ? "form-portal-discente:lnkMinhasTurmas"
        : "form-portal-discente:lnkMinhasNotas";

  const submissionResult = await submitPortalAction(
    page,
    portalActionId,
    timeoutMs,
  );
  if (!submissionResult.submitted) {
    throw new Error(
      `Unable to open SIGAA capture target ${captureTarget}. The authenticated portal form could not be submitted.`,
    );
  }

  const capturePage = submissionResult.page;

  await capturePage.waitForLoadState("networkidle", {
    timeout: Math.min(timeoutMs, 10000),
  }).catch(() => {});
  await waitForMeaningfulContent(capturePage, captureTarget, timeoutMs);

  return {
    page: capturePage,
    captureTarget,
    matchedSelector: portalActionId,
    pageText: await collectVisibleStatusText(capturePage),
  };
}

async function submitPortalAction(
  page: Page,
  controlId: string,
  timeoutMs: number,
): Promise<{ page: Page; submitted: boolean }> {
  const formSelector = '[id="form-portal-discente"]';
  if ((await page.locator(formSelector).count().catch(() => 0)) === 0) {
    return {
      page,
      submitted: false,
    };
  }

  const popupPromise = page.context().waitForEvent("page", {
    timeout: Math.min(timeoutMs, 10000),
  }).catch(() => null);

  const submitted = await page
    .evaluate((nextControlId) => {
      const form = document.getElementById("form-portal-discente") as HTMLFormElement | null;
      const control = document.getElementById(nextControlId);
      const submitter =
        typeof window !== "undefined" &&
        "jsfcljs" in window &&
        typeof (window as Window & { jsfcljs?: unknown }).jsfcljs === "function"
          ? ((window as Window & {
              jsfcljs: (
                form: HTMLFormElement,
                payload: Record<string, string>,
                target?: string,
              ) => void;
            }).jsfcljs as (
              form: HTMLFormElement,
              payload: Record<string, string>,
              target?: string,
            ) => void)
          : null;

      if (!form || !control || !submitter) {
        return false;
      }

      submitter(
        form,
        {
          [nextControlId]: nextControlId,
        },
        "",
      );
      return true;
    }, controlId)
    .catch(() => false);

  const popupPage = await popupPromise;

  if (popupPage) {
    await popupPage.waitForLoadState("domcontentloaded", {
      timeout: Math.min(timeoutMs, 10000),
    }).catch(() => {});
  }

  return {
    page: popupPage ?? page,
    submitted,
  };
}

async function waitForMeaningfulContent(
  page: Page,
  captureTarget: SigaaCaptureTarget,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const expectedPattern =
    captureTarget === "history"
      ? /hist[oó]rico|\b[A-Z]{3,5}\d{2,3}\b/
      : captureTarget === "classes"
        ? /turmas|\b[A-Z]{3,5}\d{2,3}\b/
        : /notas|\b[A-Z]{3,5}\d{2,3}\b/;

  while (Date.now() < deadline) {
    const text = await collectVisibleStatusText(page);

    if (expectedPattern.test(text)) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    `SIGAA capture target ${captureTarget} did not expose recognizable content before timeout.`,
  );
}

async function collectVisibleStatusText(page: Page): Promise<string> {
  const candidates = [
    "[role=alert]",
    ".alert",
    ".error",
    ".message",
    ".mensagem",
    ".erro",
    "body",
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    const text = await locatorText(locator).catch(() => "");
    if (text) {
      return text;
    }
  }

  return "";
}
