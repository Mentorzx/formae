import { describe, expect, test } from "vitest";
import { buildAutomaticSigaaSyncBundle } from "./automaticSigaaImport";

describe("buildAutomaticSigaaSyncBundle", () => {
  test("projects SIGAA classes and grades into the existing local bundle path", async () => {
    const result = await buildAutomaticSigaaSyncBundle({
      syncSnapshot: {
        syncSessionId: "sync-1",
        source: "dom",
        capturedAt: "2026-03-24T03:20:48.000Z",
        routeHint: "sigaa-mobile:classes+grades",
        retentionMode: "structured-minimized",
        persistedRawInput: [
          "[Minhas Turmas]",
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
          "[Minhas Notas]",
          "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO",
        ].join("\n"),
        structuredContext: {
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
              rawLine:
                "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
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
          historyEntries: [],
          historyDocument: null,
        },
        warnings: [],
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
      historyEntries: [],
      historyDocument: null,
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
      syncSnapshot: {
        syncSessionId: "sync-2",
        source: "dom",
        capturedAt: "2026-03-24T05:20:00.000Z",
        routeHint: "sigaa-mobile:classes+grades",
        retentionMode: "structured-minimized",
        persistedRawInput: [
          "[Minhas Turmas]",
          "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
          "[Minhas Notas]",
          "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
        ].join("\n"),
        structuredContext: {
          studentProfile: {
            studentNumber: "219216387",
            studentName: "Alex de Lira Neto",
            courseName: "Engenharia da Computacao",
          },
          componentStates: [
            {
              code: "ENGC25",
              title: "ANALISE DE CIRCUITOS II",
              status: "inProgress",
              source: "classes",
              rawLine:
                "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
              statusText: null,
              scheduleCodes: ["24N34", "35N34"],
            },
            {
              code: "ENGC41",
              title: "DISPOSITIVOS ELETRÔNICOS",
              status: "inProgress",
              source: "classes",
              rawLine:
                "ENGC25 - ANALISE DE CIRCUITOS II - Horário: 24N34 ENGC41 - DISPOSITIVOS ELETRÔNICOS - Horário: 35N34",
              statusText: null,
              scheduleCodes: ["35N34"],
            },
            {
              code: "ENGC50",
              title: "SISTEMAS MICROPROCESSADOS",
              status: "completed",
              source: "grades",
              rawLine:
                "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
              statusText: "APROVADO",
              scheduleCodes: [],
            },
            {
              code: "ENGC33",
              title: "SINAIS E SISTEMAS II",
              status: "failed",
              source: "grades",
              rawLine:
                "ENGC25 ANALISE DE CIRCUITOS II -- 0 -- ENGC41 DISPOSITIVOS ELETRÔNICOS -- 0 -- ENGC50 SISTEMAS MICROPROCESSADOS 8,9 12 APROVADO ENGC33 SINAIS E SISTEMAS II 3,3 10 REPROVADO",
              statusText: "REPROVADO",
              scheduleCodes: [],
            },
          ],
          scheduleBindings: [
            {
              componentCode: "ENGC25",
              scheduleCode: "24N34",
              source: "classes",
            },
            {
              componentCode: "ENGC25",
              scheduleCode: "35N34",
              source: "classes",
            },
            {
              componentCode: "ENGC41",
              scheduleCode: "35N34",
              source: "classes",
            },
          ],
          historyEntries: [],
          historyDocument: null,
        },
        warnings: [],
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

  test("promotes history-derived component states when they carry a component code", async () => {
    const result = await buildAutomaticSigaaSyncBundle({
      syncSnapshot: {
        syncSessionId: "sync-3",
        source: "dom",
        capturedAt: "2026-03-24T05:35:00.000Z",
        routeHint: "sigaa-mobile:classes+grades+history",
        retentionMode: "structured-minimized",
        persistedRawInput: [
          "[Minhas Turmas]",
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
          "[Consultar Histórico]",
          "2025.2 ENGC50 SISTEMAS MICROPROCESSADOS 10,0 0 APROVADO",
        ].join("\n"),
        structuredContext: {
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
              rawLine:
                "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horário: 35N12",
              statusText: null,
              scheduleCodes: ["35N12"],
            },
            {
              code: "ENGC50",
              title: "SISTEMAS MICROPROCESSADOS",
              status: "completed",
              source: "history",
              rawLine:
                "2025.2 ENGC50 SISTEMAS MICROPROCESSADOS 10,0 0 APROVADO",
              statusText: "APROVADO",
              scheduleCodes: [],
            },
          ],
          scheduleBindings: [
            {
              componentCode: "ENGC63",
              scheduleCode: "35N12",
              source: "classes",
            },
          ],
          historyEntries: [
            {
              academicPeriod: "2025.2",
              componentCode: "ENGC50",
              componentName: "ENGC50 SISTEMAS MICROPROCESSADOS",
              normalizedTitle: "SISTEMAS MICROPROCESSADOS",
              gradeValue: "10,0",
              absences: "0",
              statusText: "APROVADO",
              rawLine:
                "2025.2 ENGC50 SISTEMAS MICROPROCESSADOS 10,0 0 APROVADO",
            },
          ],
          historyDocument: {
            currentUrl:
              "https://sigaa.ufba.br/sigaa/mobile/touch/gerarHistorico",
            title: "Relatório de Notas",
            transportKind: "pdf",
            hasVisibleHistoryText: true,
            hasPdfLikeMarker: true,
            hasAttachmentLikeMarker: false,
            textLength: 58,
            sourceCandidates: [],
            pdfCandidates: [],
            attachmentCandidates: [],
          },
        },
        warnings: [],
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
    expect(result.bundle.manualImport.detectedComponentCodes).toContain(
      "ENGC50",
    );
    expect(
      result.bundle.manualImport.structuredContext?.componentStates,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ENGC63",
          source: "classes",
        }),
        expect.objectContaining({
          code: "ENGC50",
          source: "history",
          status: "completed",
        }),
      ]),
    );
    expect(
      result.bundle.manualImport.structuredContext?.historyEntries,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          academicPeriod: "2025.2",
          componentCode: "ENGC50",
          normalizedTitle: "SISTEMAS MICROPROCESSADOS",
        }),
      ]),
    );
    expect(
      result.bundle.manualImport.structuredContext?.historyDocument
        ?.transportKind,
    ).toBe("pdf");
  });
});
