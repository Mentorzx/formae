import {
  createRawSigaaPayloadMessage,
  createSigaaSyncSnapshotMessage,
} from "./bridge.js";
import { isSigaaSessionExpired, sanitizeSigaaSession } from "./login-session.js";
import {
  createTab,
  executeScript,
  getTab,
  queryTabs,
  removeTab,
} from "./runtime.js";

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
  {
    id: "history",
    label: "Consultar Histórico",
    portalActionId: "form-portal-discente:lnkConsultarHistorico",
    expectedPattern:
      /Relat[oó]rio de Notas|Hist[oó]rico|Per[ií]odo|Situa[cç][aã]o/i,
  },
];
const COMPONENT_CODE_PATTERN = /\b([A-Z]{3,5}\d{2,3})\b/;
const COMPONENT_CODE_SCAN_PATTERN = /\b([A-Z]{3,5}\d{2,3})\b/g;
const SCHEDULE_CODE_PATTERN = /\b([2-7]+[MTN]\d{1,2})\b/g;
const GRADE_STATUS_PATTERN =
  /\b(APROVADO|REPROVADO|CANCELADO|TRANCADO|CURSANDO|MATRICULADO|APTO|INAPTO|EM CURSO|EM ANDAMENTO)\b/i;
const HISTORY_ROW_PATTERN =
  /^(?<period>\d{4}\.\d)\s+(?<componentName>.+?)\s+(?<gradeValue>\d{1,2}(?:[.,]\d{1,2})?|--)\s+(?<absences>\d+|--)\s+(?<statusText>APROVADO|REPROVADO|CANCELADO|TRANCADO|CURSANDO|MATRICULADO|APTO|INAPTO|EM CURSO|EM ANDAMENTO)\s*$/i;

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
        extractedHistory: capturedView.extractedHistory,
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

  const structuredCapture = buildStructuredSigaaCapture({
    portalProfile,
    capturedViews,
  });
  const capturedAt = new Date().toISOString();
  const routeHint = `sigaa-mobile:${capturedViews.map((view) => view.id).join("+")}`;
  const persistedRawInput = buildMinimizedCaptureText({
    structuredCapture,
    warnings,
  });
  const structuredContext = buildManualImportStructuredContext(
    structuredCapture,
  );

  return {
    rawPayloadMessage: createRawSigaaPayloadMessage({
      syncSessionId,
      source: "dom",
      capturedAt,
      routeHint,
      htmlOrText: persistedRawInput,
      structuredCapture,
    }),
    syncSnapshotMessage: createSigaaSyncSnapshotMessage({
      syncSessionId,
      source: "dom",
      capturedAt,
      routeHint,
      retentionMode: "structured-minimized",
      persistedRawInput,
      structuredContext,
      warnings,
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

export function buildStructuredSigaaCapture({
  portalProfile,
  capturedViews,
}) {
  return {
    schemaVersion: 1,
    portalProfile: portalProfile
      ? {
          studentNumber: portalProfile.studentNumber ?? null,
          studentName: portalProfile.studentName ?? null,
          courseName: portalProfile.courseName ?? null,
        }
      : null,
    views: capturedViews.map((capturedView) =>
      capturedView.id === "classes"
        ? {
            id: capturedView.id,
            label: capturedView.label,
            routeHint: capturedView.routeHint,
            text: buildStructuredViewSummary(capturedView),
            historyDocument: capturedView.historyDocument ?? null,
            extractedTurmas: extractTurmaEntries(capturedView.text),
          }
        : capturedView.id === "history"
          ? {
              id: capturedView.id,
              label: capturedView.label,
              routeHint: capturedView.routeHint,
              text: buildStructuredViewSummary(capturedView),
              historyDocument: capturedView.historyDocument ?? null,
              extractedHistory:
                capturedView.extractedHistory ?? extractHistoryEntries(capturedView.text),
            }
        : {
            id: capturedView.id,
            label: capturedView.label,
            routeHint: capturedView.routeHint,
            text: buildStructuredViewSummary(capturedView),
            extractedGrades: extractGradeEntries(capturedView.text),
          },
    ),
  };
}

export function buildMinimizedCaptureText({
  structuredCapture,
  warnings = [],
}) {
  const blocks = ["SIGAA Sync Local", "[Resumo estruturado minimizado]"];

  if (
    structuredCapture.portalProfile &&
    (structuredCapture.portalProfile.studentName ||
      structuredCapture.portalProfile.studentNumber ||
      structuredCapture.portalProfile.courseName)
  ) {
    blocks.push(
      [
        structuredCapture.portalProfile.studentName
          ? `Aluno(a): ${structuredCapture.portalProfile.studentName}`
          : null,
        structuredCapture.portalProfile.studentNumber
          ? `Matricula: ${structuredCapture.portalProfile.studentNumber}`
          : null,
        structuredCapture.portalProfile.courseName
          ? `Curso: ${structuredCapture.portalProfile.courseName}`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  for (const view of structuredCapture.views) {
    if (view.id === "classes") {
      blocks.push(
        `[${view.label}] ${view.extractedTurmas.length} turma(s)`,
        ...view.extractedTurmas.map((entry) =>
          [
            entry.componentCode,
            entry.scheduleCodes.length > 0
              ? `Horario: ${entry.scheduleCodes.join(" ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" - "),
        ),
      );
      continue;
    }

    if (view.id === "grades") {
      blocks.push(
        `[${view.label}] ${view.extractedGrades.length} registro(s)`,
        ...view.extractedGrades.map((entry) =>
          [
            entry.componentCode,
            entry.componentName ?? null,
            entry.statusText ?? null,
          ]
            .filter(Boolean)
            .join(" - "),
        ),
      );
      continue;
    }

    blocks.push(
      `[${view.label}] ${view.extractedHistory.length} registro(s)`,
      ...view.extractedHistory.map((entry) =>
        [
          entry.academicPeriod,
          entry.componentName,
          entry.gradeValue ?? null,
          entry.statusText ?? null,
        ]
          .filter(Boolean)
          .join(" - "),
      ),
    );
  }

  if (warnings.length > 0) {
    blocks.push(...warnings);
  }

  return `${blocks.filter(Boolean).join("\n")}\n`;
}

export function buildManualImportStructuredContext(structuredCapture) {
  if (!structuredCapture) {
    return null;
  }

  const componentStates = [];
  const scheduleBindings = [];
  const historyEntries = [];
  let historyDocument = null;

  for (const view of structuredCapture.views) {
    if (view.id === "classes") {
      for (const turmaEntry of view.extractedTurmas) {
        componentStates.push({
          code: turmaEntry.componentCode,
          title: extractTitleFromRawLine(turmaEntry.rawLine),
          status: "inProgress",
          source: "classes",
          rawLine: turmaEntry.rawLine,
          statusText: null,
          scheduleCodes: turmaEntry.scheduleCodes,
        });

        for (const scheduleCode of turmaEntry.scheduleCodes) {
          scheduleBindings.push({
            componentCode: turmaEntry.componentCode,
            scheduleCode,
            source: "classes",
          });
        }
      }

      continue;
    }

    if (view.id === "grades") {
      for (const gradeEntry of view.extractedGrades) {
        componentStates.push({
          code: gradeEntry.componentCode,
          title: gradeEntry.componentName ?? extractTitleFromRawLine(gradeEntry.rawLine),
          status: deriveAcademicStatus(gradeEntry.statusText),
          source: "grades",
          rawLine: gradeEntry.rawLine,
          statusText: gradeEntry.statusText,
          scheduleCodes: [],
        });
      }

      continue;
    }

    historyDocument ??= view.historyDocument ?? null;

    for (const historyEntry of view.extractedHistory) {
      const componentCode =
        extractComponentCode(historyEntry.componentName) ??
        extractComponentCode(historyEntry.rawLine);

      historyEntries.push({
        academicPeriod: historyEntry.academicPeriod,
        componentCode,
        componentName: historyEntry.componentName,
        normalizedTitle: normalizeHistoryComponentTitle(
          historyEntry.componentName,
          componentCode,
        ),
        gradeValue: historyEntry.gradeValue,
        absences: historyEntry.absences,
        statusText: historyEntry.statusText,
        rawLine: historyEntry.rawLine,
      });
    }
  }

  return {
    studentProfile: structuredCapture.portalProfile
      ? {
          studentNumber: structuredCapture.portalProfile.studentNumber ?? null,
          studentName: structuredCapture.portalProfile.studentName ?? null,
          courseName: structuredCapture.portalProfile.courseName ?? null,
        }
      : null,
    componentStates: deduplicateComponentStates(componentStates),
    scheduleBindings: deduplicateScheduleBindings(scheduleBindings),
    historyEntries,
    historyDocument,
  };
}

function buildStructuredViewSummary(capturedView) {
  if (capturedView.id === "classes") {
    const entries = extractTurmaEntries(capturedView.text);
    return entries.length === 0
      ? null
      : entries
          .map((entry) =>
            [
              entry.componentCode,
              entry.scheduleCodes.length > 0
                ? `Horario: ${entry.scheduleCodes.join(" ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" - "),
          )
          .join("\n");
  }

  if (capturedView.id === "grades") {
    const entries = extractGradeEntries(capturedView.text);
    return entries.length === 0
      ? null
      : entries
          .map((entry) =>
            [
              entry.componentCode,
              entry.componentName ?? null,
              entry.statusText ?? null,
            ]
              .filter(Boolean)
              .join(" - "),
          )
          .join("\n");
  }

  const entries =
    capturedView.extractedHistory ?? extractHistoryEntries(capturedView.text);
  return entries.length === 0
    ? null
    : entries
        .map((entry) =>
          [
            entry.academicPeriod,
            extractComponentCode(entry.componentName ?? entry.rawLine),
            entry.statusText ?? null,
          ]
            .filter(Boolean)
            .join(" - "),
        )
        .join("\n");
}

function extractComponentCode(value) {
  const normalized = value.toUpperCase();
  const match = normalized.match(COMPONENT_CODE_PATTERN);
  return match?.[1] ?? null;
}

function extractTitleFromRawLine(rawLine) {
  return rawLine
    .replace(COMPONENT_CODE_PATTERN, "")
    .replace(SCHEDULE_CODE_PATTERN, "")
    .replace(GRADE_STATUS_PATTERN, "")
    .replace(/hor[aá]rio:/giu, "")
    .replace(/[–—-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim() || null;
}

function normalizeHistoryComponentTitle(componentName, componentCode) {
  const title = componentCode
    ? componentName.replace(componentCode, "").trim()
    : componentName.trim();
  return title.length > 0 ? title : null;
}

function deriveAcademicStatus(statusText) {
  if (!statusText) {
    return "unknown";
  }

  const normalized = statusText.toUpperCase();

  if (/APROVADO|APTO/iu.test(normalized)) {
    return "completed";
  }

  if (/CURSANDO|MATRICULADO|EM CURSO|EM ANDAMENTO/iu.test(normalized)) {
    return "inProgress";
  }

  if (/REPROVADO|CANCELADO|TRANCADO|INAPTO/iu.test(normalized)) {
    return "failed";
  }

  return "unknown";
}

function deduplicateComponentStates(componentStates) {
  const byKey = new Map();

  for (const componentState of componentStates) {
    const key = `${componentState.code}:${componentState.source}`;
    if (!byKey.has(key)) {
      byKey.set(key, componentState);
      continue;
    }

    const current = byKey.get(key);
    byKey.set(key, {
      ...current,
      title: current.title ?? componentState.title,
      statusText: current.statusText ?? componentState.statusText,
      scheduleCodes: Array.from(
        new Set([...current.scheduleCodes, ...componentState.scheduleCodes]),
      ),
    });
  }

  return [...byKey.values()];
}

function deduplicateScheduleBindings(scheduleBindings) {
  const uniqueBindings = new Map();

  for (const binding of scheduleBindings) {
    uniqueBindings.set(
      `${binding.componentCode}:${binding.scheduleCode}:${binding.source}`,
      binding,
    );
  }

  return [...uniqueBindings.values()];
}

async function captureSigaaView({
  session,
  portalActionId,
  expectedPattern,
  label,
  timeoutMs,
}) {
  const tab = await createTab({
    url: SIGAA_LOGIN_URL,
    active: false,
  });
  const trackedTabIds = new Set([tab.id].filter(Boolean));

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

    const knownSigaaTabIds = await listSigaaTabIds();
    const actionResult = await executeTabScript(
      tab.id,
      submitPortalActionInPage,
      {
        portalActionId,
      },
    );

    if (!actionResult?.submitted) {
      throw new Error(
        actionResult?.error ?? `SIGAA portal action ${portalActionId} was not submitted.`,
      );
    }

    const captureTabId = await resolveCaptureTabId({
      defaultTabId: tab.id,
      knownSigaaTabIds,
      timeoutMs,
    });
    trackedTabIds.add(captureTabId);

    const historyCapture = label === "Consultar Histórico";
    const pageState = historyCapture
      ? await waitForHistoryPageState(captureTabId, expectedPattern, timeoutMs)
      : await waitForPageText(captureTabId, expectedPattern, timeoutMs);
    const captured = await executeTabScript(
      captureTabId,
      historyCapture ? captureHistoryVisibleTextInPage : captureVisibleTextInPage,
      {
        label,
      },
    );
    const capturedText = captured?.text?.trim() ? captured.text : pageState.text;

    if (!capturedText) {
      throw new Error(`SIGAA view ${label} returned an empty body.`);
    }

    return {
      portalProfile,
      currentUrl: captured?.currentUrl ?? pageState.currentUrl,
      text: capturedText,
      extractedHistory: captured?.extractedHistory ?? null,
      historyDocument: captured?.historyDocument ?? null,
    };
  } finally {
    for (const trackedTabId of trackedTabIds) {
      await closeTab(trackedTabId);
    }
  }
}

async function waitForTabComplete(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
  const tab = await getTab(tabId).catch(() => null);
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

async function waitForHistoryPageState(tabId, expectedPattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await executeTabScript(tabId, inspectHistoryPageStateInPage).catch(
      () => null,
    );

    if (!state) {
      await sleep(400);
      continue;
    }

    if (state.text && expectedPattern.test(state.text)) {
      return state;
    }

    if (state.hasHistoryMarker || state.isPdfLike || state.isAttachmentLike) {
      return state;
    }

    await sleep(400);
  }

  throw new Error(
    `SIGAA history page did not expose a readable report or PDF/attachment markers: ${expectedPattern.source}.`,
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

async function resolveCaptureTabId({
  defaultTabId,
  knownSigaaTabIds,
  timeoutMs,
}) {
  const deadline = Date.now() + Math.min(timeoutMs, 10_000);

  while (Date.now() < deadline) {
    const currentSigaaTabIds = await listSigaaTabIds();
    const popupTabId = currentSigaaTabIds.find(
      (tabId) => !knownSigaaTabIds.includes(tabId),
    );

    if (popupTabId) {
      return popupTabId;
    }

    await sleep(250);
  }

  return defaultTabId;
}

async function listSigaaTabIds() {
  const tabs = await queryTabs({}).catch(() => []);

  return tabs
    .filter((tab) => {
      const url = `${tab.url ?? tab.pendingUrl ?? ""}`;
      return typeof tab.id === "number" && url.includes("sigaa.ufba.br");
    })
    .map((tab) => tab.id);
}

async function executeTabScript(tabId, func, arg) {
  const results = await executeScript({
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

  await removeTab(tabId).catch(() => {});
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

  if (control instanceof HTMLElement) {
    control.click();
    return { submitted: true };
  }

  return {
    submitted: false,
    error: "The SIGAA portal action could not be triggered in the current page.",
  };
}

function captureVisibleTextInPage(input) {
  const extractedHistory =
    extractHistoryTableRowsInPage() ?? extractHistoryEntries(document.body?.innerText ?? "");

  return {
    label: input.label,
    currentUrl: window.location.href,
    text: normalizeTextWithLines(document.body?.innerText ?? ""),
    title: document.title ?? "",
    extractedHistory: extractedHistory.length > 0 ? extractedHistory : null,
  };
}

function captureHistoryVisibleTextInPage(input) {
  const currentUrl = window.location.href;
  const title = document.title ?? "";
  const text = normalizeTextWithLines(document.body?.innerText ?? "");
  const historyDocument = buildHistoryDocumentMetadata({
    currentUrl,
    title,
    text,
    sourceCandidates: collectHistorySourceCandidatesInPage(),
    hasPdfLikeMarker: detectPdfLikeMarkerInPage(),
    hasAttachmentLikeMarker: detectAttachmentLikeMarkerInPage(),
  });
  const extractedHistory =
    extractHistoryTableRowsInPage() ?? extractHistoryEntries(text);

  return {
    label: input.label,
    currentUrl,
    text,
    title,
    historyDocument,
    extractedHistory: extractedHistory.length > 0 ? extractedHistory : null,
  };
}

function extractTurmaEntries(text) {
  return splitComponentSegments(text).map(({ componentCode, rawSegment }) => {
    const scheduleCodes = uniqueValues(
      Array.from(rawSegment.matchAll(SCHEDULE_CODE_PATTERN), (match) => match[1]),
    );

    return {
      componentCode,
      componentName: extractComponentName(rawSegment, componentCode),
      scheduleCodes,
      rawLine: rawSegment,
    };
  });
}

function extractGradeEntries(text) {
  return splitComponentSegments(text).map(({ componentCode, rawSegment }) => {
    const statusText = rawSegment.match(GRADE_STATUS_PATTERN)?.[1] ?? null;
    const gradeValue = extractGradeValue(rawSegment, statusText);

    return {
      componentCode,
      componentName: extractComponentName(rawSegment, componentCode, statusText),
      gradeValue,
      statusText,
      rawLine: rawSegment,
    };
  });
}

function extractHistoryEntries(text) {
  return splitHistorySegments(text)
    .map((rawLine) => {
      const gradeMatch = rawLine.match(HISTORY_ROW_PATTERN);

      if (!gradeMatch?.groups) {
        return null;
      }

      return {
        academicPeriod: gradeMatch.groups.period,
        componentName: gradeMatch.groups.componentName.trim(),
        gradeValue: gradeMatch.groups.gradeValue,
        absences: gradeMatch.groups.absences,
        statusText: gradeMatch.groups.statusText.toUpperCase(),
        rawLine,
      };
    })
    .filter(Boolean);
}

export function buildHistoryDocumentMetadata({
  currentUrl,
  title,
  text,
  sourceCandidates,
  hasPdfLikeMarker,
  hasAttachmentLikeMarker,
}) {
  const sanitizedSourceCandidates = sourceCandidates.map((candidate) => ({
    ...candidate,
    text: null,
  }));
  const pdfCandidates = sanitizedSourceCandidates.filter(
    (candidate) => candidate.kind === "pdf" || /\.pdf(\?|#|$)/i.test(candidate.url),
  );
  const attachmentCandidates = sanitizedSourceCandidates.filter(
    (candidate) => candidate.kind === "attachment" || candidate.hasDownloadHint,
  );
  const hasVisibleHistoryText = /Relat[oó]rio de Notas|Hist[oó]rico|Per[ií]odo|Situa[cç][aã]o/i.test(
    text,
  );

  return {
    currentUrl,
    title,
    transportKind: hasPdfLikeMarker
      ? "pdf"
      : hasAttachmentLikeMarker
        ? "attachment"
        : pdfCandidates.length > 0
          ? "pdf"
          : attachmentCandidates.length > 0
            ? "attachment"
            : hasVisibleHistoryText
              ? "html"
              : "unknown",
    hasVisibleHistoryText,
    hasPdfLikeMarker,
    hasAttachmentLikeMarker,
    textLength: text.length,
    sourceCandidates: sanitizedSourceCandidates,
    pdfCandidates,
    attachmentCandidates,
  };
}

function extractHistoryTableRowsInPage() {
  const tables = Array.from(document.querySelectorAll("table"));

  for (const table of tables) {
    const headerCells = Array.from(table.querySelectorAll("thead th")).map((cell) =>
      normalizeVisibleCellText(cell.textContent ?? ""),
    );

    if (
      headerCells.length < 4 ||
      !headerCells.some((value) => /periodo|per[ií]odo/i.test(value)) ||
      !headerCells.some((value) => /situacao|situa[cç][aã]o/i.test(value))
    ) {
      continue;
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td")).map((cell) =>
          normalizeVisibleCellText(cell.textContent ?? ""),
        );

        if (cells.length < 5) {
          return null;
        }

        const [academicPeriod, componentName, gradeValue, absences, statusText] = cells;

        return {
          academicPeriod,
          componentName,
          gradeValue,
          absences,
          statusText,
          rawLine: cells.join(" "),
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      return rows;
    }
  }

  return null;
}

function inspectHistoryPageStateInPage() {
  const text = normalizeTextWithLines(document.body?.innerText ?? "");
  return {
    currentUrl: window.location.href,
    title: document.title ?? "",
    text,
    hasHistoryMarker: /Relat[oó]rio de Notas|Hist[oó]rico|Per[ií]odo|Situa[cç][aã]o/i.test(text),
    isPdfLike: detectPdfLikeMarkerInPage(),
    isAttachmentLike: detectAttachmentLikeMarkerInPage(),
  };
}

function splitMeaningfulLines(text) {
  return normalizeTextWithLines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitComponentSegments(text) {
  const normalizedText = normalizeTextWithLines(text);
  const matches = Array.from(normalizedText.matchAll(COMPONENT_CODE_SCAN_PATTERN));

  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const endIndex = matches[index + 1]?.index ?? normalizedText.length;

    return {
      componentCode: match[1],
      rawSegment: normalizedText.slice(startIndex, endIndex).trim(),
    };
  });
}

function splitHistorySegments(text) {
  const normalizedText = normalizeTextWithLines(text);
  const matches = Array.from(normalizedText.matchAll(/\b\d{4}\.\d\b/g));

  if (matches.length === 0) {
    return splitMeaningfulLines(normalizedText);
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const endIndex = matches[index + 1]?.index ?? normalizedText.length;

    return normalizedText.slice(startIndex, endIndex).trim();
  });
}

function normalizeTextWithLines(value) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function extractComponentName(rawSegment, componentCode, terminalToken = null) {
  const terminalTokenPattern = terminalToken
    ? new RegExp(escapeRegex(terminalToken), "i")
    : null;

  const withoutCode = rawSegment.replace(componentCode, "").trim();
  const withoutTerminal = terminalTokenPattern
    ? withoutCode.replace(terminalTokenPattern, "").trim()
    : withoutCode;
  const withoutScheduleMarker = withoutTerminal.replace(
    /\b(?:Horario|Horário)\s*:\s*.*$/i,
    "",
  ).trim();

  return withoutScheduleMarker.replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, "") || null;
}

function extractGradeValue(rawSegment, statusText) {
  const withoutStatus = statusText
    ? rawSegment.replace(new RegExp(escapeRegex(statusText), "i"), "").trim()
    : rawSegment;
  const matches = Array.from(
    withoutStatus.matchAll(/\b(\d{1,2}(?:[.,]\d{1,2})?|--)\b/g),
    (match) => match[1],
  );

  return matches.at(-1) ?? null;
}

function normalizeVisibleCellText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function detectPdfLikeMarkerInPage() {
  if (
    document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]')
  ) {
    return true;
  }

  return (
    document.querySelector(
      'iframe[src$=".pdf" i], embed[src$=".pdf" i], object[data$=".pdf" i], a[href$=".pdf" i]',
    ) !== null ||
    /\.pdf(\?|#|$)/i.test(window.location.href)
  );
}

function detectAttachmentLikeMarkerInPage() {
  return (
    document.querySelector("a[download]") !== null ||
    document.querySelector('a[href*="download" i], a[href*="attachment" i]') !== null ||
    /download|attachment|anexo/i.test(document.body?.innerText ?? "") ||
    /download|attachment|anexo/i.test(document.title ?? "")
  );
}

function collectHistorySourceCandidatesInPage() {
  return Array.from(
    document.querySelectorAll('a[href], iframe[src], embed[src], object[data]'),
  )
    .map((node) => {
      const href =
        node instanceof HTMLAnchorElement
          ? node.href
          : node instanceof HTMLIFrameElement || node instanceof HTMLEmbedElement
            ? node.src
            : node instanceof HTMLObjectElement
              ? node.data
              : "";
      const text = normalizeVisibleCellText(node.textContent ?? "");
      const hasDownloadHint =
        node instanceof HTMLAnchorElement
          ? node.hasAttribute("download")
          : /download|attachment|anexo/i.test(text) || /download|attachment|anexo/i.test(href);

      return {
        kind:
          node instanceof HTMLAnchorElement && node.hasAttribute("download")
            ? "attachment"
            : /\.pdf(\?|#|$)/i.test(href)
              ? "pdf"
              : hasDownloadHint
                ? "attachment"
                : "link",
        url: href || "",
        text: text || null,
        hasDownloadHint,
      };
    })
    .filter((candidate) => candidate.url || candidate.text);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
