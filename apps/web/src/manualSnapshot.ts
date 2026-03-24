import type {
  ManualImportNormalizedSchedule,
  ManualImportPreview,
  ManualImportSource,
  ManualImportStoredSnapshot,
  TimingProfileId,
} from "@formae/protocol";

interface BuildManualImportSnapshotInput {
  rawInput: string;
  source: ManualImportSource;
  timingProfileId: TimingProfileId;
  preview: ManualImportPreview;
  normalizedSchedules: ManualImportNormalizedSchedule[];
  matchedCatalogComponentCodes: string[];
  savedAt?: string;
  snapshotId?: string;
}

export function buildManualImportStoredSnapshot(
  input: BuildManualImportSnapshotInput,
): ManualImportStoredSnapshot {
  return {
    schemaVersion: 1,
    snapshotId: input.snapshotId ?? generateSnapshotId(),
    savedAt: input.savedAt ?? new Date().toISOString(),
    source: input.source,
    timingProfileId: input.timingProfileId,
    rawInput: input.rawInput,
    detectedScheduleCodes: input.preview.detectedScheduleCodes,
    detectedComponentCodes: input.preview.detectedComponentCodes,
    matchedCatalogComponentCodes: input.matchedCatalogComponentCodes,
    previewWarnings: input.preview.warnings,
    normalizedSchedules: input.normalizedSchedules,
  };
}

function generateSnapshotId(): string {
  if ("crypto" in globalThis && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `manual-${Date.now()}`;
}
