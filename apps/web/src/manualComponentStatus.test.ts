import { inferManualComponentStatuses } from "./manualComponentStatus";

describe("inferManualComponentStatuses", () => {
  it("classifies completed, in-progress and failed components from manual text", () => {
    const result = inferManualComponentStatuses(
      [
        "MATA37 - Introducao a Logica de Programacao - APROVADO",
        "BIOD01 - Fundamentos de Anatomia - CURSANDO - 35N12",
        "FIS123 - Fisica I - REPROVADO",
      ].join("\n"),
      ["MATA37", "BIOD01", "FIS123"],
    );

    expect(result).toEqual([
      {
        code: "MATA37",
        evidence: [
          {
            matchedKeyword: "APROVADO",
            sourceLine:
              "MATA37 - Introducao a Logica de Programacao - APROVADO",
            status: "completed",
          },
        ],
        hasConflictingSignals: false,
        status: "completed",
      },
      {
        code: "BIOD01",
        evidence: [
          {
            matchedKeyword: "CURSANDO",
            sourceLine: "BIOD01 - Fundamentos de Anatomia - CURSANDO - 35N12",
            status: "inProgress",
          },
        ],
        hasConflictingSignals: false,
        status: "inProgress",
      },
      {
        code: "FIS123",
        evidence: [
          {
            matchedKeyword: "REPROVADO",
            sourceLine: "FIS123 - Fisica I - REPROVADO",
            status: "failed",
          },
        ],
        hasConflictingSignals: false,
        status: "failed",
      },
    ]);
  });

  it("falls back to schedule presence and flags conflicting signals", () => {
    const result = inferManualComponentStatuses(
      [
        "MATD01 - Oficina de Estudos - 24M12",
        "MATD01 - Oficina de Estudos - APROVADO",
      ].join("\n"),
      ["MATD01"],
    );

    expect(result).toEqual([
      {
        code: "MATD01",
        evidence: [
          {
            matchedKeyword: "schedule-code",
            sourceLine: "MATD01 - Oficina de Estudos - 24M12",
            status: "inProgress",
          },
          {
            matchedKeyword: "APROVADO",
            sourceLine: "MATD01 - Oficina de Estudos - APROVADO",
            status: "completed",
          },
        ],
        hasConflictingSignals: true,
        status: "completed",
      },
    ]);
  });

  it("does not mark every component as in-progress when a shared line has multiple codes", () => {
    const result = inferManualComponentStatuses("MATA37 FIS123 35N12", [
      "MATA37",
      "FIS123",
    ]);

    expect(result).toEqual([
      {
        code: "MATA37",
        evidence: [
          {
            matchedKeyword: null,
            sourceLine: "MATA37 FIS123 35N12",
            status: "unknown",
          },
        ],
        hasConflictingSignals: false,
        status: "unknown",
      },
      {
        code: "FIS123",
        evidence: [
          {
            matchedKeyword: null,
            sourceLine: "MATA37 FIS123 35N12",
            status: "unknown",
          },
        ],
        hasConflictingSignals: false,
        status: "unknown",
      },
    ]);
  });
});
