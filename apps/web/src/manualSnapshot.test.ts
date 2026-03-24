import { buildManualImportStoredSnapshot } from "./manualSnapshot";

describe("buildManualImportStoredSnapshot", () => {
  it("produces a persisted snapshot payload with stable fields", () => {
    const snapshot = buildManualImportStoredSnapshot({
      rawInput: "MATA37 3M23 5T23",
      source: "plain-text",
      timingProfileId: "Ufba2025",
      preview: {
        status: "ready",
        rawLength: 16,
        detectedScheduleCodes: ["3M23", "5T23"],
        detectedComponentCodes: ["MATA37"],
        warnings: [],
        timingProfileId: "Ufba2025",
      },
      normalizedSchedules: [],
      matchedCatalogComponentCodes: ["MATA37"],
      savedAt: "2026-03-23T22:00:00.000Z",
      snapshotId: "snapshot-1",
    });

    expect(snapshot).toEqual({
      schemaVersion: 1,
      snapshotId: "snapshot-1",
      savedAt: "2026-03-23T22:00:00.000Z",
      source: "plain-text",
      retentionMode: "full-raw-text",
      timingProfileId: "Ufba2025",
      rawInput: "MATA37 3M23 5T23",
      detectedScheduleCodes: ["3M23", "5T23"],
      detectedComponentCodes: ["MATA37"],
      preferredCurriculumSeedId: null,
      matchedCatalogComponentCodes: ["MATA37"],
      previewWarnings: [],
      normalizedSchedules: [],
      structuredContext: null,
    });
  });
});
