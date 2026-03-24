import { buildLocalStudentSnapshotBundle } from "./studentSnapshot";

describe("buildLocalStudentSnapshotBundle", () => {
  it("projects a manual import into a student snapshot with academic status inference", () => {
    const bundle = buildLocalStudentSnapshotBundle({
      derivedAt: "2026-03-23T23:00:00.000Z",
      manualImport: {
        schemaVersion: 1,
        snapshotId: "manual-1",
        savedAt: "2026-03-23T22:58:00.000Z",
        source: "plain-text",
        timingProfileId: "Ufba2025",
        rawInput: [
          "MATA37 - Introducao a Logica de Programacao - APROVADO",
          "BIOD01 - Fundamentos de Anatomia - CURSANDO - 35N12",
          "FIS123 - Fisica I - REPROVADO",
        ].join("\n"),
        detectedScheduleCodes: ["35N12"],
        detectedComponentCodes: ["BIOD01", "FIS123", "MATA37"],
        matchedCatalogComponentCodes: ["BIOD01", "MATA37"],
        previewWarnings: [],
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
          code: "BIOD01",
          title: "Fundamentos de Anatomia",
          sourceId: "sigaa-public",
          scheduleCode: "35N12",
          canonicalScheduleCode: "35N12",
          summary: "Disciplina seed",
        },
        {
          code: "MATA37",
          title: "Introducao a Logica de Programacao",
          sourceId: "sigaa-public",
          scheduleCode: "3M23 5T23",
          canonicalScheduleCode: "3M23 5T23",
          summary: "Disciplina seed",
        },
      ],
    });

    expect(
      bundle.studentSnapshot.completedComponents.map(
        (component) => component.code,
      ),
    ).toEqual(["MATA37"]);
    expect(
      bundle.studentSnapshot.inProgressComponents.map(
        (component) => component.code,
      ),
    ).toEqual(["BIOD01"]);
    expect(bundle.studentSnapshot.scheduleBlocks).toEqual([
      {
        componentCode: "BIOD01",
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
        id: "component-retry:FIS123",
        title: "Retomar FIS123",
        status: "outstanding",
        details:
          "A importacao manual detectou sinais de reprovacao, cancelamento ou trancamento para este componente.",
        relatedComponentCode: "FIS123",
      },
      {
        id: "component:FIS123",
        title: "Concluir Componente detectado manualmente (FIS123)",
        status: "outstanding",
        details: "Componente ainda nao concluido nem em andamento: FIS123",
        relatedComponentCode: "FIS123",
      },
    ]);
  });
});
