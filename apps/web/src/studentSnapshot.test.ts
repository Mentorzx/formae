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
    expect(bundle.studentSnapshot.curriculum.curriculumId).toBe(
      "ufba-trilha-base-2026-seed",
    );
    expect(bundle.studentSnapshot.curriculum.name).toBe(
      "Trilha base UFBA seed local",
    );
    expect(bundle.studentSnapshot.curriculum.course).toEqual({
      code: "UFBA-BASE-SEED",
      name: "Trilha base UFBA",
      campus: "Salvador",
      degreeLevel: "undergraduate",
      totalWorkloadHours: 544,
    });
    expect(
      bundle.studentSnapshot.curriculum.components.map(
        (component) => component.code,
      ),
    ).toEqual([
      "LETR01",
      "MATD01",
      "MATA37",
      "QUI101",
      "FIS123",
      "BIOD01",
      "BIOT02",
      "PROJ01",
    ]);
    expect(bundle.studentSnapshot.curriculum.prerequisiteRules).toEqual([
      {
        componentCode: "FIS123",
        expression: "MATA37",
        requiredComponentCodes: ["MATA37"],
      },
      {
        componentCode: "BIOT02",
        expression: "BIOD01",
        requiredComponentCodes: ["BIOD01"],
      },
      {
        componentCode: "PROJ01",
        expression: "MATA37 AND LETR01",
        requiredComponentCodes: ["MATA37", "LETR01"],
      },
    ]);
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
    expect(
      bundle.studentSnapshot.pendingRequirements.map(
        (requirement) => requirement.id,
      ),
    ).toEqual([
      "component-retry:FIS123",
      "prerequisite:BIOT02",
      "prerequisite:PROJ01",
      "component:LETR01",
      "component:MATD01",
      "component:QUI101",
      "component:FIS123",
      "component:BIOT02",
      "component:PROJ01",
    ]);
    expect(bundle.studentSnapshot.pendingRequirements).toEqual(
      expect.arrayContaining([
        {
          id: "component-retry:FIS123",
          title: "Retomar FIS123",
          status: "outstanding",
          details:
            "A importacao manual detectou sinais de reprovacao, cancelamento ou trancamento para este componente.",
          relatedComponentCode: "FIS123",
        },
        {
          id: "prerequisite:BIOT02",
          title: "Liberar Bases de Biologia Celular",
          status: "outstanding",
          details: "Faltam pre-requisitos antes de BIOT02: BIOD01.",
          relatedComponentCode: "BIOT02",
        },
        {
          id: "prerequisite:PROJ01",
          title: "Liberar Projeto Integrador",
          status: "outstanding",
          details: "Faltam pre-requisitos antes de PROJ01: LETR01.",
          relatedComponentCode: "PROJ01",
        },
      ]),
    );
  });

  it("adds a general review requirement when the seed curriculum match is weak", () => {
    const bundle = buildLocalStudentSnapshotBundle({
      derivedAt: "2026-03-24T01:00:00.000Z",
      manualImport: {
        schemaVersion: 1,
        snapshotId: "manual-weak",
        savedAt: "2026-03-24T00:59:00.000Z",
        source: "plain-text",
        timingProfileId: "Ufba2025",
        rawInput: "FIS123 - Fisica I - CURSANDO",
        detectedScheduleCodes: [],
        detectedComponentCodes: ["FIS123"],
        matchedCatalogComponentCodes: [],
        previewWarnings: [],
        normalizedSchedules: [],
      },
      matchedCatalogComponents: [],
    });

    expect(bundle.studentSnapshot.curriculum.curriculumId).toBe(
      "ufba-trilha-base-2026-seed",
    );
    expect(bundle.studentSnapshot.pendingRequirements).toEqual(
      expect.arrayContaining([
        {
          id: "curriculum-seed-review",
          title: "Revisar selecao da grade seed",
          status: "outstanding",
          details: expect.stringMatching(/apenas 1 componente/i),
          relatedComponentCode: null,
        },
      ]),
    );
  });

  it("honors a manually preferred curriculum seed in the projected snapshot", () => {
    const bundle = buildLocalStudentSnapshotBundle({
      derivedAt: "2026-03-24T01:10:00.000Z",
      manualImport: {
        schemaVersion: 1,
        snapshotId: "manual-override",
        savedAt: "2026-03-24T01:09:00.000Z",
        source: "plain-text",
        timingProfileId: "Ufba2025",
        rawInput: [
          "MATA37 - Introducao a Logica de Programacao - APROVADO",
          "BIOD01 - Fundamentos de Anatomia - CURSANDO",
        ].join("\n"),
        detectedScheduleCodes: [],
        detectedComponentCodes: ["BIOD01", "MATA37"],
        preferredCurriculumSeedId: "ufba-trilha-interdisciplinar-2026-seed",
        matchedCatalogComponentCodes: ["BIOD01", "MATA37"],
        previewWarnings: [],
        normalizedSchedules: [],
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

    expect(bundle.studentSnapshot.curriculum.curriculumId).toBe(
      "ufba-trilha-interdisciplinar-2026-seed",
    );
    expect(bundle.studentSnapshot.curriculum.name).toBe(
      "Trilha interdisciplinar UFBA seed local",
    );
    expect(
      bundle.studentSnapshot.pendingRequirements.some(
        (requirement) => requirement.id === "curriculum-seed-review",
      ),
    ).toBe(false);
  });
});
