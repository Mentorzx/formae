import type {
  AcademicComponentStatus,
  LocalStudentSnapshotBundle,
  ManualImportNormalizedSchedule,
  ManualImportPreview,
  ManualImportStructuredComponentState,
  ManualImportStructuredContext,
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
  const textPreview = createManualImportPreview({
    source: "sigaa-html",
    rawInput: input.rawPayload.htmlOrText,
    capturedAt: input.rawPayload.capturedAt,
    timingProfileId: input.timingProfileId,
  });
  const structuredContext = buildStructuredManualImportContext(
    input.rawPayload,
  );
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
    rawInput: input.rawPayload.htmlOrText,
    source: "sigaa-html",
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

  for (const view of structuredCapture.views) {
    if (view.id === "classes") {
      for (const turmaEntry of view.extractedTurmas) {
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

    for (const gradeEntry of view.extractedGrades) {
      if (componentStateByCode.has(gradeEntry.componentCode)) {
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
