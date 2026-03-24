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
});
