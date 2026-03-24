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
    expect(result.bundle.studentSnapshot.curriculum.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ENGC63",
        }),
      ]),
    );
  });
});
