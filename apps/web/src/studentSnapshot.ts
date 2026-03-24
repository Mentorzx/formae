import type {
  Component,
  LocalStudentSnapshotBundle,
  ManualImportStoredSnapshot,
  PendingRequirement,
  ScheduleBlock,
  StudentSnapshot,
} from "@formae/protocol";
import {
  inferManualComponentStatuses,
  type ManualDetectedComponentInference,
} from "./manualComponentStatus";
import type { PublicCatalogComponent } from "./publicCatalog";

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
  const componentInferences = inferManualComponentStatuses(
    input.manualImport.rawInput,
    input.manualImport.detectedComponentCodes,
  );
  const components = buildCurriculumComponents(
    input.manualImport,
    input.matchedCatalogComponents,
  );
  const completedComponents = components.filter((component) =>
    hasComponentStatus(component.code, componentInferences, "completed"),
  );
  const inProgressComponents = components.filter((component) =>
    hasComponentStatus(component.code, componentInferences, "inProgress"),
  );
  const scheduleBlocks = buildScheduleBlocks(
    input.manualImport,
    input.matchedCatalogComponents,
  );
  const pendingRequirements = buildPendingRequirements(
    input.manualImport,
    components,
    completedComponents,
    componentInferences,
    inProgressComponents,
    scheduleBlocks,
    input.matchedCatalogComponents,
  );
  const totalWorkloadHours = components.reduce(
    (total, component) => total + component.workloadHours,
    0,
  );

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    studentNumber: "manual-import",
    studentName: "Snapshot local provisório",
    curriculum: {
      curriculumId: `manual-${input.manualImport.snapshotId}`,
      name: "Curriculo provisório derivado de importacao manual",
      course: {
        code: "UFBA-MANUAL",
        name: "Curso UFBA provisório",
        campus: "UFBA",
        degreeLevel: "unknown",
        totalWorkloadHours,
      },
      components,
      prerequisiteRules: [],
      equivalences: [],
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
): Component[] {
  const matchedByCode = new Map(
    matchedCatalogComponents.map((component) => [component.code, component]),
  );
  const components = manualImport.detectedComponentCodes.map((code) => {
    const matchedComponent = matchedByCode.get(code);

    if (matchedComponent) {
      return {
        code: matchedComponent.code,
        title: matchedComponent.title,
        credits: 0,
        workloadHours: 0,
        componentType: "catalog-seed",
      };
    }

    return {
      code,
      title: `Componente detectado manualmente (${code})`,
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
): ScheduleBlock[] {
  return manualImport.normalizedSchedules.map((normalizedSchedule) => ({
    componentCode: findComponentCodeForSchedule(
      normalizedSchedule.result.canonicalCode,
      manualImport,
      matchedCatalogComponents,
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
  inProgressComponents: Component[],
  scheduleBlocks: ScheduleBlock[],
  matchedCatalogComponents: PublicCatalogComponent[],
): PendingRequirement[] {
  const matchedCodes = new Set(
    matchedCatalogComponents.map((component) => component.code),
  );
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
      requirements.push({
        id: `component-retry:${inference.code}`,
        title: `Retomar ${inference.code}`,
        status: "outstanding",
        details:
          "A importacao manual detectou sinais de reprovacao, cancelamento ou trancamento para este componente.",
        relatedComponentCode: inference.code,
      });
    }

    if (inference.status === "unknown" || inference.hasConflictingSignals) {
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
): string | null {
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

function hasComponentStatus(
  componentCode: string,
  componentInferences: ManualDetectedComponentInference[],
  expectedStatus: ManualDetectedComponentInference["status"],
): boolean {
  return componentInferences.some(
    (inference) =>
      inference.code === componentCode && inference.status === expectedStatus,
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
