import type {
  LocalStudentSnapshotBundle,
  PendingRequirement,
  StudentSnapshot,
} from "@formae/protocol";

export type ComponentAcademicStatus = "completed" | "inProgress" | "review";
export type ComponentProgressStatus = "ready" | "partial" | "review";
export type CurriculumLaneStatus = "completed" | "inProgress" | "pending";
export type CurriculumFocusPriority = "high" | "medium" | "low";

export interface ComponentProgressItem {
  academicStatus: ComponentAcademicStatus;
  code: string;
  title: string;
  hasCatalogMatch: boolean;
  scheduleBlockCount: number;
  pendingRequirements: PendingRequirement[];
  status: ComponentProgressStatus;
}

export interface CurriculumLane {
  id: string;
  title: string;
  description: string;
  componentCodes: string[];
  count: number;
  percent: number;
  status: CurriculumLaneStatus;
}

export interface CurriculumFocusItem {
  code: string;
  title: string;
  priority: CurriculumFocusPriority;
  reason: string;
}

export interface StudentProgressSummary {
  studentSnapshot: StudentSnapshot;
  derivedAt: string;
  componentCount: number;
  completedCount: number;
  inProgressCount: number;
  remainingComponentCount: number;
  matchedCatalogCount: number;
  completedComponentPercent: number;
  activeComponentPercent: number;
  classifiedComponentCount: number;
  classifiedComponentPercent: number;
  reviewCount: number;
  scheduleBlockCount: number;
  boundScheduleBlockCount: number;
  unboundScheduleBlockCount: number;
  pendingRequirementCount: number;
  componentItems: ComponentProgressItem[];
  curriculumLanes: CurriculumLane[];
  focusItems: CurriculumFocusItem[];
  generalPendingRequirements: PendingRequirement[];
}

export function summarizeStudentProgress(
  bundle: LocalStudentSnapshotBundle,
): StudentProgressSummary {
  const scheduleBlocksByComponent = new Map<string, number>();
  const generalPendingRequirements: PendingRequirement[] = [];
  const pendingByComponent = new Map<string, PendingRequirement[]>();
  const matchedCatalogCodes = new Set(
    bundle.manualImport.matchedCatalogComponentCodes,
  );
  const completedCodes = new Set(
    bundle.studentSnapshot.completedComponents.map(
      (component) => component.code,
    ),
  );
  const inProgressCodes = new Set(
    bundle.studentSnapshot.inProgressComponents.map(
      (component) => component.code,
    ),
  );

  for (const scheduleBlock of bundle.studentSnapshot.scheduleBlocks) {
    if (!scheduleBlock.componentCode) {
      continue;
    }

    scheduleBlocksByComponent.set(
      scheduleBlock.componentCode,
      (scheduleBlocksByComponent.get(scheduleBlock.componentCode) ?? 0) + 1,
    );
  }

  for (const requirement of bundle.studentSnapshot.pendingRequirements) {
    if (!requirement.relatedComponentCode) {
      generalPendingRequirements.push(requirement);
      continue;
    }

    const currentItems =
      pendingByComponent.get(requirement.relatedComponentCode) ?? [];
    currentItems.push(requirement);
    pendingByComponent.set(requirement.relatedComponentCode, currentItems);
  }

  const componentItems = bundle.studentSnapshot.curriculum.components.map(
    (component) => {
      const pendingRequirements = pendingByComponent.get(component.code) ?? [];
      const hasCatalogMatch = matchedCatalogCodes.has(component.code);
      const scheduleBlockCount =
        scheduleBlocksByComponent.get(component.code) ?? 0;
      const academicStatus = getComponentAcademicStatus(
        component.code,
        completedCodes,
        inProgressCodes,
      );

      return {
        academicStatus,
        code: component.code,
        title: component.title,
        hasCatalogMatch,
        scheduleBlockCount,
        pendingRequirements,
        status: getComponentProgressStatus({
          academicStatus,
          hasCatalogMatch,
          pendingRequirements,
        }),
      };
    },
  );
  const classifiedComponentCount = componentItems.filter(
    (item) => item.academicStatus !== "review",
  ).length;
  const completedCount = componentItems.filter(
    (item) => item.academicStatus === "completed",
  ).length;
  const inProgressCount = componentItems.filter(
    (item) => item.academicStatus === "inProgress",
  ).length;
  const componentCount = componentItems.length;
  const remainingComponentCount = componentItems.filter(
    (item) => item.academicStatus === "review",
  ).length;
  const reviewCount = componentItems.filter(
    (item) => item.status === "review",
  ).length;
  const boundScheduleBlockCount = bundle.studentSnapshot.scheduleBlocks.filter(
    (scheduleBlock) => scheduleBlock.componentCode,
  ).length;
  const completedComponentPercent =
    componentCount === 0
      ? 0
      : Math.round((completedCount / componentCount) * 100);
  const activeComponentPercent =
    componentCount === 0
      ? 0
      : Math.round(((completedCount + inProgressCount) / componentCount) * 100);
  const curriculumLanes = buildCurriculumLanes(componentItems, componentCount);
  const focusItems = buildFocusItems(componentItems);

  return {
    studentSnapshot: bundle.studentSnapshot,
    derivedAt: bundle.derivedAt,
    componentCount,
    completedCount,
    inProgressCount,
    remainingComponentCount,
    matchedCatalogCount: componentItems.filter((item) => item.hasCatalogMatch)
      .length,
    completedComponentPercent,
    activeComponentPercent,
    classifiedComponentCount,
    classifiedComponentPercent:
      componentCount === 0
        ? 0
        : Math.round((classifiedComponentCount / componentCount) * 100),
    reviewCount,
    scheduleBlockCount: bundle.studentSnapshot.scheduleBlocks.length,
    boundScheduleBlockCount,
    unboundScheduleBlockCount:
      bundle.studentSnapshot.scheduleBlocks.length - boundScheduleBlockCount,
    pendingRequirementCount: bundle.studentSnapshot.pendingRequirements.length,
    componentItems,
    curriculumLanes,
    focusItems,
    generalPendingRequirements,
  };
}

function getComponentProgressStatus({
  academicStatus,
  hasCatalogMatch,
  pendingRequirements,
}: {
  academicStatus: ComponentAcademicStatus;
  hasCatalogMatch: boolean;
  pendingRequirements: PendingRequirement[];
}): ComponentProgressStatus {
  if (academicStatus === "completed" && pendingRequirements.length === 0) {
    return "ready";
  }

  if (
    academicStatus === "inProgress" ||
    (academicStatus === "completed" && hasCatalogMatch)
  ) {
    return "partial";
  }

  return "review";
}

function getComponentAcademicStatus(
  componentCode: string,
  completedCodes: Set<string>,
  inProgressCodes: Set<string>,
): ComponentAcademicStatus {
  if (completedCodes.has(componentCode)) {
    return "completed";
  }

  if (inProgressCodes.has(componentCode)) {
    return "inProgress";
  }

  return "review";
}

function buildCurriculumLanes(
  componentItems: ComponentProgressItem[],
  componentCount: number,
): CurriculumLane[] {
  return [
    createCurriculumLane({
      id: "completed",
      title: "Concluidos",
      description:
        "Componentes que o snapshot manual ja reconhece como vencidos.",
      componentItems: componentItems.filter(
        (item) => item.academicStatus === "completed",
      ),
      componentCount,
      status: "completed",
    }),
    createCurriculumLane({
      id: "in-progress",
      title: "Em andamento",
      description:
        "Componentes ainda ativos no periodo atual ou em andamento local.",
      componentItems: componentItems.filter(
        (item) => item.academicStatus === "inProgress",
      ),
      componentCount,
      status: "inProgress",
    }),
    createCurriculumLane({
      id: "remaining",
      title: "Restantes",
      description:
        "Componentes que seguem pendentes ou ainda exigem revisao manual.",
      componentItems: componentItems.filter(
        (item) => item.academicStatus === "review",
      ),
      componentCount,
      status: "pending",
    }),
  ];
}

function createCurriculumLane({
  id,
  title,
  description,
  componentItems,
  componentCount,
  status,
}: {
  id: string;
  title: string;
  description: string;
  componentItems: ComponentProgressItem[];
  componentCount: number;
  status: CurriculumLaneStatus;
}): CurriculumLane {
  return {
    id,
    title,
    description,
    componentCodes: componentItems.map((item) => item.code),
    count: componentItems.length,
    percent:
      componentCount === 0
        ? 0
        : Math.round((componentItems.length / componentCount) * 100),
    status,
  };
}

function buildFocusItems(
  componentItems: ComponentProgressItem[],
): CurriculumFocusItem[] {
  return componentItems
    .filter((item) => item.status !== "ready")
    .map((item) => ({
      code: item.code,
      title: item.title,
      priority: getFocusPriority(item),
      reason: getFocusReason(item),
    }))
    .sort((left, right) => {
      const priorityDelta =
        getFocusPriorityRank(left.priority) -
        getFocusPriorityRank(right.priority);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.code.localeCompare(right.code);
    });
}

function getFocusPriority(
  item: ComponentProgressItem,
): CurriculumFocusPriority {
  if (
    hasPendingRequirementWithPrefix(
      item.pendingRequirements,
      "component-retry:",
    )
  ) {
    return "high";
  }

  if (
    hasPendingRequirementWithPrefix(
      item.pendingRequirements,
      "component-status:",
    ) ||
    hasPendingRequirementWithPrefix(item.pendingRequirements, "catalog-match:")
  ) {
    return "high";
  }

  if (item.academicStatus === "inProgress") {
    return "medium";
  }

  return "low";
}

function getFocusReason(item: ComponentProgressItem): string {
  if (
    hasPendingRequirementWithPrefix(
      item.pendingRequirements,
      "component-retry:",
    )
  ) {
    return "Ha sinais de reprovacao, cancelamento ou trancamento; vale revisar este componente primeiro.";
  }

  if (
    hasPendingRequirementWithPrefix(
      item.pendingRequirements,
      "component-status:",
    )
  ) {
    return "O texto importado ainda nao permite classificar este componente com seguranca.";
  }

  if (
    hasPendingRequirementWithPrefix(item.pendingRequirements, "catalog-match:")
  ) {
    return "O componente apareceu na importacao, mas ainda nao bate com o catalogo seed local.";
  }

  if (item.academicStatus === "inProgress") {
    return "O componente ja esta em andamento e conta para a trilha ativa do snapshot.";
  }

  return "O componente ainda nao aparece como concluido nem em andamento no snapshot atual.";
}

function hasPendingRequirementWithPrefix(
  requirements: PendingRequirement[],
  prefix: string,
): boolean {
  return requirements.some((requirement) => requirement.id.startsWith(prefix));
}

function getFocusPriorityRank(priority: CurriculumFocusPriority): number {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}
