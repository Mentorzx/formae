import { describe, expect, test } from "vitest";
import { buildAutomaticSigaaSyncBundle } from "./automaticSigaaImport";

describe("buildAutomaticSigaaSyncBundle", () => {
  test("projects SIGAA classes and grades into the existing local bundle path", async () => {
    const result = await buildAutomaticSigaaSyncBundle({
      rawPayload: {
        syncSessionId: "sync-1",
        source: "dom",
        capturedAt: "2026-03-24T03:20:48.000Z",
        routeHint: "sigaa-mobile:classes+grades",
        htmlOrText: [
          "[Minhas Turmas]",
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
          "[Minhas Notas]",
          "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO",
        ].join("\n"),
        structuredCapture: {
          schemaVersion: 1,
          portalProfile: {
            studentNumber: "219216387",
            studentName: "Alex de Lira Neto",
            courseName: "Engenharia da Computacao",
          },
          views: [
            {
              id: "classes",
              label: "Minhas Turmas",
              routeHint: "sigaa-mobile:classes",
              text: "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
              extractedTurmas: [
                {
                  componentCode: "ENGC63",
                  scheduleCodes: ["35N12"],
                  rawLine:
                    "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
                },
              ],
            },
            {
              id: "grades",
              label: "Minhas Notas",
              routeHint: "sigaa-mobile:grades",
              text: "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO",
              extractedGrades: [
                {
                  componentCode: "ENGC63",
                  statusText: "APROVADO",
                  rawLine: "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO",
                },
              ],
            },
          ],
        },
      },
      timingProfileId: "Ufba2025",
      normalizeSchedules: async (scheduleCodes) =>
        scheduleCodes.map((scheduleCode) => ({
          inputCode: scheduleCode,
          parser: "rust-wasm",
          result: {
            rawCode: scheduleCode,
            normalizedCode: scheduleCode,
            canonicalCode: scheduleCode,
            meetings: [],
            warnings: [],
            profileId: "Ufba2025",
          },
        })),
    });

    expect(result.bundle.manualImport.source).toBe("sigaa-html");
    expect(result.bundle.manualImport.retentionMode).toBe(
      "structured-minimized",
    );
    expect(result.bundle.manualImport.rawInput).toContain(
      "[Resumo minimizado]",
    );
    expect(result.bundle.manualImport.rawInput).not.toContain(
      "Alex de Lira Neto",
    );
    expect(result.bundle.source).toBe("automatic-sigaa-sync");
    expect(result.bundle.manualImport.detectedComponentCodes).toContain(
      "ENGC63",
    );
    expect(result.bundle.manualImport.detectedScheduleCodes).toContain("35N12");
    expect(result.bundle.manualImport.structuredContext).toEqual({
      studentProfile: {
        studentNumber: "219216387",
        studentName: "Alex de Lira Neto",
        courseName: "Engenharia da Computacao",
      },
      componentStates: [
        {
          code: "ENGC63",
          title: "PROCESSAMENTO DIGITAL DE SINAIS",
          status: "inProgress",
          source: "classes",
          rawLine: "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
          statusText: null,
          scheduleCodes: ["35N12"],
        },
      ],
      scheduleBindings: [
        {
          componentCode: "ENGC63",
          scheduleCode: "35N12",
          source: "classes",
        },
      ],
    });
    expect(result.bundle.studentSnapshot.studentNumber).toBe("219216387");
    expect(result.bundle.studentSnapshot.studentName).toBe("Alex de Lira Neto");
    expect(result.bundle.studentSnapshot.curriculum.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ENGC63",
        }),
      ]),
    );
  });

  test("recovers multiple component states from collapsed classes and grades text", async () => {
    const result = await buildAutomaticSigaaSyncBundle({
      rawPayload: {
        syncSessionId: "sync-2",
        source: "dom",
        capturedAt: "2026-03-24T05:20:00.000Z",
        routeHint: "sigaa-mobile:classes+grades",
        htmlOrText: [
          "[Minhas Turmas]",
          "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
          "[Minhas Notas]",
          "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
        ].join("\n"),
        structuredCapture: {
          schemaVersion: 1,
          portalProfile: {
            studentNumber: "219216387",
            studentName: "Alex de Lira Neto",
            courseName: "Engenharia da Computacao",
          },
          views: [
            {
              id: "classes",
              label: "Minhas Turmas",
              routeHint: "sigaa-mobile:classes",
              text: "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
              extractedTurmas: [
                {
                  componentCode: "ENGC25",
                  scheduleCodes: ["24N34", "35N34"],
                  rawLine:
                    "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
                },
              ],
            },
            {
              id: "grades",
              label: "Minhas Notas",
              routeHint: "sigaa-mobile:grades",
              text: "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
              extractedGrades: [
                {
                  componentCode: "ENGC25",
                  statusText: null,
                  rawLine:
                    "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
                },
              ],
            },
          ],
        },
      },
      timingProfileId: "Ufba2025",
      normalizeSchedules: async (scheduleCodes) =>
        scheduleCodes.map((scheduleCode) => ({
          inputCode: scheduleCode,
          parser: "rust-wasm",
          result: {
            rawCode: scheduleCode,
            normalizedCode: scheduleCode,
            canonicalCode: scheduleCode,
            meetings: [],
            warnings: [],
            profileId: "Ufba2025",
          },
        })),
    });

    expect(result.bundle.manualImport.detectedComponentCodes).toEqual(
      expect.arrayContaining(["ENGC25", "ENGC41", "ENGC50", "ENGC33"]),
    );
    expect(result.bundle.manualImport.detectedScheduleCodes).toEqual(
      expect.arrayContaining(["24N34", "35N34"]),
    );
    expect(
      result.bundle.manualImport.structuredContext?.componentStates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ENGC25",
          source: "classes",
          status: "inProgress",
        }),
        expect.objectContaining({
          code: "ENGC41",
          source: "classes",
          status: "inProgress",
        }),
        expect.objectContaining({
          code: "ENGC50",
          source: "grades",
          status: "completed",
        }),
        expect.objectContaining({
          code: "ENGC33",
          source: "grades",
          status: "failed",
        }),
      ]),
    );
    expect(result.bundle.manualImport.rawInput).toContain("ENGC50");
    expect(result.bundle.manualImport.rawInput).toContain("APROVADO");
    expect(result.bundle.studentSnapshot.curriculum.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ENGC25" }),
        expect.objectContaining({ code: "ENGC41" }),
        expect.objectContaining({ code: "ENGC50" }),
        expect.objectContaining({ code: "ENGC33" }),
      ]),
    );
  });

  test("ignores optional history capture views without breaking the sync bundle", async () => {
    const result = await buildAutomaticSigaaSyncBundle({
      rawPayload: {
        syncSessionId: "sync-3",
        source: "dom",
        capturedAt: "2026-03-24T05:35:00.000Z",
        routeHint: "sigaa-mobile:classes+grades+history",
        htmlOrText: [
          "[Minhas Turmas]",
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
          "[Consultar Histórico]",
          "2025.2 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO",
        ].join("\n"),
        structuredCapture: {
          schemaVersion: 1,
          portalProfile: {
            studentNumber: "219216387",
            studentName: "Alex de Lira Neto",
            courseName: "Engenharia da Computacao",
          },
          views: [
            {
              id: "classes",
              label: "Minhas Turmas",
              routeHint: "sigaa-mobile:classes",
              text: "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
              extractedTurmas: [
                {
                  componentCode: "ENGC63",
                  scheduleCodes: ["35N12"],
                  rawLine:
                    "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
                },
              ],
            },
            {
              id: "history",
              label: "Consultar Histórico",
              routeHint: "sigaa-mobile:history",
              text: "2025.2 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO",
              extractedHistory: [
                {
                  academicPeriod: "2025.2",
                  componentName: "PROCESSAMENTO DIGITAL DE SINAIS",
                  gradeValue: "10,0",
                  absences: "0",
                  statusText: "APROVADO",
                  rawLine:
                    "2025.2 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO",
                },
              ],
            },
          ],
        },
      },
      timingProfileId: "Ufba2025",
      normalizeSchedules: async (scheduleCodes) =>
        scheduleCodes.map((scheduleCode) => ({
          inputCode: scheduleCode,
          parser: "rust-wasm",
          result: {
            rawCode: scheduleCode,
            normalizedCode: scheduleCode,
            canonicalCode: scheduleCode,
            meetings: [],
            warnings: [],
            profileId: "Ufba2025",
          },
        })),
    });

    expect(result.bundle.manualImport.detectedComponentCodes).toContain(
      "ENGC63",
    );
    expect(
      result.bundle.manualImport.structuredContext?.componentStates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ENGC63",
          source: "classes",
        }),
      ]),
    );
  });
});
