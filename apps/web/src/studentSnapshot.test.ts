import { buildLocalStudentSnapshotBundle } from "./studentSnapshot";

describe("buildLocalStudentSnapshotBundle", () => {
  it("projects a manual import into a minimal student snapshot", () => {
    const bundle = buildLocalStudentSnapshotBundle({
      derivedAt: "2026-03-23T23:00:00.000Z",
      manualImport: {
        schemaVersion: 1,
        snapshotId: "manual-1",
        savedAt: "2026-03-23T22:58:00.000Z",
        source: "plain-text",
        timingProfileId: "Ufba2025",
        rawInput: "MATA37 35N12 FIS123",
        detectedScheduleCodes: ["35N12"],
        detectedComponentCodes: ["FIS123", "MATA37"],
        matchedCatalogComponentCodes: ["MATA37"],
        previewWarnings: ["Trecho parcial importado manualmente."],
        normalizedSchedules: [
          {
            inputCode: "35N12",
            parser: "rust-wasm",
            result: {
              rawCode: "35N12",
              normalizedCode: "35N12",
              canonicalCode: "35N12",
              meetings: [
                {
                  day: "tuesday",
                  turn: "night",
                  slotStart: 1,
                  slotEnd: 2,
                  startTime: { hour: 18, minute: 30 },
                  endTime: { hour: 20, minute: 20 },
                  sourceSegment: "35N12",
                },
              ],
              warnings: [],
              profileId: "Ufba2025",
            },
          },
        ],
      },
      matchedCatalogComponents: [
        {
          code: "MATA37",
          title: "Introducao a Logica de Programacao",
          sourceId: "sigaa-public",
          scheduleCode: "35N12",
          canonicalScheduleCode: "35N12",
          summary: "Disciplina seed",
        },
      ],
    });

    expect(
      bundle.studentSnapshot.inProgressComponents.map(
        (component) => component.code,
      ),
    ).toEqual(["FIS123", "MATA37"]);
    expect(bundle.studentSnapshot.scheduleBlocks).toEqual([
      {
        componentCode: "MATA37",
        rawCode: "35N12",
        canonicalCode: "35N12",
        meetings: [
          {
            day: "tuesday",
            turn: "night",
            slotStart: 1,
            slotEnd: 2,
            startTime: { hour: 18, minute: 30 },
            endTime: { hour: 20, minute: 20 },
            sourceSegment: "35N12",
          },
        ],
      },
    ]);
    expect(bundle.studentSnapshot.pendingRequirements).toEqual([
      {
        id: "catalog-match:FIS123",
        title: "Validar FIS123 no catalogo publico",
        status: "outstanding",
        details:
          "O codigo foi detectado na importacao manual, mas ainda nao existe correspondencia no catalogo seed local.",
        relatedComponentCode: "FIS123",
      },
      {
        id: "manual-import-review",
        title: "Revisar warnings da importacao manual",
        status: "outstanding",
        details: "Trecho parcial importado manualmente.",
        relatedComponentCode: null,
      },
    ]);
  });
});
