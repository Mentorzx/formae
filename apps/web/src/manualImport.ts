import type { ManualImportDraft, ManualImportPreview } from "@formae/protocol";

const scheduleCodePattern = /\b[2-7]+[MTN][1-9]+\b/g;
const componentCodePattern = /\b[A-Z]{3,5}\d{2}\b/g;

export function createManualImportPreview(
  draft: ManualImportDraft,
): ManualImportPreview {
  const rawInput = draft.rawInput.trim();

  if (!rawInput) {
    return {
      status: "idle",
      rawLength: 0,
      detectedScheduleCodes: [],
      detectedComponentCodes: [],
      warnings: [
        "Cole um trecho exportado do SIGAA ou um texto equivalente para gerar a previa.",
      ],
      timingProfileId: draft.timingProfileId,
    };
  }

  const normalized = rawInput.toUpperCase();
  const detectedScheduleCodes = collectUniqueMatches(
    normalized,
    scheduleCodePattern,
  );
  const detectedComponentCodes = collectUniqueMatches(
    normalized,
    componentCodePattern,
  );
  const warnings: string[] = [];

  if (detectedScheduleCodes.length === 0) {
    warnings.push("Nenhum codigo de horario foi detectado no texto informado.");
  }

  if (detectedComponentCodes.length === 0) {
    warnings.push(
      "Nenhum codigo de componente foi detectado no texto informado.",
    );
  }

  return {
    status: "ready",
    rawLength: rawInput.length,
    detectedScheduleCodes,
    detectedComponentCodes,
    warnings,
    timingProfileId: draft.timingProfileId,
  };
}

function collectUniqueMatches(input: string, pattern: RegExp): string[] {
  const matches = input.match(pattern) ?? [];
  return [...new Set(matches)];
}
