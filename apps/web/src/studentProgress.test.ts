import { summarizeStudentProgress } from "./studentProgress";

describe("summarizeStudentProgress", () => {
  it("summarizes local progress, catalog matches and grouped pending requirements", () => {
    const summary = summarizeStudentProgress({
      schemaVersion: 1,
      source: "manual-import",
      derivedAt: "2026-03-24T00:00:00.000Z",
      manualImport: {
        schemaVersion: 1,
        snapshotId: "manual-1",
        savedAt: "2026-03-23T23:55:00.000Z",
        source: "plain-text",
        timingProfileId: "Ufba2025",
        rawInput: "MATA37 FIS123 35N12",
        detectedScheduleCodes: ["35N12"],
        detectedComponentCodes: ["FIS123", "MATA37"],
        matchedCatalogComponentCodes: ["MATA37"],
        previewWarnings: [],
        normalizedSchedules: [],
      },
      studentSnapshot: {
        schemaVersion: 1,
        generatedAt: "2026-03-24T00:00:00.000Z",
        studentNumber: "manual-import",
        studentName: "Snapshot local provisorio",
        curriculum: {
          curriculumId: "manual-1",
          name: "Curriculo provisorio",
          course: {
            code: "UFBA-MANUAL",
            name: "Curso UFBA provisorio",
            campus: "UFBA",
            degreeLevel: "unknown",
            totalWorkloadHours: 0,
          },
          components: [
            {
              code: "FIS123",
              title: "Componente detectado manualmente (FIS123)",
              credits: 0,
              workloadHours: 0,
              componentType: "manual-detected",
            },
            {
              code: "MATA37",
              title: "Introducao a Logica de Programacao",
              credits: 0,
              workloadHours: 0,
              componentType: "catalog-seed",
            },
          ],
          prerequisiteRules: [],
          equivalences: [],
        },
        completedComponents: [],
        inProgressComponents: [
          {
            code: "FIS123",
            title: "Componente detectado manualmente (FIS123)",
            credits: 0,
            workloadHours: 0,
            componentType: "manual-detected",
          },
          {
            code: "MATA37",
            title: "Introducao a Logica de Programacao",
            credits: 0,
            workloadHours: 0,
            componentType: "catalog-seed",
          },
        ],
        scheduleBlocks: [
          {
            componentCode: "MATA37",
            rawCode: "35N12",
            canonicalCode: "35N12",
            meetings: [],
          },
          {
            componentCode: null,
            rawCode: "24M12",
            canonicalCode: "24M12",
            meetings: [],
          },
        ],
        pendingRequirements: [
          {
            id: "catalog-match:FIS123",
            title: "Validar FIS123 no catalogo publico",
            status: "outstanding",
            details: "Sem match no catalogo.",
            relatedComponentCode: "FIS123",
          },
          {
            id: "schedule-binding:24M12",
            title: "Vincular horario 24M12 a um componente",
            status: "outstanding",
            details: "Horario sem vinculo.",
            relatedComponentCode: null,
          },
        ],
        issuedDocuments: [],
      },
    });

    expect(summary.componentCount).toBe(2);
    expect(summary.matchedCatalogCount).toBe(1);
    expect(summary.resolvedComponentCount).toBe(1);
    expect(summary.resolvedComponentPercent).toBe(50);
    expect(summary.boundScheduleBlockCount).toBe(1);
    expect(summary.unboundScheduleBlockCount).toBe(1);
    expect(summary.generalPendingRequirements).toEqual([
      {
        id: "schedule-binding:24M12",
        title: "Vincular horario 24M12 a um componente",
        status: "outstanding",
        details: "Horario sem vinculo.",
        relatedComponentCode: null,
      },
    ]);
    expect(summary.componentItems).toEqual([
      {
        code: "FIS123",
        title: "Componente detectado manualmente (FIS123)",
        hasCatalogMatch: false,
        scheduleBlockCount: 0,
        pendingRequirements: [
          {
            id: "catalog-match:FIS123",
            title: "Validar FIS123 no catalogo publico",
            status: "outstanding",
            details: "Sem match no catalogo.",
            relatedComponentCode: "FIS123",
          },
        ],
        status: "review",
      },
      {
        code: "MATA37",
        title: "Introducao a Logica de Programacao",
        hasCatalogMatch: true,
        scheduleBlockCount: 1,
        pendingRequirements: [],
        status: "ready",
      },
    ]);
  });
});
