import type {
  AcademicComponentStatus,
  Component,
  LocalStudentSnapshotBundle,
  ManualImportStoredSnapshot,
  ManualImportStructuredComponentState,
  PendingRequirement,
  PrerequisiteRule,
  ScheduleBlock,
  StudentSnapshot,
} from "@formae/protocol";
import {
  inferManualComponentStatuses,
  type ManualDetectedComponentInference,
} from "./manualComponentStatus";
import {
  type CurriculumSeedResolution,
  type PublicCatalogComponent,
  type PublicCatalogCurriculumSeed,
  resolveCurriculumSeed,
} from "./publicCatalog";

interface BuildLocalStudentSnapshotBundleInput {
  manualImport: ManualImportStoredSnapshot;
  matchedCatalogComponents: PublicCatalogComponent[];
  derivedAt?: string;
}

export function buildLocalStudentSnapshotBundle(
  input: BuildLocalStudentSnapshotBundleInput,
): LocalStudentSnapshotBundle {
  const derivedAt = input.derivedAt ?? new Date().toISOString();
  const studentSnapshot = buildStudentSnapshotFromManualImport({
    manualImport: input.manualImport,
    matchedCatalogComponents: input.matchedCatalogComponents,
    generatedAt: derivedAt,
  });

  return {
    schemaVersion: 1,
    source: "manual-import",
    derivedAt,
    manualImport: input.manualImport,
    studentSnapshot,
  };
}

interface BuildStudentSnapshotFromManualImportInput {
  manualImport: ManualImportStoredSnapshot;
  matchedCatalogComponents: PublicCatalogComponent[];
  generatedAt: string;
}

export function buildStudentSnapshotFromManualImport(
  input: BuildStudentSnapshotFromManualImportInput,
): StudentSnapshot {
  const curriculumResolution = resolveCurriculumSeed(
    input.manualImport.detectedComponentCodes,
    input.manualImport.preferredCurriculumSeedId ?? null,
  );
  const resolvedCurriculum =
    curriculumResolution.selectedMatch?.curriculum ?? null;
  const componentInferences = inferManualComponentStatuses(
    input.manualImport.rawInput,
    input.manualImport.detectedComponentCodes,
  );
  const structuredComponentStateMap = buildStructuredComponentStateMap(
    input.manualImport.structuredContext?.componentStates ?? [],
  );
  const components = buildCurriculumComponents(
    input.manualImport,
    input.matchedCatalogComponents,
    resolvedCurriculum,
    structuredComponentStateMap,
  );
  const completedComponents = components.filter(
    (component) =>
      resolveAcademicComponentStatus(
        component.code,
        structuredComponentStateMap,
        componentInferences,
      ) === "completed",
  );
  const inProgressComponents = components.filter(
    (component) =>
      resolveAcademicComponentStatus(
        component.code,
        structuredComponentStateMap,
        componentInferences,
      ) === "inProgress",
  );
  const scheduleBlocks = buildScheduleBlocks(
    input.manualImport,
    input.matchedCatalogComponents,
    input.manualImport.structuredContext?.scheduleBindings ?? [],
  );
  const pendingRequirements = buildPendingRequirements(
    input.manualImport,
    components,
    completedComponents,
    componentInferences,
    structuredComponentStateMap,
    inProgressComponents,
    scheduleBlocks,
    resolvedCurriculum,
    curriculumResolution,
    resolvedCurriculum?.prerequisiteRules ?? [],
    input.matchedCatalogComponents,
  );
  const totalWorkloadHours =
    resolvedCurriculum?.course.totalWorkloadHours ??
    components.reduce((total, component) => total + component.workloadHours, 0);

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    studentNumber:
      input.manualImport.structuredContext?.studentProfile?.studentNumber ??
      "manual-import",
    studentName:
      input.manualImport.structuredContext?.studentProfile?.studentName ??
      "Snapshot local provisório",
    curriculum: {
      curriculumId:
        resolvedCurriculum?.id ?? `manual-${input.manualImport.snapshotId}`,
      name:
        resolvedCurriculum?.name ??
        "Curriculo provisório derivado de importacao manual",
      course: resolvedCurriculum?.course ?? {
        code: "UFBA-MANUAL",
        name:
          input.manualImport.structuredContext?.studentProfile?.courseName ??
          "Curso UFBA provisório",
        campus: "UFBA/SIGAA",
        degreeLevel: "unknown",
        totalWorkloadHours,
      },
      components,
      prerequisiteRules: resolvedCurriculum?.prerequisiteRules ?? [],
      equivalences: resolvedCurriculum?.equivalences ?? [],
    },
    completedComponents,
    inProgressComponents,
    scheduleBlocks,
    pendingRequirements,
    issuedDocuments: [],
  };
}

function buildCurriculumComponents(
  manualImport: ManualImportStoredSnapshot,
  matchedCatalogComponents: PublicCatalogComponent[],
  resolvedCurriculum: PublicCatalogCurriculumSeed | null,
  structuredComponentStateMap: Map<
    string,
    ManualImportStructuredComponentState
  >,
): Component[] {
  if (resolvedCurriculum) {
    return mergeSeededCurriculumComponents(
      manualImport,
      matchedCatalogComponents,
      resolvedCurriculum,
      structuredComponentStateMap,
    );
  }

  const matchedByCode = new Map(
    matchedCatalogComponents.map((component) => [component.code, component]),
  );
  const components = manualImport.detectedComponentCodes.map((code) => {
    const matchedComponent = matchedByCode.get(code);
    const structuredComponentState = structuredComponentStateMap.get(code);

    if (matchedComponent) {
      return {
        code: matchedComponent.code,
        title: structuredComponentState?.title ?? matchedComponent.title,
        credits: 0,
        workloadHours: 0,
        componentType: "catalog-seed",
      };
    }

    return {
      code,
      title:
        structuredComponentState?.title ??
        `Componente detectado manualmente (${code})`,
      credits: 0,
      workloadHours: 0,
      componentType: "manual-detected",
    };
  });

  return components.sort((left, right) => left.code.localeCompare(right.code));
}

function buildScheduleBlocks(
  manualImport: ManualImportStoredSnapshot,
  matchedCatalogComponents: PublicCatalogComponent[],
  structuredScheduleBindings: Array<{
    componentCode: string;
    scheduleCode: string;
  }>,
): ScheduleBlock[] {
  return manualImport.normalizedSchedules.map((normalizedSchedule) => ({
    componentCode: findComponentCodeForSchedule(
      normalizedSchedule.result.canonicalCode,
      manualImport,
      matchedCatalogComponents,
      structuredScheduleBindings,
    ),
    rawCode: normalizedSchedule.result.rawCode,
    canonicalCode: normalizedSchedule.result.canonicalCode,
    meetings: normalizedSchedule.result.meetings,
  }));
}

function buildPendingRequirements(
  manualImport: ManualImportStoredSnapshot,
  components: Component[],
  completedComponents: Component[],
  componentInferences: ManualDetectedComponentInference[],
  structuredComponentStateMap: Map<
    string,
    ManualImportStructuredComponentState
  >,
  inProgressComponents: Component[],
  scheduleBlocks: ScheduleBlock[],
  resolvedCurriculum: PublicCatalogCurriculumSeed | null,
  curriculumResolution: CurriculumSeedResolution,
  prerequisiteRules: PrerequisiteRule[],
  matchedCatalogComponents: PublicCatalogComponent[],
): PendingRequirement[] {
  const matchedCodes = new Set<string>([
    ...matchedCatalogComponents.map((component) => component.code),
    ...(resolvedCurriculum?.components.map((component) => component.code) ??
      []),
  ]);
  const completedCodes = new Set(
    completedComponents.map((component) => component.code),
  );
  const inProgressCodes = new Set(
    inProgressComponents.map((component) => component.code),
  );
  const parserWarnings = scheduleBlocks.flatMap((block) => {
    const normalizedSchedule = manualImport.normalizedSchedules.find(
      (item) => item.result.canonicalCode === block.canonicalCode,
    );

    return normalizedSchedule?.result.warnings ?? [];
  });
  const requirements: PendingRequirement[] = [];

  if (curriculumResolution.requiresReview) {
    requirements.push({
      id: "curriculum-seed-review",
      title: "Revisar selecao da grade seed",
      status: "outstanding",
      details: buildCurriculumResolutionDetails(curriculumResolution),
      relatedComponentCode: null,
    });
  }

  for (const componentCode of manualImport.detectedComponentCodes) {
    if (!matchedCodes.has(componentCode)) {
      requirements.push({
        id: `catalog-match:${componentCode}`,
        title: `Validar ${componentCode} no catalogo publico`,
        status: "outstanding",
        details:
          "O codigo foi detectado na importacao manual, mas ainda nao existe correspondencia no catalogo seed local.",
        relatedComponentCode: componentCode,
      });
    }
  }

  for (const inference of componentInferences) {
    if (inference.status === "failed") {
      if (
        resolveAcademicComponentStatus(
          inference.code,
          structuredComponentStateMap,
          componentInferences,
        ) !== "failed"
      ) {
        continue;
      }

      requirements.push({
        id: `component-retry:${inference.code}`,
        title: `Retomar ${inference.code}`,
        status: "outstanding",
        details:
          "A importacao manual detectou sinais de reprovacao, cancelamento ou trancamento para este componente.",
        relatedComponentCode: inference.code,
      });
    }

    const resolvedStatus = resolveAcademicComponentStatus(
      inference.code,
      structuredComponentStateMap,
      componentInferences,
    );

    if (
      resolvedStatus === "unknown" &&
      (inference.status === "unknown" || inference.hasConflictingSignals)
    ) {
      requirements.push({
        id: `component-status:${inference.code}`,
        title: `Revisar status de ${inference.code}`,
        status: "outstanding",
        details: inference.hasConflictingSignals
          ? "O texto manual traz sinais conflitantes para este componente."
          : "O texto manual nao trouxe sinais suficientes para classificar este componente como concluido ou em andamento.",
        relatedComponentCode: inference.code,
      });
    }
  }

  for (const rule of prerequisiteRules) {
    const relatedComponent = components.find(
      (component) => component.code === rule.componentCode,
    );

    if (!relatedComponent || completedCodes.has(rule.componentCode)) {
      continue;
    }

    const missingRequiredCodes = rule.requiredComponentCodes.filter(
      (componentCode) => !completedCodes.has(componentCode),
    );

    if (missingRequiredCodes.length === 0) {
      continue;
    }

    requirements.push({
      id: `prerequisite:${rule.componentCode}`,
      title: `Liberar ${relatedComponent.title}`,
      status: "outstanding",
      details: `Faltam pre-requisitos antes de ${rule.componentCode}: ${missingRequiredCodes.join(", ")}.`,
      relatedComponentCode: rule.componentCode,
    });
  }

  for (const scheduleBlock of scheduleBlocks) {
    if (!scheduleBlock.componentCode) {
      requirements.push({
        id: `schedule-binding:${scheduleBlock.canonicalCode}`,
        title: `Vincular horario ${scheduleBlock.canonicalCode} a um componente`,
        status: "outstanding",
        details:
          "O horario foi normalizado, mas a importacao manual ainda nao permite associacao confiavel com um componente.",
        relatedComponentCode: null,
      });
    }
  }

  for (const component of components) {
    const isPending =
      !completedCodes.has(component.code) &&
      !inProgressCodes.has(component.code);

    if (isPending) {
      requirements.push({
        id: `component:${component.code}`,
        title: `Concluir ${component.title}`,
        status: "outstanding",
        details: `Componente ainda nao concluido nem em andamento: ${component.code}`,
        relatedComponentCode: component.code,
      });
    }
  }

  if (manualImport.previewWarnings.length > 0 || parserWarnings.length > 0) {
    requirements.push({
      id: "manual-import-review",
      title: "Revisar warnings da importacao manual",
      status: "outstanding",
      details: [
        ...manualImport.previewWarnings,
        ...parserWarnings.map((warning) => warning.message),
      ].join(" | "),
      relatedComponentCode: null,
    });
  }

  return deduplicateRequirements(requirements);
}

function findComponentCodeForSchedule(
  canonicalScheduleCode: string,
  manualImport: ManualImportStoredSnapshot,
  matchedCatalogComponents: PublicCatalogComponent[],
  structuredScheduleBindings: Array<{
    componentCode: string;
    scheduleCode: string;
  }>,
): string | null {
  const structuredBinding = structuredScheduleBindings.find(
    (binding) => binding.scheduleCode === canonicalScheduleCode,
  );

  if (structuredBinding) {
    return structuredBinding.componentCode;
  }

  const directMatches = matchedCatalogComponents.filter(
    (component) => component.canonicalScheduleCode === canonicalScheduleCode,
  );

  if (directMatches.length === 1) {
    return directMatches[0].code;
  }

  if (manualImport.detectedComponentCodes.length === 1) {
    return manualImport.detectedComponentCodes[0];
  }

  return null;
}

function resolveAcademicComponentStatus(
  componentCode: string,
  structuredComponentStateMap: Map<
    string,
    ManualImportStructuredComponentState
  >,
  componentInferences: ManualDetectedComponentInference[],
): AcademicComponentStatus {
  const structuredComponentState =
    structuredComponentStateMap.get(componentCode);

  if (
    structuredComponentState &&
    structuredComponentState.status !== "unknown"
  ) {
    return structuredComponentState.status;
  }

  const inferredStatus =
    componentInferences.find((inference) => inference.code === componentCode)
      ?.status ?? "unknown";

  return inferredStatus;
}

function buildStructuredComponentStateMap(
  componentStates: ManualImportStructuredComponentState[],
): Map<string, ManualImportStructuredComponentState> {
  return new Map(
    componentStates.map((componentState) => [
      componentState.code,
      componentState,
    ]),
  );
}

function deduplicateRequirements(
  requirements: PendingRequirement[],
): PendingRequirement[] {
  const seenIds = new Set<string>();

  return requirements.filter((requirement) => {
    if (seenIds.has(requirement.id)) {
      return false;
    }

    seenIds.add(requirement.id);
    return true;
  });
}

function buildCurriculumResolutionDetails(
  curriculumResolution: CurriculumSeedResolution,
): string {
  const candidateSummary = [
    curriculumResolution.selectedMatch,
    ...curriculumResolution.alternativeMatches,
  ]
    .filter(
      (
        match,
      ): match is NonNullable<typeof curriculumResolution.selectedMatch> =>
        match !== null,
    )
    .map(
      (match) =>
        `${match.curriculum.id} (${match.matchedCount} match, ${Math.round(
          match.detectedCoverageRatio * 100,
        )}% dos codigos detectados)`,
    )
    .join(" | ");

  if (!candidateSummary) {
    return curriculumResolution.reason;
  }

  return `${curriculumResolution.reason} Candidatas locais: ${candidateSummary}.`;
}

function mergeSeededCurriculumComponents(
  manualImport: ManualImportStoredSnapshot,
  matchedCatalogComponents: PublicCatalogComponent[],
  resolvedCurriculum: PublicCatalogCurriculumSeed,
  structuredComponentStateMap: Map<
    string,
    ManualImportStructuredComponentState
  >,
): Component[] {
  const seededComponents = resolvedCurriculum.components.map((component) => {
    const structuredComponentState = structuredComponentStateMap.get(
      component.code,
    );

    return {
      ...component,
      title: structuredComponentState?.title ?? component.title,
    };
  });
  const knownCodes = new Set(
    seededComponents.map((component) => component.code),
  );
  const matchedByCode = new Map(
    matchedCatalogComponents.map((component) => [component.code, component]),
  );
  const extraComponents = manualImport.detectedComponentCodes
    .filter((componentCode) => !knownCodes.has(componentCode))
    .map((componentCode) => {
      const matchedComponent = matchedByCode.get(componentCode);
      const structuredComponentState =
        structuredComponentStateMap.get(componentCode);

      if (matchedComponent) {
        return {
          code: matchedComponent.code,
          title: structuredComponentState?.title ?? matchedComponent.title,
          credits: 0,
          workloadHours: 0,
          componentType: "catalog-seed-extra",
        };
      }

      return {
        code: componentCode,
        title:
          structuredComponentState?.title ??
          `Componente detectado manualmente (${componentCode})`,
        credits: 0,
        workloadHours: 0,
        componentType: "manual-detected",
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));

  return [...seededComponents, ...extraComponents];
}
