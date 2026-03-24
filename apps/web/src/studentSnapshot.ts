import type {
  Component,
  LocalStudentSnapshotBundle,
  ManualImportStoredSnapshot,
  PendingRequirement,
  ScheduleBlock,
  StudentSnapshot,
} from "@formae/protocol";
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
  const components = buildCurriculumComponents(
    input.manualImport,
    input.matchedCatalogComponents,
  );
  const scheduleBlocks = buildScheduleBlocks(
    input.manualImport,
    input.matchedCatalogComponents,
  );
  const pendingRequirements = buildPendingRequirements(
    input.manualImport,
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
    completedComponents: [],
    inProgressComponents: components,
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
  scheduleBlocks: ScheduleBlock[],
  matchedCatalogComponents: PublicCatalogComponent[],
): PendingRequirement[] {
  const matchedCodes = new Set(
    matchedCatalogComponents.map((component) => component.code),
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

  return requirements;
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
