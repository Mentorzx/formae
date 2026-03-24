import { describe, expect, it } from "vitest";
import {
  buildPlannerDependencyGraph,
  buildPlannerRelationHighlights,
  createPlannerBoardFromProgress,
  describePlannerTermLabel,
  projectPlannerBoard,
  summarizePlannerFilters,
  validatePlannerMove,
} from "./plannerModel";
import type { StudentProgressSummary } from "./studentProgress";

describe("plannerModel", () => {
  it("creates seeded planner terms from progress summary", () => {
    const summary = createSummary();
    const board = createPlannerBoardFromProgress(summary);

    expect(board.terms.map((term) => term.id)).toEqual([
      "completed",
      "in-progress",
      "planned-1",
      "planned-2",
    ]);
    expect(board.terms[0]?.componentCodes).toEqual(["MATA01"]);
    expect(board.terms[1]?.componentCodes).toEqual(["MATA02"]);
    expect(board.terms[2]?.componentCodes).toEqual(["MATA03", "MATA04"]);
    expect(board.terms[3]?.componentCodes).toEqual(["MATA05"]);
    expect(board.cardsByCode.MATA05?.termId).toBe("planned-2");
  });

  it("builds dependency graph helpers and highlights related components", () => {
    const summary = createSummary();
    const graph = buildPlannerDependencyGraph(
      summary.studentSnapshot.curriculum.prerequisiteRules,
      summary.studentSnapshot.curriculum.components.map(
        (component) => component.code,
      ),
    );

    expect(graph.prerequisiteCodesByComponentCode.MATA03).toEqual(["MATA02"]);
    expect(graph.dependentCodesByComponentCode.MATA02).toEqual(["MATA03"]);
    expect(graph.transitivePrerequisiteCodesByComponentCode.MATA05).toEqual([
      "MATA04",
    ]);
    expect(graph.transitiveDependentCodesByComponentCode.MATA01).toEqual([
      "MATA02",
      "MATA03",
    ]);

    const highlights = buildPlannerRelationHighlights(graph, "MATA02");

    expect(highlights.prerequisiteCodes).toEqual(["MATA01"]);
    expect(highlights.dependentCodes).toEqual(["MATA03"]);
    expect(highlights.relatedComponentCodes).toContain("MATA03");
    expect(highlights.relatedComponentCodes).toContain("MATA01");
  });

  it("validates moves against prerequisite placement", () => {
    const summary = createSummary();
    const board = createPlannerBoardFromProgress(summary);

    const blockedMove = validatePlannerMove(board, "MATA05", "planned-1");
    expect(blockedMove.canMove).toBe(false);
    expect(blockedMove.blockingPrerequisiteCodes).toEqual(["MATA04"]);

    const allowedMove = validatePlannerMove(board, "MATA03", "planned-2");
    expect(allowedMove.canMove).toBe(true);
    expect(allowedMove.reason).toBeNull();
  });

  it("projects filtered and compact planner board views", () => {
    const summary = createSummary();
    const board = createPlannerBoardFromProgress(summary);
    const projected = projectPlannerBoard(board, {
      query: "redes",
      statuses: ["review"],
      compact: true,
    });

    expect(projected.compact).toBe(true);
    expect(projected.visibleComponentCodes).toEqual(["MATA05"]);
    expect(projected.hiddenComponentCodes).toContain("MATA01");
    expect(projected.terms[3]?.visibleComponentCodes).toEqual(["MATA05"]);
    expect(projected.terms[3]?.hiddenComponentCodes).toEqual([]);
  });

  it("describes planner terms using estimated academic periods", () => {
    const summary = createSummary();
    const board = createPlannerBoardFromProgress(summary);
    const activeTerm = board.terms[1];
    const firstPlannedTerm = board.terms[2];

    expect(activeTerm).toBeDefined();
    expect(firstPlannedTerm).toBeDefined();
    expect(
      describePlannerTermLabel(
        board,
        activeTerm as (typeof board.terms)[number],
        1,
      ),
    ).toEqual({
      title: "Agora",
      subtitle: "Período ativo estimado: 2026.1",
    });
    expect(
      describePlannerTermLabel(
        board,
        firstPlannedTerm as (typeof board.terms)[number],
        2,
      ),
    ).toEqual({
      title: "Plano 1",
      subtitle: "Semestre estimado: 2026.2",
    });
  });

  it("summarizes planner filters with empty-state guidance", () => {
    const summary = createSummary();
    const board = createPlannerBoardFromProgress(summary);
    const projected = projectPlannerBoard(board, {
      query: "xyz",
      statuses: ["review"],
      compact: true,
    });

    const filterSummary = summarizePlannerFilters({
      board,
      projectedBoard: projected,
      query: "xyz",
      selectedStatuses: ["review"],
      focusComponentCode: null,
      connectedOnly: false,
      showAvailableOnly: false,
      showScheduledOnly: false,
      showReviewOnly: false,
    });

    expect(filterSummary.activeFilterCount).toBe(2);
    expect(filterSummary.visibleComponentCount).toBe(0);
    expect(filterSummary.totalCountsByStatus).toEqual({
      completed: 1,
      inProgress: 1,
      review: 3,
    });
    expect(filterSummary.visibleCountsByStatus).toEqual({
      completed: 0,
      inProgress: 0,
      review: 0,
    });
    expect(filterSummary.emptyStateTitle).toContain("busca");
    expect(filterSummary.emptyStateHints.length).toBeGreaterThan(0);
  });
});

function createSummary(): StudentProgressSummary {
  const components = [
    {
      code: "MATA01",
      title: "Calculo I",
      academicStatus: "completed" as const,
    },
    {
      code: "MATA02",
      title: "Algebra Linear",
      academicStatus: "inProgress" as const,
    },
    {
      code: "MATA03",
      title: "Estruturas de Dados",
      academicStatus: "review" as const,
    },
    {
      code: "MATA04",
      title: "Banco de Dados",
      academicStatus: "review" as const,
    },
    {
      code: "MATA05",
      title: "Redes de Computadores",
      academicStatus: "review" as const,
    },
  ];

  return {
    studentSnapshot: {
      schemaVersion: 1,
      generatedAt: "2026-03-24T12:00:00.000Z",
      studentNumber: "219216387",
      studentName: "Alex de Lira Neto",
      curriculum: {
        curriculumId: "curriculum-2026",
        name: "Computacao",
        course: {
          code: "C.COMP",
          name: "Ciencia da Computacao",
          campus: "UFBA",
          degreeLevel: "bacharelado",
          totalWorkloadHours: 3000,
        },
        components: components.map((component) => ({
          code: component.code,
          title: component.title,
          credits: 4,
          workloadHours: 60,
          componentType: "mandatory",
        })),
        prerequisiteRules: [
          {
            componentCode: "MATA02",
            expression: "MATA01",
            requiredComponentCodes: ["MATA01"],
          },
          {
            componentCode: "MATA03",
            expression: "MATA02",
            requiredComponentCodes: ["MATA02"],
          },
          {
            componentCode: "MATA05",
            expression: "MATA04",
            requiredComponentCodes: ["MATA04"],
          },
        ],
        equivalences: [],
      },
      completedComponents: [
        {
          code: "MATA01",
          title: "Calculo I",
          credits: 4,
          workloadHours: 60,
          componentType: "mandatory",
        },
      ],
      inProgressComponents: [
        {
          code: "MATA02",
          title: "Algebra Linear",
          credits: 4,
          workloadHours: 60,
          componentType: "mandatory",
        },
      ],
      scheduleBlocks: [],
      pendingRequirements: [],
      issuedDocuments: [],
    },
    derivedAt: "2026-03-24T12:00:00.000Z",
    componentCount: 5,
    completedCount: 1,
    inProgressCount: 1,
    remainingComponentCount: 3,
    matchedCatalogCount: 5,
    completedComponentPercent: 20,
    activeComponentPercent: 40,
    classifiedComponentCount: 2,
    classifiedComponentPercent: 40,
    reviewCount: 3,
    scheduleBlockCount: 0,
    boundScheduleBlockCount: 0,
    unboundScheduleBlockCount: 0,
    pendingRequirementCount: 0,
    componentItems: [
      createItem("MATA01", "Calculo I", "completed", "ready"),
      createItem("MATA02", "Algebra Linear", "inProgress", "partial"),
      createItem("MATA03", "Estruturas de Dados", "review", "review"),
      createItem("MATA04", "Banco de Dados", "review", "review"),
      createItem("MATA05", "Redes de Computadores", "review", "review"),
    ],
    curriculumLanes: [
      {
        id: "completed",
        title: "Concluidos",
        description: "Componentes concluidos",
        componentCodes: ["MATA01"],
        count: 1,
        percent: 20,
        status: "completed",
      },
      {
        id: "in-progress",
        title: "Em andamento",
        description: "Componentes em andamento",
        componentCodes: ["MATA02"],
        count: 1,
        percent: 20,
        status: "inProgress",
      },
      {
        id: "pending",
        title: "Pendentes",
        description: "Componentes pendentes",
        componentCodes: ["MATA03", "MATA04", "MATA05"],
        count: 3,
        percent: 60,
        status: "pending",
      },
    ],
    focusItems: [],
    generalPendingRequirements: [],
  };
}

function createItem(
  code: string,
  title: string,
  academicStatus: StudentProgressSummary["componentItems"][number]["academicStatus"],
  status: StudentProgressSummary["componentItems"][number]["status"],
) {
  return {
    code,
    title,
    academicStatus,
    hasCatalogMatch: true,
    scheduleBlockCount: 0,
    pendingRequirements: [],
    status,
  };
}
