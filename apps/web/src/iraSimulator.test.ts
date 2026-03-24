import {
  parseIraGradeValue,
  projectIra,
  projectIraFromBaseline,
  simulateIra,
} from "./iraSimulator";

describe("iraSimulator", () => {
  it("calculates a weighted local average using credits and decimal comma grades", () => {
    const result = simulateIra([
      {
        code: "MATA37",
        credits: 4,
        gradeValue: "8,5",
      },
      {
        code: "FIS123",
        credits: 2,
        gradeValue: 7,
      },
    ]);

    expect(result.average).toBeCloseTo(8, 5);
    expect(result.roundedAverage).toBe(8);
    expect(result.consideredWeight).toBe(6);
    expect(result.consideredCount).toBe(2);
    expect(result.ignoredCount).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.consideredEntries).toEqual([
      {
        code: "MATA37",
        title: null,
        gradeValue: 8.5,
        weight: 4,
        weightedPoints: 34,
      },
      {
        code: "FIS123",
        title: null,
        gradeValue: 7,
        weight: 2,
        weightedPoints: 14,
      },
    ]);
  });

  it("ignores entries with missing grade, invalid grade or invalid weight and reports warnings", () => {
    const result = simulateIra([
      {
        code: "MATD01",
        credits: 0,
        gradeValue: 8,
      },
      {
        code: "BIOD01",
        credits: 3,
        gradeValue: null,
      },
      {
        code: "QUI123",
        credits: 4,
        gradeValue: "AP",
      },
      {
        code: "LET001",
        credits: 2,
        gradeValue: 9,
      },
    ]);

    expect(result.average).toBe(9);
    expect(result.roundedAverage).toBe(9);
    expect(result.consideredCount).toBe(1);
    expect(result.ignoredCount).toBe(3);
    expect(result.ignoredEntries).toEqual([
      {
        code: "MATD01",
        title: null,
        reason: "nonPositiveWeight",
        originalGradeValue: 8,
        originalWeight: null,
      },
      {
        code: "BIOD01",
        title: null,
        reason: "missingGrade",
        originalGradeValue: null,
        originalWeight: 3,
      },
      {
        code: "QUI123",
        title: null,
        reason: "invalidGrade",
        originalGradeValue: "AP",
        originalWeight: 4,
      },
    ]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "nonPositiveWeight",
      "missingGrade",
      "invalidGrade",
    ]);
  });

  it("supports workload-based weighting and rejects grades outside the configured range", () => {
    const result = simulateIra(
      [
        {
          code: "HIS100",
          workloadHours: 68,
          gradeValue: 8,
        },
        {
          code: "MAT245",
          workloadHours: 34,
          gradeValue: 11,
        },
      ],
      {
        weightBasis: "workloadHours",
      },
    );

    expect(result.average).toBe(8);
    expect(result.consideredWeight).toBe(68);
    expect(result.consideredCount).toBe(1);
    expect(result.ignoredEntries).toEqual([
      {
        code: "MAT245",
        title: null,
        reason: "gradeOutOfRange",
        originalGradeValue: 11,
        originalWeight: 34,
      },
    ]);
    expect(result.warnings).toEqual([
      {
        code: "gradeOutOfRange",
        entryCode: "MAT245",
        message:
          "A disciplina MAT245 foi ignorada porque a nota ficou fora do intervalo 0..10.",
      },
    ]);
  });

  it("projects a future scenario on top of existing detailed entries", () => {
    const projection = projectIra(
      [
        {
          code: "MATA37",
          credits: 4,
          gradeValue: 7,
        },
        {
          code: "FIS123",
          credits: 4,
          gradeValue: 9,
        },
      ],
      [
        {
          code: "QUI123",
          credits: 2,
          gradeValue: 10,
        },
      ],
    );

    expect(projection.current.average).toBe(8);
    expect(projection.projected.average).toBeCloseTo(8.4, 5);
    expect(projection.roundedDelta).toBe(0.4);
  });

  it("projects from an explicit baseline without inventing historical entries", () => {
    const result = projectIraFromBaseline({
      baselineAverage: "7,25",
      baselineWeight: 20,
      projectedEntries: [
        {
          code: "MATA38",
          credits: 4,
          gradeValue: 9,
        },
        {
          code: "FIS124",
          credits: 2,
          gradeValue: 8,
        },
      ],
    });

    expect(result.baselineAverage).toBe(7.25);
    expect(result.baselineWeight).toBe(20);
    expect(result.projectedAverage).toBeCloseTo(7.5769230769, 5);
    expect(result.roundedProjectedAverage).toBe(7.58);
    expect(result.roundedDelta).toBe(0.33);
    expect(result.scenario.consideredWeight).toBe(6);
    expect(result.warnings).toEqual([]);
  });

  it("returns a null baseline projection when the base data is invalid", () => {
    const result = projectIraFromBaseline({
      baselineAverage: "AP",
      baselineWeight: 0,
      projectedEntries: [
        {
          code: "MATA39",
          credits: 4,
          gradeValue: 8,
        },
      ],
    });

    expect(result.projectedAverage).toBeNull();
    expect(result.roundedProjectedAverage).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.roundedDelta).toBeNull();
    expect(result.scenario.average).toBe(8);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "invalidBaselineAverage",
      "invalidBaselineWeight",
    ]);
  });

  it("parses numeric grades conservatively", () => {
    expect(parseIraGradeValue("8,75")).toBe(8.75);
    expect(parseIraGradeValue(" 6.5 ")).toBe(6.5);
    expect(parseIraGradeValue("APROVADO")).toBeNull();
    expect(parseIraGradeValue("")).toBeNull();
  });
});
