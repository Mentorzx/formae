import type {
  ManualImportNormalizedSchedule,
  ManualImportPreview,
  ManualImportRetentionMode,
  ManualImportSource,
  ManualImportStoredSnapshot,
  ManualImportStructuredContext,
  TimingProfileId,
} from "@formae/protocol";

interface BuildManualImportSnapshotInput {
  rawInput: string;
  source: ManualImportSource;
  retentionMode?: ManualImportRetentionMode;
  timingProfileId: TimingProfileId;
  preview: ManualImportPreview;
  normalizedSchedules: ManualImportNormalizedSchedule[];
  preferredCurriculumSeedId?: string | null;
  matchedCatalogComponentCodes: string[];
  structuredContext?: ManualImportStructuredContext | null;
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
    retentionMode: input.retentionMode ?? "full-raw-text",
    timingProfileId: input.timingProfileId,
    rawInput: input.rawInput,
    detectedScheduleCodes: input.preview.detectedScheduleCodes,
    detectedComponentCodes: input.preview.detectedComponentCodes,
    preferredCurriculumSeedId: input.preferredCurriculumSeedId ?? null,
    matchedCatalogComponentCodes: input.matchedCatalogComponentCodes,
    previewWarnings: input.preview.warnings,
    normalizedSchedules: input.normalizedSchedules,
    structuredContext: input.structuredContext ?? null,
  };
}

function generateSnapshotId(): string {
  if ("crypto" in globalThis && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `manual-${Date.now()}`;
}
