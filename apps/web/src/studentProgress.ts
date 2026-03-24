import type {
  LocalStudentSnapshotBundle,
  PendingRequirement,
  StudentSnapshot,
} from "@formae/protocol";

export type ComponentAcademicStatus = "completed" | "inProgress" | "review";
export type ComponentProgressStatus = "ready" | "partial" | "review";

export interface ComponentProgressItem {
  academicStatus: ComponentAcademicStatus;
  code: string;
  title: string;
  hasCatalogMatch: boolean;
  scheduleBlockCount: number;
  pendingRequirements: PendingRequirement[];
  status: ComponentProgressStatus;
}

export interface StudentProgressSummary {
  studentSnapshot: StudentSnapshot;
  derivedAt: string;
  componentCount: number;
  completedCount: number;
  inProgressCount: number;
  matchedCatalogCount: number;
  classifiedComponentCount: number;
  classifiedComponentPercent: number;
  reviewCount: number;
  scheduleBlockCount: number;
  boundScheduleBlockCount: number;
  unboundScheduleBlockCount: number;
  pendingRequirementCount: number;
  componentItems: ComponentProgressItem[];
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
  const reviewCount = componentItems.filter(
    (item) => item.status === "review",
  ).length;
  const boundScheduleBlockCount = bundle.studentSnapshot.scheduleBlocks.filter(
    (scheduleBlock) => scheduleBlock.componentCode,
  ).length;

  return {
    studentSnapshot: bundle.studentSnapshot,
    derivedAt: bundle.derivedAt,
    componentCount,
    completedCount,
    inProgressCount,
    matchedCatalogCount: componentItems.filter((item) => item.hasCatalogMatch)
      .length,
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
