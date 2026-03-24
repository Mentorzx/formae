import { createManualImportPreview } from "./manualImport";

describe("createManualImportPreview", () => {
  it("extracts schedule and component codes from raw text", () => {
    const preview = createManualImportPreview({
      source: "plain-text",
      rawInput: "MATA37 - Introducao a Logica de Programacao - 3M23 5T23",
      capturedAt: "2026-03-23T21:20:00Z",
      timingProfileId: "Ufba2025",
    });

    expect(preview.status).toBe("ready");
    expect(preview.detectedComponentCodes).toEqual(["MATA37"]);
    expect(preview.detectedScheduleCodes).toEqual(["3M23", "5T23"]);
    expect(preview.warnings).toEqual([]);
  });

  it("accepts component codes with three trailing digits", () => {
    const preview = createManualImportPreview({
      source: "plain-text",
      rawInput: "FIS123 - Fisica I - REPROVADO",
      capturedAt: "2026-03-23T21:20:00Z",
      timingProfileId: "Ufba2025",
    });

    expect(preview.detectedComponentCodes).toEqual(["FIS123"]);
  });

  it("returns an idle preview when input is empty", () => {
    const preview = createManualImportPreview({
      source: "plain-text",
      rawInput: "   ",
      capturedAt: "2026-03-23T21:20:00Z",
      timingProfileId: "Ufba2025",
    });

    expect(preview.status).toBe("idle");
    expect(preview.rawLength).toBe(0);
    expect(preview.warnings[0]).toMatch(/Cole um trecho/);
  });
});
