import type {
  AcademicComponentStatus,
  LocalStudentSnapshotBundle,
  ManualImportNormalizedSchedule,
  ManualImportPreview,
  ManualImportStructuredComponentState,
  ManualImportStructuredContext,
  ManualImportStructuredHistoryEntry,
  ManualImportStructuredScheduleBinding,
  SigaaSyncSnapshotPayload,
  TimingProfileId,
} from "@formae/protocol";
import { createManualImportPreview } from "./manualImport";
import { buildManualImportStoredSnapshot } from "./manualSnapshot";
import { findCatalogMatches } from "./publicCatalog";
import { buildLocalStudentSnapshotBundle } from "./studentSnapshot";
import { normalizeScheduleCodesWithWasm } from "./wasmScheduleParser";

export async function buildAutomaticSigaaSyncBundle(input: {
  syncSnapshot: SigaaSyncSnapshotPayload;
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
    input.syncSnapshot,
  );
  const persistedRawInput =
    buildMinimizedPersistedRawInput(structuredContext) ??
    input.syncSnapshot.persistedRawInput;
  const textPreview = createManualImportPreview({
    source: "sigaa-html",
    rawInput: persistedRawInput,
    capturedAt: input.syncSnapshot.capturedAt,
    timingProfileId: input.timingProfileId,
  });
  const preview = mergeStructuredPreview(
    textPreview,
    structuredContext,
    input.syncSnapshot.warnings,
  );
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
  additionalWarnings: string[] = [],
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
    warnings: uniqueValues([...warnings, ...additionalWarnings]),
  };
}

function buildStructuredManualImportContext(
  syncSnapshot: SigaaSyncSnapshotPayload,
): ManualImportStructuredContext | null {
  const structuredContext = syncSnapshot.structuredContext;

  if (!structuredContext) {
    return null;
  }

  const componentStateByCode = new Map<
    string,
    ManualImportStructuredComponentState
  >();
  const scheduleBindings: ManualImportStructuredScheduleBinding[] = [];
  const historyEntries: ManualImportStructuredHistoryEntry[] = [];
  const historyDocument = structuredContext.historyDocument ?? null;

  for (const componentState of structuredContext.componentStates) {
    componentStateByCode.set(
      `${componentState.code}:${componentState.source}`,
      componentState,
    );
  }

  scheduleBindings.push(...structuredContext.scheduleBindings);
  historyEntries.push(...(structuredContext.historyEntries ?? []));

  if (
    componentStateByCode.size === 0 &&
    scheduleBindings.length === 0 &&
    historyEntries.length === 0 &&
    historyDocument === null &&
    !structuredContext.studentProfile
  ) {
    return null;
  }

  return {
    studentProfile: structuredContext.studentProfile,
    componentStates: Array.from(componentStateByCode.values()).sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.source.localeCompare(right.source),
    ),
    scheduleBindings: uniqueScheduleBindings(scheduleBindings),
    historyEntries,
    historyDocument,
  };
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
