import type {
  LocalStudentSnapshotBundle,
  PendingRequirement,
  StudentSnapshot,
} from "@formae/protocol";

export type ComponentProgressStatus = "ready" | "partial" | "review";

export interface ComponentProgressItem {
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
  matchedCatalogCount: number;
  resolvedComponentCount: number;
  resolvedComponentPercent: number;
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

  const componentItems = bundle.studentSnapshot.inProgressComponents.map(
    (component) => {
      const pendingRequirements = pendingByComponent.get(component.code) ?? [];
      const hasCatalogMatch = matchedCatalogCodes.has(component.code);
      const scheduleBlockCount =
        scheduleBlocksByComponent.get(component.code) ?? 0;

      return {
        code: component.code,
        title: component.title,
        hasCatalogMatch,
        scheduleBlockCount,
        pendingRequirements,
        status: getComponentProgressStatus({
          hasCatalogMatch,
          scheduleBlockCount,
          pendingRequirements,
        }),
      };
    },
  );
  const resolvedComponentCount = componentItems.filter(
    (item) => item.status === "ready",
  ).length;
  const componentCount = componentItems.length;
  const boundScheduleBlockCount = bundle.studentSnapshot.scheduleBlocks.filter(
    (scheduleBlock) => scheduleBlock.componentCode,
  ).length;

  return {
    studentSnapshot: bundle.studentSnapshot,
    derivedAt: bundle.derivedAt,
    componentCount,
    matchedCatalogCount: componentItems.filter((item) => item.hasCatalogMatch)
      .length,
    resolvedComponentCount,
    resolvedComponentPercent:
      componentCount === 0
        ? 0
        : Math.round((resolvedComponentCount / componentCount) * 100),
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
  hasCatalogMatch,
  scheduleBlockCount,
  pendingRequirements,
}: {
  hasCatalogMatch: boolean;
  scheduleBlockCount: number;
  pendingRequirements: PendingRequirement[];
}): ComponentProgressStatus {
  if (hasCatalogMatch && pendingRequirements.length === 0) {
    return "ready";
  }

  if (hasCatalogMatch || scheduleBlockCount > 0) {
    return "partial";
  }

  return "review";
}
