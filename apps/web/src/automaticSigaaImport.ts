import type {
  LocalStudentSnapshotBundle,
  ManualImportNormalizedSchedule,
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
  const preview = createManualImportPreview({
    source: "sigaa-html",
    rawInput: input.rawPayload.htmlOrText,
    capturedAt: input.rawPayload.capturedAt,
    timingProfileId: input.timingProfileId,
  });
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
