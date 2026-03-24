import { createRawSigaaPayloadMessage } from "./bridge.js";
import { isSigaaSessionExpired, sanitizeSigaaSession } from "./login-session.js";

const SIGAA_LOGIN_URL = "https://sigaa.ufba.br/sigaa/mobile/touch/login.jsf";
const DEFAULT_CAPTURE_TIMEOUT_MS = 45_000;
const CAPTURE_VIEWS = [
  {
    id: "classes",
    label: "Minhas Turmas",
    portalActionId: "form-portal-discente:lnkMinhasTurmas",
    expectedPattern: /Turmas do Discente|Hor[aá]rio:/i,
  },
  {
    id: "grades",
    label: "Minhas Notas",
    portalActionId: "form-portal-discente:lnkMinhasNotas",
    expectedPattern: /Relat[oó]rio de Notas|Situa[cç][aã]o/i,
  },
];

export async function runAutomaticSigaaSync({
  syncSessionId,
  session,
  timeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS,
}) {
  if (!session) {
    throw new Error("SIGAA credentials were not provided for this sync.");
  }

  if (isSigaaSessionExpired(session)) {
    throw new Error("The in-memory SIGAA session expired before the sync started.");
  }

  const capturedViews = [];
  const warnings = [];
  let portalProfile = null;

  for (const view of CAPTURE_VIEWS) {
    try {
      const capturedView = await captureSigaaView({
        session,
        portalActionId: view.portalActionId,
        expectedPattern: view.expectedPattern,
        label: view.label,
        timeoutMs,
      });

      portalProfile ??= capturedView.portalProfile;
      capturedViews.push({
        id: view.id,
        label: view.label,
        routeHint: capturedView.currentUrl,
        text: capturedView.text,
      });
    } catch (error) {
      warnings.push(
        `Aviso: a captura automatica de ${view.label} falhou nesta sessao. ${sanitizeErrorMessage(
          error,
        )}`,
      );
    }
  }

  if (capturedViews.length === 0) {
    throw new Error(
      warnings.length > 0
        ? `Automatic SIGAA sync did not produce any private view with usable text. ${warnings.join(
            " ",
          )}`
        : "Automatic SIGAA sync did not produce any private view with usable text.",
    );
  }

  return {
    rawPayloadMessage: createRawSigaaPayloadMessage({
      syncSessionId,
      source: "dom",
      capturedAt: new Date().toISOString(),
      routeHint: `sigaa-mobile:${capturedViews.map((view) => view.id).join("+")}`,
      htmlOrText: buildCombinedCaptureText({
        portalProfile,
        capturedViews,
        warnings,
      }),
    }),
    sanitizedSession: sanitizeSigaaSession(session),
    capturedViews,
  };
}

export function buildCombinedCaptureText({
  portalProfile,
  capturedViews,
  warnings = [],
}) {
  const blocks = [];

  if (
    portalProfile &&
    (portalProfile.studentName || portalProfile.studentNumber || portalProfile.courseName)
  ) {
    blocks.push(
      [
        "SIGAA Sync Local",
        portalProfile.studentName
          ? `Aluno(a): ${portalProfile.studentName}`
          : null,
        portalProfile.studentNumber
          ? `Matricula: ${portalProfile.studentNumber}`
          : null,
        portalProfile.courseName ? `Curso: ${portalProfile.courseName}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  for (const capturedView of capturedViews) {
    blocks.push(`[${capturedView.label}]\n${capturedView.text}`);
  }

  if (warnings.length > 0) {
    blocks.push(warnings.join("\n"));
  }

  return blocks.join("\n\n").trim();
}

async function captureSigaaView({
  session,
  portalActionId,
  expectedPattern,
  label,
  timeoutMs,
}) {
  const tab = await chrome.tabs.create({
    url: SIGAA_LOGIN_URL,
    active: false,
  });

  try {
    await waitForTabComplete(tab.id, timeoutMs);

    const loginResult = await executeTabScript(tab.id, submitLoginInPage, {
      usernameOrCpf: session.usernameOrCpf,
      password: session.password,
    });

    if (!loginResult?.submitted) {
      throw new Error(loginResult?.error ?? "SIGAA login form was not submitted.");
    }

    const portalState = await waitForAuthenticatedPortal(tab.id, timeoutMs);

    if (!portalState.authenticated) {
      throw new Error(
        "The SIGAA mobile portal did not confirm an authenticated session.",
      );
    }

    const portalProfile = await executeTabScript(tab.id, capturePortalProfileInPage);

    const actionResult = await executeTabScript(tab.id, submitPortalActionInPage, {
      portalActionId,
    });

    if (!actionResult?.submitted) {
      throw new Error(
        actionResult?.error ?? `SIGAA portal action ${portalActionId} was not submitted.`,
      );
    }

    const pageState = await waitForPageText(tab.id, expectedPattern, timeoutMs);
    const captured = await executeTabScript(tab.id, captureVisibleTextInPage, {
      label,
    });

    if (!captured?.text) {
      throw new Error(`SIGAA view ${label} returned an empty body.`);
    }

    return {
      portalProfile,
      currentUrl: captured.currentUrl ?? pageState.currentUrl,
      text: captured.text,
    };
  } finally {
    await closeTab(tab.id);
  }
}

async function waitForTabComplete(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.status === "complete") {
      return;
    }

    await sleep(250);
  }

  throw new Error(`SIGAA tab ${tabId} did not finish loading in time.`);
}

async function waitForPageText(tabId, expectedPattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await executeTabScript(tabId, inspectPageStateInPage).catch(
      () => null,
    );
    if (state?.text && expectedPattern.test(state.text)) {
      return state;
    }

    await sleep(400);
  }

  throw new Error(
    `SIGAA page did not expose the expected markers: ${expectedPattern.source}.`,
  );
}

async function waitForAuthenticatedPortal(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await executeTabScript(tabId, inspectPageStateInPage).catch(
      () => null,
    );

    if (!state) {
      await sleep(400);
      continue;
    }

    if (state.authenticated) {
      return state;
    }

    if (state.hasErrorBanner) {
      throw new Error(
        state.text || "The SIGAA mobile portal reported a login failure.",
      );
    }

    await sleep(400);
  }

  throw new Error(
    "The SIGAA mobile portal did not confirm an authenticated session.",
  );
}

async function executeTabScript(tabId, func, arg) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args: arg === undefined ? [] : [arg],
  });

  return results[0]?.result ?? null;
}

async function closeTab(tabId) {
  if (!tabId) {
    return;
  }

  await chrome.tabs.remove(tabId).catch(() => {});
}

function sleep(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function sanitizeErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function submitLoginInPage(input) {
  const usernameInput =
    document.querySelector('input[name*="user" i]') ??
    document.querySelector('input[type="text"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitControl =
    document.getElementById("form-login:entrar") ??
    document.querySelector('input[type="submit"]') ??
    document.querySelector('button[type="submit"]');

  if (!(usernameInput instanceof HTMLInputElement)) {
    return {
      submitted: false,
      error: "Username field was not found on the SIGAA login page.",
    };
  }

  if (!(passwordInput instanceof HTMLInputElement)) {
    return {
      submitted: false,
      error: "Password field was not found on the SIGAA login page.",
    };
  }

  usernameInput.value = input.usernameOrCpf;
  passwordInput.value = input.password;
  usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
  passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
  usernameInput.dispatchEvent(new Event("change", { bubbles: true }));
  passwordInput.dispatchEvent(new Event("change", { bubbles: true }));

  if (submitControl instanceof HTMLInputElement || submitControl instanceof HTMLButtonElement) {
    submitControl.click();
    return { submitted: true };
  }

  const form = document.getElementById("form-login");
  if (form instanceof HTMLFormElement) {
    form.submit();
    return { submitted: true };
  }

  return {
    submitted: false,
    error: "SIGAA login submit control was not found.",
  };
}

function inspectPageStateInPage() {
  const normalizeVisibleText = (value) => value.replace(/\s+/g, " ").trim();
  const text = normalizeVisibleText(document.body?.innerText ?? "");
  const currentUrl = window.location.href;
  const hasPasswordField =
    document.querySelector('input[type="password"]') !== null;
  const hasLoginField =
    document.querySelector('input[name*="user" i], input[type="text"]') !==
    null;
  const hasPortalForm =
    document.getElementById("form-portal-discente") instanceof HTMLFormElement;
  const hasPortalMarker =
    /Minhas Turmas|Minhas Notas|Consultar Hist[oó]rico/i.test(text);
  return {
    authenticated:
      hasPortalForm ||
      hasPortalMarker ||
      (!hasPasswordField && !hasLoginField && !/login/i.test(currentUrl)),
    currentUrl,
    hasErrorBanner: /erro|invalid|falha|incorre/i.test(text),
    text,
    title: document.title ?? "",
  };
}

function capturePortalProfileInPage() {
  const normalizeVisibleText = (value) => value.replace(/\s+/g, " ").trim();
  const studentNumber = normalizeVisibleText(
    document.getElementById("form-portal-discente:matricula")?.textContent ?? "",
  );
  const studentName = normalizeVisibleText(
    document.querySelector("#form-portal-discente strong")?.textContent ?? "",
  );
  const fieldContainer = document.querySelector("#form-portal-discente .ui-field-contain");
  const fieldLines = normalizeVisibleText(fieldContainer?.textContent ?? "")
    .split(/\s{2,}/)
    .filter(Boolean);

  return {
    studentNumber: studentNumber || null,
    studentName: studentName || null,
    courseName: fieldLines.at(-1) ?? null,
  };
}

function submitPortalActionInPage(input) {
  const form = document.getElementById("form-portal-discente");
  const control = document.getElementById(input.portalActionId);
  const submitter =
    typeof window.jsfcljs === "function" ? window.jsfcljs : null;

  if (!(form instanceof HTMLFormElement)) {
    return {
      submitted: false,
      error: "The SIGAA portal form is unavailable in the current page.",
    };
  }

  if (!control) {
    return {
      submitted: false,
      error: `The SIGAA portal action ${input.portalActionId} is unavailable in the current page.`,
    };
  }

  if (control instanceof HTMLElement) {
    control.click();
    return { submitted: true };
  }

  if (submitter) {
    submitter(
      form,
      {
        [input.portalActionId]: input.portalActionId,
      },
      "",
    );

    return { submitted: true };
  }

  return {
    submitted: false,
    error: "The SIGAA portal action could not be triggered in the current page.",
  };
}

function captureVisibleTextInPage(input) {
  const normalizeVisibleText = (value) => value.replace(/\s+/g, " ").trim();
  return {
    label: input.label,
    currentUrl: window.location.href,
    text: normalizeVisibleText(document.body?.innerText ?? ""),
    title: document.title ?? "",
  };
}
