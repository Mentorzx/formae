export type IraWeightBasis = "credits" | "workloadHours";

export type IraSimulationWarningCode =
  | "missingGrade"
  | "invalidGrade"
  | "gradeOutOfRange"
  | "missingWeight"
  | "nonPositiveWeight"
  | "invalidBaselineAverage"
  | "invalidBaselineWeight";

export interface IraSimulationEntry {
  code: string;
  title?: string | null;
  credits?: number | null;
  workloadHours?: number | null;
  gradeValue?: string | number | null;
}

export interface IraSimulationOptions {
  weightBasis?: IraWeightBasis;
  minGrade?: number;
  maxGrade?: number;
  decimalPlaces?: number;
}

export interface IraSimulationWarning {
  code: IraSimulationWarningCode;
  entryCode: string | null;
  message: string;
}

export interface IraConsideredEntry {
  code: string;
  title: string | null;
  gradeValue: number;
  weight: number;
  weightedPoints: number;
}

export interface IraIgnoredEntry {
  code: string;
  title: string | null;
  reason: IraSimulationWarningCode;
  originalGradeValue: string | number | null;
  originalWeight: number | null;
}

export interface IraSimulationResult {
  weightBasis: IraWeightBasis;
  minGrade: number;
  maxGrade: number;
  average: number | null;
  roundedAverage: number | null;
  consideredWeight: number;
  weightedPoints: number;
  consideredCount: number;
  ignoredCount: number;
  consideredEntries: IraConsideredEntry[];
  ignoredEntries: IraIgnoredEntry[];
  warnings: IraSimulationWarning[];
}

export interface IraProjectionResult {
  current: IraSimulationResult;
  projected: IraSimulationResult;
  delta: number | null;
  roundedDelta: number | null;
}

export interface IraBaselineProjectionInput {
  baselineAverage: string | number | null;
  baselineWeight: number | null;
  projectedEntries: IraSimulationEntry[];
  options?: IraSimulationOptions;
}

export interface IraBaselineProjectionResult {
  baselineAverage: number | null;
  baselineWeight: number;
  projectedAverage: number | null;
  roundedProjectedAverage: number | null;
  delta: number | null;
  roundedDelta: number | null;
  scenario: IraSimulationResult;
  warnings: IraSimulationWarning[];
}

const defaultOptions: Required<IraSimulationOptions> = {
  weightBasis: "credits",
  minGrade: 0,
  maxGrade: 10,
  decimalPlaces: 2,
};

export function parseIraGradeValue(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue || !/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function simulateIra(
  entries: IraSimulationEntry[],
  options?: IraSimulationOptions,
): IraSimulationResult {
  const resolvedOptions = resolveOptions(options);
  const warnings: IraSimulationWarning[] = [];
  const consideredEntries: IraConsideredEntry[] = [];
  const ignoredEntries: IraIgnoredEntry[] = [];

  for (const entry of entries) {
    const weight = getEntryWeight(entry, resolvedOptions.weightBasis);
    const originalGradeValue = entry.gradeValue ?? null;
    const title = entry.title ?? null;

    if (weight === null) {
      const reason =
        entry[resolvedOptions.weightBasis] == null
          ? "missingWeight"
          : "nonPositiveWeight";
      warnings.push(
        buildEntryWarning({
          code: reason,
          entryCode: entry.code,
          weightBasis: resolvedOptions.weightBasis,
        }),
      );
      ignoredEntries.push({
        code: entry.code,
        title,
        reason,
        originalGradeValue,
        originalWeight: null,
      });
      continue;
    }

    if (originalGradeValue == null || originalGradeValue === "") {
      warnings.push(
        buildEntryWarning({
          code: "missingGrade",
          entryCode: entry.code,
          weightBasis: resolvedOptions.weightBasis,
        }),
      );
      ignoredEntries.push({
        code: entry.code,
        title,
        reason: "missingGrade",
        originalGradeValue,
        originalWeight: weight,
      });
      continue;
    }

    const parsedGradeValue = parseIraGradeValue(originalGradeValue);

    if (parsedGradeValue === null) {
      warnings.push(
        buildEntryWarning({
          code: "invalidGrade",
          entryCode: entry.code,
          weightBasis: resolvedOptions.weightBasis,
        }),
      );
      ignoredEntries.push({
        code: entry.code,
        title,
        reason: "invalidGrade",
        originalGradeValue,
        originalWeight: weight,
      });
      continue;
    }

    if (
      parsedGradeValue < resolvedOptions.minGrade ||
      parsedGradeValue > resolvedOptions.maxGrade
    ) {
      warnings.push(
        buildEntryWarning({
          code: "gradeOutOfRange",
          entryCode: entry.code,
          weightBasis: resolvedOptions.weightBasis,
          minGrade: resolvedOptions.minGrade,
          maxGrade: resolvedOptions.maxGrade,
        }),
      );
      ignoredEntries.push({
        code: entry.code,
        title,
        reason: "gradeOutOfRange",
        originalGradeValue,
        originalWeight: weight,
      });
      continue;
    }

    consideredEntries.push({
      code: entry.code,
      title,
      gradeValue: parsedGradeValue,
      weight,
      weightedPoints: parsedGradeValue * weight,
    });
  }

  const consideredWeight = consideredEntries.reduce(
    (total, entry) => total + entry.weight,
    0,
  );
  const weightedPoints = consideredEntries.reduce(
    (total, entry) => total + entry.weightedPoints,
    0,
  );
  const average =
    consideredWeight > 0 ? weightedPoints / consideredWeight : null;

  return {
    weightBasis: resolvedOptions.weightBasis,
    minGrade: resolvedOptions.minGrade,
    maxGrade: resolvedOptions.maxGrade,
    average,
    roundedAverage:
      average === null
        ? null
        : roundValue(average, resolvedOptions.decimalPlaces),
    consideredWeight,
    weightedPoints,
    consideredCount: consideredEntries.length,
    ignoredCount: ignoredEntries.length,
    consideredEntries,
    ignoredEntries,
    warnings,
  };
}

export function projectIra(
  currentEntries: IraSimulationEntry[],
  projectedEntries: IraSimulationEntry[],
  options?: IraSimulationOptions,
): IraProjectionResult {
  const resolvedOptions = resolveOptions(options);
  const current = simulateIra(currentEntries, resolvedOptions);
  const projected = simulateIra(
    currentEntries.concat(projectedEntries),
    resolvedOptions,
  );
  const delta =
    current.average === null || projected.average === null
      ? null
      : projected.average - current.average;

  return {
    current,
    projected,
    delta,
    roundedDelta:
      delta === null ? null : roundValue(delta, resolvedOptions.decimalPlaces),
  };
}

export function projectIraFromBaseline(
  input: IraBaselineProjectionInput,
): IraBaselineProjectionResult {
  const resolvedOptions = resolveOptions(input.options);
  const scenario = simulateIra(input.projectedEntries, resolvedOptions);
  const warnings = [...scenario.warnings];
  const baselineAverage = parseIraGradeValue(input.baselineAverage);
  const baselineWeight = normalizePositiveNumber(input.baselineWeight);

  if (
    baselineAverage === null ||
    baselineAverage < resolvedOptions.minGrade ||
    baselineAverage > resolvedOptions.maxGrade
  ) {
    warnings.push({
      code: "invalidBaselineAverage",
      entryCode: null,
      message: `A media base precisa estar entre ${resolvedOptions.minGrade} e ${resolvedOptions.maxGrade}.`,
    });
  }

  if (baselineWeight === null) {
    warnings.push({
      code: "invalidBaselineWeight",
      entryCode: null,
      message: `O peso base precisa ser positivo para a base ${resolvedOptions.weightBasis}.`,
    });
  }

  if (
    baselineAverage === null ||
    baselineAverage < resolvedOptions.minGrade ||
    baselineAverage > resolvedOptions.maxGrade ||
    baselineWeight === null
  ) {
    return {
      baselineAverage: null,
      baselineWeight: 0,
      projectedAverage: null,
      roundedProjectedAverage: null,
      delta: null,
      roundedDelta: null,
      scenario,
      warnings,
    };
  }

  const projectedWeight = baselineWeight + scenario.consideredWeight;
  const projectedAverage =
    projectedWeight === 0
      ? baselineAverage
      : (baselineAverage * baselineWeight + scenario.weightedPoints) /
        projectedWeight;
  const delta = projectedAverage - baselineAverage;

  return {
    baselineAverage,
    baselineWeight,
    projectedAverage,
    roundedProjectedAverage: roundValue(
      projectedAverage,
      resolvedOptions.decimalPlaces,
    ),
    delta,
    roundedDelta: roundValue(delta, resolvedOptions.decimalPlaces),
    scenario,
    warnings,
  };
}

function resolveOptions(
  options?: IraSimulationOptions,
): Required<IraSimulationOptions> {
  return {
    weightBasis: options?.weightBasis ?? defaultOptions.weightBasis,
    minGrade: options?.minGrade ?? defaultOptions.minGrade,
    maxGrade: options?.maxGrade ?? defaultOptions.maxGrade,
    decimalPlaces: options?.decimalPlaces ?? defaultOptions.decimalPlaces,
  };
}

function getEntryWeight(
  entry: IraSimulationEntry,
  weightBasis: IraWeightBasis,
): number | null {
  const originalWeight = entry[weightBasis];

  return normalizePositiveNumber(originalWeight);
}

function normalizePositiveNumber(
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function buildEntryWarning(input: {
  code: IraSimulationWarningCode;
  entryCode: string;
  weightBasis: IraWeightBasis;
  minGrade?: number;
  maxGrade?: number;
}): IraSimulationWarning {
  switch (input.code) {
    case "missingGrade":
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada porque nao tem nota informada.`,
      };
    case "invalidGrade":
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada porque a nota nao e numerica.`,
      };
    case "gradeOutOfRange":
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada porque a nota ficou fora do intervalo ${input.minGrade}..${input.maxGrade}.`,
      };
    case "missingWeight":
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada porque nao informa ${input.weightBasis}.`,
      };
    case "nonPositiveWeight":
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada porque ${input.weightBasis} nao e positivo.`,
      };
    default:
      return {
        code: input.code,
        entryCode: input.entryCode,
        message: `A disciplina ${input.entryCode} foi ignorada pelo simulador local.`,
      };
  }
}

function roundValue(value: number, decimalPlaces: number): number {
  const safeDecimalPlaces = Math.max(Math.trunc(decimalPlaces), 0);
  const multiplier = 10 ** safeDecimalPlaces;

  return Math.round(value * multiplier) / multiplier;
}
