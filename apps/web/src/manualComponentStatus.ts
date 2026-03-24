const componentCodePattern = /\b[A-Z]{3,5}\d{2,3}\b/g;
const scheduleCodePattern = /\b[2-7]+[MTN][1-9]+\b/;
const completedKeywordPattern =
  /\b(APROVAD[OA]?|APROVACAO|DISPENSAD[OA]?|CREDITAD[OA]?|CONCLUID[OA]?|CUMPRID[OA]?)\b/;
const inProgressKeywordPattern =
  /\b(CURSANDO|MATRICULAD[OA]?|MATRICULA|EM CURSO|ANDAMENTO|INSCRIT[OA]?)\b/;
const failedKeywordPattern =
  /\b(REPROVAD[OA]?|REPROVACAO|TRANCAD[OA]?|CANCELAD[OA]?|ABANDONAD[OA]?)\b/;

export type ManualDetectedComponentStatus =
  | "completed"
  | "inProgress"
  | "failed"
  | "unknown";

interface ManualDetectedComponentEvidence {
  matchedKeyword: string | null;
  sourceLine: string;
  status: ManualDetectedComponentStatus;
}

export interface ManualDetectedComponentInference {
  code: string;
  evidence: ManualDetectedComponentEvidence[];
  hasConflictingSignals: boolean;
  status: ManualDetectedComponentStatus;
}

export function inferManualComponentStatuses(
  rawInput: string,
  detectedComponentCodes: string[],
): ManualDetectedComponentInference[] {
  const lines = splitInputIntoLines(rawInput);
  const evidenceByCode = new Map<string, ManualDetectedComponentEvidence[]>();

  for (const componentCode of detectedComponentCodes) {
    evidenceByCode.set(componentCode, []);
  }

  for (const line of lines) {
    const normalizedLine = line.toUpperCase();
    const lineComponentCodes = normalizedLine.match(componentCodePattern) ?? [];

    if (lineComponentCodes.length === 0) {
      continue;
    }

    const lineStatus = inferLineStatus(
      normalizedLine,
      lineComponentCodes.length,
    );

    for (const componentCode of lineComponentCodes) {
      const currentEvidence = evidenceByCode.get(componentCode);

      if (!currentEvidence) {
        continue;
      }

      currentEvidence.push({
        matchedKeyword: lineStatus.matchedKeyword,
        sourceLine: line,
        status: lineStatus.status,
      });
    }
  }

  return detectedComponentCodes.map((componentCode) => {
    const evidence = evidenceByCode.get(componentCode) ?? [];
    const resolvedStatus = resolveComponentStatus(evidence);
    const distinctStatuses = new Set(evidence.map((item) => item.status));

    return {
      code: componentCode,
      evidence,
      hasConflictingSignals: distinctStatuses.size > 1,
      status: resolvedStatus,
    };
  });
}

function splitInputIntoLines(rawInput: string): string[] {
  return rawInput
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferLineStatus(
  line: string,
  lineComponentCount: number,
): {
  matchedKeyword: string | null;
  status: ManualDetectedComponentStatus;
} {
  const completedKeyword = line.match(completedKeywordPattern)?.[0] ?? null;
  const inProgressKeyword = line.match(inProgressKeywordPattern)?.[0] ?? null;
  const failedKeyword = line.match(failedKeywordPattern)?.[0] ?? null;

  if (completedKeyword && !failedKeyword) {
    return {
      matchedKeyword: completedKeyword,
      status: "completed",
    };
  }

  if (failedKeyword && !completedKeyword) {
    return {
      matchedKeyword: failedKeyword,
      status: "failed",
    };
  }

  if (inProgressKeyword) {
    return {
      matchedKeyword: inProgressKeyword,
      status: "inProgress",
    };
  }

  if (lineComponentCount === 1 && scheduleCodePattern.test(line)) {
    return {
      matchedKeyword: "schedule-code",
      status: "inProgress",
    };
  }

  return {
    matchedKeyword: null,
    status: "unknown",
  };
}

function resolveComponentStatus(
  evidence: ManualDetectedComponentEvidence[],
): ManualDetectedComponentStatus {
  const statuses = new Set(evidence.map((item) => item.status));

  if (statuses.has("completed")) {
    return "completed";
  }

  if (statuses.has("inProgress")) {
    return "inProgress";
  }

  if (statuses.has("failed")) {
    return "failed";
  }

  return "unknown";
}
