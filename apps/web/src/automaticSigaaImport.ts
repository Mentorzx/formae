import type {
  AcademicComponentStatus,
  LocalStudentSnapshotBundle,
  ManualImportNormalizedSchedule,
  ManualImportPreview,
  ManualImportStructuredComponentState,
  ManualImportStructuredContext,
  ManualImportStructuredHistoryEntry,
  ManualImportStructuredScheduleBinding,
  RawSigaaPayloadPayload,
  TimingProfileId,
} from "@formae/protocol";
import { createManualImportPreview } from "./manualImport";
import { buildManualImportStoredSnapshot } from "./manualSnapshot";
import { findCatalogMatches } from "./publicCatalog";
import { buildLocalStudentSnapshotBundle } from "./studentSnapshot";
import { normalizeScheduleCodesWithWasm } from "./wasmScheduleParser";

export async function buildAutomaticSigaaSyncBundle(input: {
  rawPayload: RawSigaaPayloadPayload;
  timingProfileId: TimingProfileId;
  normalizeSchedules?: (
    scheduleCodes: string[],
    timingProfileId: TimingProfileId,
  ) => Promise<ManualImportNormalizedSchedule[]>;
}): Promise<{
  bundle: LocalStudentSnapshotBundle;
  matchedComponentCodes: string[];
}> {
  const structuredContext = buildStructuredManualImportContext(
    input.rawPayload,
  );
  const persistedRawInput =
    buildMinimizedPersistedRawInput(structuredContext) ??
    input.rawPayload.htmlOrText;
  const textPreview = createManualImportPreview({
    source: "sigaa-html",
    rawInput: persistedRawInput,
    capturedAt: input.rawPayload.capturedAt,
    timingProfileId: input.timingProfileId,
  });
  const preview = mergeStructuredPreview(textPreview, structuredContext);
  const normalizeSchedules =
    input.normalizeSchedules ?? normalizeScheduleCodesWithWasm;
  const normalizedSchedules = await normalizeSchedules(
    preview.detectedScheduleCodes,
    input.timingProfileId,
  );
  const matchedCatalogComponents = findCatalogMatches(
    preview.detectedComponentCodes,
  );
  const manualImport = buildManualImportStoredSnapshot({
    rawInput: persistedRawInput,
    source: "sigaa-html",
    retentionMode: structuredContext ? "structured-minimized" : "full-raw-text",
    timingProfileId: input.timingProfileId,
    preview,
    normalizedSchedules,
    structuredContext,
    matchedCatalogComponentCodes: matchedCatalogComponents.map(
      (component) => component.code,
    ),
  });
  const bundle = buildLocalStudentSnapshotBundle({
    manualImport,
    matchedCatalogComponents,
  });

  return {
    bundle,
    matchedComponentCodes: matchedCatalogComponents.map(
      (component) => component.code,
    ),
  };
}

function buildMinimizedPersistedRawInput(
  structuredContext: ManualImportStructuredContext | null,
): string | null {
  if (!structuredContext) {
    return null;
  }

  const lines = ["SIGAA Sync Local", "[Resumo minimizado]"];

  for (const componentState of structuredContext.componentStates) {
    const summaryParts = [
      componentState.code,
      componentState.title,
      formatStructuredStatus(componentState.status, componentState.statusText),
      componentState.scheduleCodes.length > 0
        ? `Horario: ${componentState.scheduleCodes.join(" ")}`
        : null,
    ].filter(Boolean);

    lines.push(summaryParts.join(" - "));
  }

  if ((structuredContext.historyEntries?.length ?? 0) > 0) {
    lines.push(
      `Historico local: ${structuredContext.historyEntries?.length ?? 0} registro(s) estruturado(s).`,
    );
  }

  if (lines.length === 2) {
    lines.push("Nenhum componente estruturado foi preservado neste resumo.");
  }

  return `${lines.join("\n")}\n`;
}

function mergeStructuredPreview(
  preview: ManualImportPreview,
  structuredContext: ManualImportStructuredContext | null,
): ManualImportPreview {
  if (!structuredContext) {
    return preview;
  }

  const detectedComponentCodes = uniqueValues([
    ...preview.detectedComponentCodes,
    ...structuredContext.componentStates.map(
      (componentState) => componentState.code,
    ),
  ]);
  const detectedScheduleCodes = uniqueValues([
    ...preview.detectedScheduleCodes,
    ...structuredContext.scheduleBindings.map(
      (binding) => binding.scheduleCode,
    ),
  ]);
  const warnings = preview.warnings.filter((warning) => {
    if (
      warning ===
        "Nenhum codigo de horario foi detectado no texto informado." &&
      detectedScheduleCodes.length > 0
    ) {
      return false;
    }

    if (
      warning ===
        "Nenhum codigo de componente foi detectado no texto informado." &&
      detectedComponentCodes.length > 0
    ) {
      return false;
    }

    return true;
  });

  return {
    ...preview,
    detectedComponentCodes,
    detectedScheduleCodes,
    warnings,
  };
}

function buildStructuredManualImportContext(
  rawPayload: RawSigaaPayloadPayload,
): ManualImportStructuredContext | null {
  const structuredCapture = rawPayload.structuredCapture;

  if (!structuredCapture) {
    return null;
  }

  const componentStateByCode = new Map<
    string,
    ManualImportStructuredComponentState
  >();
  const scheduleBindings: ManualImportStructuredScheduleBinding[] = [];
  const historyEntries: ManualImportStructuredHistoryEntry[] = [];
  let historyDocument = null;

  for (const view of structuredCapture.views) {
    if (view.id === "classes") {
      for (const turmaEntry of mergeTurmaEntries(
        view.extractedTurmas,
        extractTurmaEntriesFromUnstructuredText(view.text),
      )) {
        const title = extractTitleFromRawLine(turmaEntry.rawLine);
        componentStateByCode.set(turmaEntry.componentCode, {
          code: turmaEntry.componentCode,
          title,
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

    if (view.id === "history") {
      historyDocument ??= view.historyDocument ?? null;

      for (const historyEntry of view.extractedHistory) {
        const componentCode =
          extractComponentCode(historyEntry.componentName) ??
          extractComponentCode(historyEntry.rawLine);
        const normalizedTitle = normalizeHistoryComponentTitle(
          historyEntry.componentName,
          componentCode,
        );

        historyEntries.push({
          academicPeriod: historyEntry.academicPeriod,
          componentCode,
          componentName: historyEntry.componentName,
          normalizedTitle,
          gradeValue: historyEntry.gradeValue,
          absences: historyEntry.absences,
          statusText: historyEntry.statusText,
          rawLine: historyEntry.rawLine,
        });

        if (!componentCode) {
          continue;
        }

        const existingComponentState = componentStateByCode.get(componentCode);
        const historyStatus = mapGradeStatusText(historyEntry.statusText);

        if (
          existingComponentState &&
          (existingComponentState.source === "classes" ||
            existingComponentState.source === "grades")
        ) {
          continue;
        }

        componentStateByCode.set(componentCode, {
          code: componentCode,
          title: normalizedTitle,
          status: historyStatus,
          source: "history",
          rawLine: historyEntry.rawLine,
          statusText: historyEntry.statusText,
          scheduleCodes: [],
        });
      }

      continue;
    }

    for (const gradeEntry of mergeGradeEntries(
      view.extractedGrades,
      extractGradeEntriesFromUnstructuredText(view.text),
    )) {
      const existingComponentState = componentStateByCode.get(
        gradeEntry.componentCode,
      );

      if (existingComponentState?.source === "classes") {
        continue;
      }

      componentStateByCode.set(gradeEntry.componentCode, {
        code: gradeEntry.componentCode,
        title: extractTitleFromRawLine(gradeEntry.rawLine),
        status: mapGradeStatusText(gradeEntry.statusText),
        source: "grades",
        rawLine: gradeEntry.rawLine,
        statusText: gradeEntry.statusText,
        scheduleCodes: [],
      });
    }
  }

  if (
    componentStateByCode.size === 0 &&
    scheduleBindings.length === 0 &&
    historyEntries.length === 0 &&
    historyDocument === null &&
    !structuredCapture.portalProfile
  ) {
    return null;
  }

  return {
    studentProfile: structuredCapture.portalProfile
      ? {
          studentNumber: structuredCapture.portalProfile.studentNumber ?? null,
          studentName: structuredCapture.portalProfile.studentName ?? null,
          courseName: structuredCapture.portalProfile.courseName ?? null,
        }
      : null,
    componentStates: Array.from(componentStateByCode.values()).sort(
      (left, right) => left.code.localeCompare(right.code),
    ),
    scheduleBindings: uniqueScheduleBindings(scheduleBindings),
    historyEntries,
    historyDocument,
  };
}

function mapGradeStatusText(
  statusText: string | null,
): AcademicComponentStatus {
  if (!statusText) {
    return "unknown";
  }

  const normalizedStatus = statusText.toUpperCase();

  if (
    normalizedStatus.includes("APROVADO") ||
    normalizedStatus.includes("DISPENSADO") ||
    normalizedStatus.includes("CREDITADO")
  ) {
    return "completed";
  }

  if (
    normalizedStatus.includes("REPROVADO") ||
    normalizedStatus.includes("CANCELADO") ||
    normalizedStatus.includes("TRANCADO") ||
    normalizedStatus.includes("INAPTO")
  ) {
    return "failed";
  }

  if (
    normalizedStatus.includes("CURSANDO") ||
    normalizedStatus.includes("MATRICULADO") ||
    normalizedStatus.includes("EM CURSO") ||
    normalizedStatus.includes("EM ANDAMENTO")
  ) {
    return "inProgress";
  }

  return "unknown";
}

function formatStructuredStatus(
  status: AcademicComponentStatus,
  statusText: string | null,
): string | null {
  if (statusText) {
    return statusText;
  }

  switch (status) {
    case "completed":
      return "APROVADO";
    case "inProgress":
      return "CURSANDO";
    case "failed":
      return "REPROVADO";
    default:
      return null;
  }
}

function extractTitleFromRawLine(rawLine: string): string | null {
  const classTitleMatch = rawLine.match(
    /^[A-Z]{3,5}\d{2,3}\s*-\s*(.+?)(?:\s+-\s+HOR[ÁA]RIO:|\s+LOCAL:|$)/i,
  );

  if (classTitleMatch?.[1]) {
    return classTitleMatch[1].trim();
  }

  const gradeTitleMatch = rawLine.match(
    /^[A-Z]{3,5}\d{2,3}\s+(.+?)(?:\s+(?:--|\d+[,.]?\d*|APROVADO|REPROVADO|CANCELADO|TRANCADO|CURSANDO|MATRICULADO|APTO|INAPTO)\b|$)/i,
  );

  return gradeTitleMatch?.[1]?.trim() ?? null;
}

function extractComponentCode(value: string): string | null {
  const matchedCode = value.match(/\b([A-Z]{3,5}\d{2,3})\b/i)?.[1];

  return matchedCode?.toUpperCase() ?? null;
}

function normalizeHistoryComponentTitle(
  componentName: string,
  componentCode: string | null,
): string | null {
  const trimmedName = componentName.trim();

  if (!componentCode) {
    return trimmedName || null;
  }

  const normalizedName = trimmedName
    .replace(new RegExp(`^${componentCode}\\s+`, "i"), "")
    .trim();

  return normalizedName || trimmedName || null;
}

function extractTurmaEntriesFromUnstructuredText(text: string): Array<{
  componentCode: string;
  scheduleCodes: string[];
  rawLine: string;
}> {
  return extractComponentSegments(
    text,
    /([A-Z]{3,5}\d{2,3})\s*-\s*(.+?)(?=(?:\s+[A-Z]{3,5}\d{2,3}\s*-)|$)/gs,
  ).map((segment) => ({
    componentCode: segment.componentCode,
    scheduleCodes: uniqueValues(
      Array.from(segment.rawLine.matchAll(/\b([2-7]+[MTN]\d{1,4})\b/g))
        .map((match) => match[1])
        .filter((value): value is string => typeof value === "string"),
    ),
    rawLine: segment.rawLine,
  }));
}

function extractGradeEntriesFromUnstructuredText(text: string): Array<{
  componentCode: string;
  statusText: string | null;
  rawLine: string;
}> {
  return extractComponentSegments(
    text,
    /([A-Z]{3,5}\d{2,3})\s+(.+?)(?=(?:\s+[A-Z]{3,5}\d{2,3}\b)|$)/gs,
  ).map((segment) => ({
    componentCode: segment.componentCode,
    statusText:
      segment.rawLine.match(
        /\b(APROVADO|REPROVADO|CANCELADO|TRANCADO|CURSANDO|MATRICULADO|APTO|INAPTO|EM CURSO|EM ANDAMENTO)\b/i,
      )?.[1] ?? null,
    rawLine: segment.rawLine,
  }));
}

function extractComponentSegments(
  text: string,
  pattern: RegExp,
): Array<{
  componentCode: string;
  rawLine: string;
}> {
  const matches = Array.from(text.matchAll(pattern));

  return matches
    .map((match) => {
      const componentCode = match[1]?.trim();
      const rawLine = match[0]
        ?.replace(/\s+/g, " ")
        .replace(/\s+-\s+/g, " - ")
        .trim();

      if (!componentCode || !rawLine) {
        return null;
      }

      return {
        componentCode,
        rawLine,
      };
    })
    .filter((segment): segment is { componentCode: string; rawLine: string } =>
      Boolean(segment),
    );
}

function mergeTurmaEntries(
  primaryEntries: Array<{
    componentCode: string;
    scheduleCodes: string[];
    rawLine: string;
  }>,
  fallbackEntries: Array<{
    componentCode: string;
    scheduleCodes: string[];
    rawLine: string;
  }>,
): Array<{
  componentCode: string;
  scheduleCodes: string[];
  rawLine: string;
}> {
  const mergedByCode = new Map<
    string,
    { componentCode: string; scheduleCodes: string[]; rawLine: string }
  >();

  for (const entry of [...primaryEntries, ...fallbackEntries]) {
    const existing = mergedByCode.get(entry.componentCode);
    if (!existing) {
      mergedByCode.set(entry.componentCode, {
        ...entry,
        scheduleCodes: uniqueValues(entry.scheduleCodes),
      });
      continue;
    }

    existing.scheduleCodes = uniqueValues([
      ...existing.scheduleCodes,
      ...entry.scheduleCodes,
    ]);
    if (!existing.rawLine && entry.rawLine) {
      existing.rawLine = entry.rawLine;
    }
  }

  return Array.from(mergedByCode.values());
}

function mergeGradeEntries(
  primaryEntries: Array<{
    componentCode: string;
    statusText: string | null;
    rawLine: string;
  }>,
  fallbackEntries: Array<{
    componentCode: string;
    statusText: string | null;
    rawLine: string;
  }>,
): Array<{
  componentCode: string;
  statusText: string | null;
  rawLine: string;
}> {
  const mergedByCode = new Map<
    string,
    { componentCode: string; statusText: string | null; rawLine: string }
  >();

  for (const entry of [...primaryEntries, ...fallbackEntries]) {
    const existing = mergedByCode.get(entry.componentCode);
    if (!existing) {
      mergedByCode.set(entry.componentCode, entry);
      continue;
    }

    if (!existing.statusText && entry.statusText) {
      existing.statusText = entry.statusText;
    }
    if (!existing.rawLine && entry.rawLine) {
      existing.rawLine = entry.rawLine;
    }
  }

  return Array.from(mergedByCode.values());
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function uniqueScheduleBindings(
  scheduleBindings: ManualImportStructuredScheduleBinding[],
): ManualImportStructuredScheduleBinding[] {
  const seenBindings = new Set<string>();

  return scheduleBindings.filter((binding) => {
    const key = `${binding.componentCode}:${binding.scheduleCode}`;
    if (seenBindings.has(key)) {
      return false;
    }

    seenBindings.add(key);
    return true;
  });
}
