import type { PrerequisiteRule } from "@formae/protocol";
import type {
  ComponentAcademicStatus,
  StudentProgressSummary,
} from "./studentProgress";

export type PlannerTermKind =
  | "completed"
  | "in-progress"
  | "planned"
  | "review";

export interface PlannerDependencyGraph {
  prerequisiteCodesByComponentCode: Record<string, string[]>;
  dependentCodesByComponentCode: Record<string, string[]>;
  transitivePrerequisiteCodesByComponentCode: Record<string, string[]>;
  transitiveDependentCodesByComponentCode: Record<string, string[]>;
  rootComponentCodes: string[];
  leafComponentCodes: string[];
}

export interface PlannerComponentCard {
  code: string;
  title: string;
  academicStatus: ComponentAcademicStatus;
  hasCatalogMatch: boolean;
  scheduleBlockCount: number;
  pendingRequirementCount: number;
  prerequisiteCodes: string[];
  dependentCodes: string[];
  termId: string;
}

export interface PlannerTerm {
  id: string;
  title: string;
  kind: PlannerTermKind;
  componentCodes: string[];
}

export interface PlannerBoard {
  generatedAt: string;
  compact: boolean;
  terms: PlannerTerm[];
  cardsByCode: Record<string, PlannerComponentCard>;
  dependencyGraph: PlannerDependencyGraph;
}

export interface PlannerBoardFilter {
  query?: string | null;
  statuses?: ComponentAcademicStatus[];
  focusComponentCode?: string | null;
  connectedOnly?: boolean;
  compact?: boolean;
}

export interface PlannerBoardTermView extends PlannerTerm {
  visibleComponentCodes: string[];
  hiddenComponentCodes: string[];
}

export interface PlannerBoardView {
  compact: boolean;
  query: string;
  statuses: ComponentAcademicStatus[];
  focusComponentCode: string | null;
  connectedOnly: boolean;
  terms: PlannerBoardTermView[];
  visibleComponentCodes: string[];
  hiddenComponentCodes: string[];
}

export interface PlannerTermDisplayLabel {
  title: string;
  subtitle: string;
}

export interface PlannerFilterSummary {
  activeFilterCount: number;
  totalComponentCount: number;
  visibleComponentCount: number;
  hiddenComponentCount: number;
  totalCountsByStatus: Record<ComponentAcademicStatus, number>;
  visibleCountsByStatus: Record<ComponentAcademicStatus, number>;
  emptyStateTitle: string | null;
  emptyStateMessage: string | null;
  emptyStateHints: string[];
}

export interface PlannerMoveValidation {
  canMove: boolean;
  reason: string | null;
  sourceTermId: string | null;
  targetTermId: string;
  targetTermKind: PlannerTermKind | null;
  blockingPrerequisiteCodes: string[];
}

export interface PlannerRelationHighlights {
  selectedComponentCode: string;
  prerequisiteCodes: string[];
  dependentCodes: string[];
  upstreamComponentCodes: string[];
  downstreamComponentCodes: string[];
  relatedComponentCodes: string[];
  edges: Array<{
    from: string;
    to: string;
    kind: "prerequisite" | "dependent";
  }>;
}

export function buildPlannerDependencyGraph(
  prerequisiteRules: PrerequisiteRule[],
  componentCodes: string[] = [],
): PlannerDependencyGraph {
  const allCodes = uniqueValues([
    ...componentCodes,
    ...prerequisiteRules.map((rule) => rule.componentCode),
    ...prerequisiteRules.flatMap((rule) => rule.requiredComponentCodes),
  ]).sort((left, right) => left.localeCompare(right));

  const prerequisiteMap = createEmptyCodeMap(allCodes);
  const dependentMap = createEmptyCodeMap(allCodes);

  for (const rule of prerequisiteRules) {
    const targetCode = rule.componentCode;
    const requiredCodes = uniqueValues(rule.requiredComponentCodes).filter(
      (code) => code !== targetCode,
    );

    const currentPrerequisites = prerequisiteMap[targetCode] ?? [];
    prerequisiteMap[targetCode] = uniqueValues([
      ...currentPrerequisites,
      ...requiredCodes,
    ]).sort((left, right) => left.localeCompare(right));

    for (const requiredCode of requiredCodes) {
      const currentDependents = dependentMap[requiredCode] ?? [];
      dependentMap[requiredCode] = uniqueValues([
        ...currentDependents,
        targetCode,
      ]).sort((left, right) => left.localeCompare(right));
    }
  }

  const transitivePrerequisiteMap: Record<string, string[]> = {};
  const transitiveDependentMap: Record<string, string[]> = {};

  for (const code of allCodes) {
    transitivePrerequisiteMap[code] = computeTransitiveCodes(
      code,
      prerequisiteMap,
    );
    transitiveDependentMap[code] = computeTransitiveCodes(code, dependentMap);
  }

  return {
    prerequisiteCodesByComponentCode: prerequisiteMap,
    dependentCodesByComponentCode: dependentMap,
    transitivePrerequisiteCodesByComponentCode: transitivePrerequisiteMap,
    transitiveDependentCodesByComponentCode: transitiveDependentMap,
    rootComponentCodes: allCodes.filter(
      (code) => (prerequisiteMap[code] ?? []).length === 0,
    ),
    leafComponentCodes: allCodes.filter(
      (code) => (dependentMap[code] ?? []).length === 0,
    ),
  };
}

export function createPlannerBoardFromProgress(
  summary: StudentProgressSummary,
  options: PlannerBoardFilter = {},
): PlannerBoard {
  const dependencyGraph = buildPlannerDependencyGraph(
    summary.studentSnapshot.curriculum.prerequisiteRules,
    summary.studentSnapshot.curriculum.components.map(
      (component) => component.code,
    ),
  );
  const cardsByCode = buildPlannerCards(summary, dependencyGraph);
  const terms = seedPlannerTerms(summary, dependencyGraph, cardsByCode);

  return {
    generatedAt: summary.derivedAt,
    compact: options.compact ?? false,
    terms,
    cardsByCode,
    dependencyGraph,
  };
}

export function validatePlannerMove(
  board: PlannerBoard,
  componentCode: string,
  targetTermId: string,
): PlannerMoveValidation {
  const targetTermIndex = board.terms.findIndex(
    (term) => term.id === targetTermId,
  );
  const targetTerm = targetTermIndex >= 0 ? board.terms[targetTermIndex] : null;
  const sourceTerm = findTermContainingCode(board.terms, componentCode);

  if (!targetTerm) {
    return {
      canMove: false,
      reason: `Unknown target term: ${targetTermId}.`,
      sourceTermId: sourceTerm?.id ?? null,
      targetTermId,
      targetTermKind: null,
      blockingPrerequisiteCodes: [],
    };
  }

  const prerequisiteCodes =
    board.dependencyGraph.prerequisiteCodesByComponentCode[componentCode] ?? [];
  const blockingPrerequisiteCodes = prerequisiteCodes.filter(
    (prerequisiteCode) => {
      const prerequisiteTerm = findTermContainingCode(
        board.terms,
        prerequisiteCode,
      );
      if (!prerequisiteTerm) {
        return true;
      }

      return (
        board.terms.findIndex((term) => term.id === prerequisiteTerm.id) >=
        targetTermIndex
      );
    },
  );

  if (blockingPrerequisiteCodes.length > 0) {
    return {
      canMove: false,
      reason: `Prerequisites are not satisfied for ${componentCode}.`,
      sourceTermId: sourceTerm?.id ?? null,
      targetTermId,
      targetTermKind: targetTerm.kind,
      blockingPrerequisiteCodes,
    };
  }

  return {
    canMove: true,
    reason: null,
    sourceTermId: sourceTerm?.id ?? null,
    targetTermId,
    targetTermKind: targetTerm.kind,
    blockingPrerequisiteCodes: [],
  };
}

export function buildPlannerRelationHighlights(
  graph: PlannerDependencyGraph,
  componentCode: string,
): PlannerRelationHighlights {
  const prerequisiteCodes =
    graph.prerequisiteCodesByComponentCode[componentCode] ?? [];
  const dependentCodes =
    graph.dependentCodesByComponentCode[componentCode] ?? [];
  const upstreamComponentCodes =
    graph.transitivePrerequisiteCodesByComponentCode[componentCode] ?? [];
  const downstreamComponentCodes =
    graph.transitiveDependentCodesByComponentCode[componentCode] ?? [];
  const relatedComponentCodes = uniqueValues([
    componentCode,
    ...prerequisiteCodes,
    ...dependentCodes,
    ...upstreamComponentCodes,
    ...downstreamComponentCodes,
  ]);

  return {
    selectedComponentCode: componentCode,
    prerequisiteCodes,
    dependentCodes,
    upstreamComponentCodes,
    downstreamComponentCodes,
    relatedComponentCodes,
    edges: [
      ...prerequisiteCodes.map((prerequisiteCode) => ({
        from: prerequisiteCode,
        to: componentCode,
        kind: "prerequisite" as const,
      })),
      ...dependentCodes.map((dependentCode) => ({
        from: componentCode,
        to: dependentCode,
        kind: "dependent" as const,
      })),
    ],
  };
}

export function projectPlannerBoard(
  board: PlannerBoard,
  filter: PlannerBoardFilter = {},
): PlannerBoardView {
  const query = normalizePlannerQuery(filter.query ?? "");
  const queryParts = query.length > 0 ? query.split(/\s+/) : [];
  const statusFilter = new Set(filter.statuses ?? []);
  const focusComponentCode = filter.focusComponentCode?.trim() || null;
  const connectedOnly = Boolean(filter.connectedOnly && focusComponentCode);
  const connectedCodes = focusComponentCode
    ? new Set(
        buildPlannerRelationHighlights(
          board.dependencyGraph,
          focusComponentCode,
        ).relatedComponentCodes,
      )
    : null;
  const visibleComponentCodes = new Set<string>();

  const terms = board.terms.map((term) => {
    const visibleCodes = term.componentCodes.filter((componentCode) => {
      const card = board.cardsByCode[componentCode];

      if (!card) {
        return false;
      }

      if (queryParts.length > 0 && !matchesPlannerQuery(card, queryParts)) {
        return false;
      }

      if (statusFilter.size > 0 && !statusFilter.has(card.academicStatus)) {
        return false;
      }

      if (
        connectedOnly &&
        connectedCodes &&
        !connectedCodes.has(componentCode)
      ) {
        return false;
      }

      return true;
    });

    visibleCodes.forEach((componentCode) => {
      visibleComponentCodes.add(componentCode);
    });

    return {
      ...term,
      visibleComponentCodes: visibleCodes,
      hiddenComponentCodes: term.componentCodes.filter(
        (componentCode) => !visibleCodes.includes(componentCode),
      ),
    };
  });

  const hiddenComponentCodes = Object.keys(board.cardsByCode).filter(
    (componentCode) => !visibleComponentCodes.has(componentCode),
  );

  return {
    compact: filter.compact ?? board.compact,
    query,
    statuses: [...statusFilter],
    focusComponentCode,
    connectedOnly,
    terms,
    visibleComponentCodes: [...visibleComponentCodes],
    hiddenComponentCodes,
  };
}

export function describePlannerTermLabel(
  board: PlannerBoard,
  term: PlannerTerm,
  termIndex: number,
): PlannerTermDisplayLabel {
  const generatedAt = parsePlannerAcademicPeriod(board.generatedAt);
  const plannedTermOrdinal =
    term.kind === "planned" ? getPlannedOrdinal(board, termIndex) : null;

  switch (term.kind) {
    case "completed":
      return {
        title: "Concluídos",
        subtitle: `Histórico local de ${generatedAt.periodLabel}`,
      };
    case "in-progress":
      return {
        title: "Agora",
        subtitle: `Período ativo estimado: ${generatedAt.periodLabel}`,
      };
    case "planned":
      return {
        title:
          plannedTermOrdinal === null ? "Plano" : `Plano ${plannedTermOrdinal}`,
        subtitle: `Semestre estimado: ${formatAcademicPeriod(
          advanceAcademicPeriod(generatedAt, plannedTermOrdinal ?? 0),
        )}`,
      };
    case "review":
      return {
        title: "Revisar encaixe",
        subtitle: `Componentes sem trilha confiável em ${generatedAt.periodLabel}`,
      };
    default:
      return {
        title: term.title,
        subtitle: generatedAt.periodLabel,
      };
  }
}

export function summarizePlannerFilters(input: {
  board: PlannerBoard;
  projectedBoard: PlannerBoardView;
  query: string;
  selectedStatuses: ComponentAcademicStatus[];
  focusComponentCode: string | null;
  connectedOnly: boolean;
  showAvailableOnly: boolean;
  showScheduledOnly: boolean;
  showReviewOnly: boolean;
}): PlannerFilterSummary {
  const totalCountsByStatus = countStatuses(input.board.cardsByCode);
  const visibleCountsByStatus = countStatusesFromCodes(
    input.board.cardsByCode,
    input.projectedBoard.visibleComponentCodes,
  );
  const totalComponentCount = Object.keys(input.board.cardsByCode).length;
  const visibleComponentCount =
    input.projectedBoard.visibleComponentCodes.length;
  const hiddenComponentCount = input.projectedBoard.hiddenComponentCodes.length;
  const activeFilterCount = countActivePlannerFilters(input);

  if (visibleComponentCount > 0) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: null,
      emptyStateMessage: null,
      emptyStateHints: [],
    };
  }

  const trimmedQuery = input.query.trim();

  if (trimmedQuery.length > 0) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: "Nenhum componente corresponde à busca",
      emptyStateMessage: `A busca "${trimmedQuery}" ocultou todos os componentes do planner.`,
      emptyStateHints: [
        "Tente abreviar o texto de busca.",
        "Remova o filtro de foco para ver a grade inteira.",
        "Limpe os chips de status se estiver filtrando demais.",
      ],
    };
  }

  if (input.connectedOnly && input.focusComponentCode) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: `Sem vizinhos visíveis para ${input.focusComponentCode}`,
      emptyStateMessage:
        "O foco atual não deixou prerequisitos ou dependentes visíveis com estes filtros.",
      emptyStateHints: [
        "Clique no componente outra vez para desfazer o foco fixado.",
        "Desative 'So relacionadas' para voltar à trilha completa.",
      ],
    };
  }

  if (input.showAvailableOnly) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: "Nada ficou liberado agora",
      emptyStateMessage:
        "O recorte atual não encontrou nenhum componente pronto para o próximo encaixe.",
      emptyStateHints: [
        "Desative 'So liberadas agora'.",
        "Reveja o semestre planejado para encontrar outra linha de avanço.",
      ],
    };
  }

  if (input.showScheduledOnly) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: "Nenhum componente com horario visível",
      emptyStateMessage:
        "Os filtros atuais esconderam todos os componentes que já têm carga horária associada.",
      emptyStateHints: [
        "Desative 'Com horario local'.",
        "Use a busca para reencontrar um componente específico.",
      ],
    };
  }

  if (input.showReviewOnly) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: "Revisão vazia neste recorte",
      emptyStateMessage:
        "Nenhum item em revisão permaneceu visível com os filtros atuais.",
      emptyStateHints: [
        "Desative 'Em revisao'.",
        "Limpe os filtros para voltar ao mapa completo.",
      ],
    };
  }

  if (input.selectedStatuses.length > 0 && input.selectedStatuses.length < 3) {
    return {
      activeFilterCount,
      totalComponentCount,
      visibleComponentCount,
      hiddenComponentCount,
      totalCountsByStatus,
      visibleCountsByStatus,
      emptyStateTitle: "Status filtrado demais",
      emptyStateMessage:
        "Os status selecionados esconderam todos os componentes visíveis neste recorte.",
      emptyStateHints: [
        "Reative todos os chips de status.",
        "Combine o filtro de status com a busca local para um recorte mais preciso.",
      ],
    };
  }

  return {
    activeFilterCount,
    totalComponentCount,
    visibleComponentCount,
    hiddenComponentCount,
    totalCountsByStatus,
    visibleCountsByStatus,
    emptyStateTitle: "Planner vazio com estes filtros",
    emptyStateMessage:
      "Os filtros atuais esconderam tudo. Isso normalmente acontece quando o foco ou os status ficaram restritivos demais.",
    emptyStateHints: [
      "Limpe a busca local.",
      "Volte os chips de status para todos os componentes.",
      "Desative o foco por relacionamentos.",
    ],
  };
}

function buildPlannerCards(
  summary: StudentProgressSummary,
  dependencyGraph: PlannerDependencyGraph,
): Record<string, PlannerComponentCard> {
  const cardsByCode: Record<string, PlannerComponentCard> = {};

  for (const item of summary.componentItems) {
    cardsByCode[item.code] = {
      code: item.code,
      title: item.title,
      academicStatus: item.academicStatus,
      hasCatalogMatch: item.hasCatalogMatch,
      scheduleBlockCount: item.scheduleBlockCount,
      pendingRequirementCount: item.pendingRequirements.length,
      prerequisiteCodes:
        dependencyGraph.prerequisiteCodesByComponentCode[item.code] ?? [],
      dependentCodes:
        dependencyGraph.dependentCodesByComponentCode[item.code] ?? [],
      termId: "",
    };
  }

  return cardsByCode;
}

function seedPlannerTerms(
  summary: StudentProgressSummary,
  dependencyGraph: PlannerDependencyGraph,
  cardsByCode: Record<string, PlannerComponentCard>,
): PlannerTerm[] {
  const completedCodes = summary.componentItems
    .filter((item) => item.academicStatus === "completed")
    .map((item) => item.code);
  const inProgressCodes = summary.componentItems
    .filter((item) => item.academicStatus === "inProgress")
    .map((item) => item.code);
  const remainingCodes = summary.componentItems
    .filter((item) => item.academicStatus === "review")
    .map((item) => item.code);
  const terms: PlannerTerm[] = [];
  const occupiedCodes = new Set<string>();

  if (completedCodes.length > 0) {
    const componentCodes = sortCodesBySummaryOrder(
      completedCodes,
      summary.componentItems,
    );
    terms.push({
      id: "completed",
      title: "Concluidos",
      kind: "completed",
      componentCodes,
    });
    componentCodes.forEach((code) => {
      const card = cardsByCode[code];
      if (card) {
        card.termId = "completed";
      }
      occupiedCodes.add(code);
    });
  }

  if (inProgressCodes.length > 0) {
    const componentCodes = sortCodesBySummaryOrder(
      inProgressCodes,
      summary.componentItems,
    );
    terms.push({
      id: "in-progress",
      title: "Em andamento",
      kind: "in-progress",
      componentCodes,
    });
    componentCodes.forEach((code) => {
      const card = cardsByCode[code];
      if (card) {
        card.termId = "in-progress";
      }
      occupiedCodes.add(code);
    });
  }

  let unresolvedCodes = remainingCodes.filter(
    (code) => !occupiedCodes.has(code),
  );
  const satisfiedCodes = new Set<string>([
    ...completedCodes,
    ...inProgressCodes,
  ]);
  let plannedIndex = 1;

  while (unresolvedCodes.length > 0) {
    const nextLayer = unresolvedCodes.filter((code) => {
      const prerequisites =
        dependencyGraph.prerequisiteCodesByComponentCode[code] ?? [];
      return prerequisites.every((prerequisiteCode) =>
        satisfiedCodes.has(prerequisiteCode),
      );
    });

    if (nextLayer.length === 0) {
      const componentCodes = sortCodesBySummaryOrder(
        unresolvedCodes,
        summary.componentItems,
      );
      terms.push({
        id: "review",
        title: "Revisar relacoes",
        kind: "review",
        componentCodes,
      });
      componentCodes.forEach((code) => {
        const card = cardsByCode[code];
        if (card) {
          card.termId = "review";
        }
      });
      break;
    }

    const componentCodes = sortCodesBySummaryOrder(
      nextLayer,
      summary.componentItems,
    );
    const termId = `planned-${plannedIndex}`;
    terms.push({
      id: termId,
      title: `Plano ${plannedIndex}`,
      kind: "planned",
      componentCodes,
    });
    componentCodes.forEach((code) => {
      const card = cardsByCode[code];
      if (card) {
        card.termId = termId;
      }
      satisfiedCodes.add(code);
    });
    unresolvedCodes = unresolvedCodes.filter(
      (code) => !componentCodes.includes(code),
    );
    plannedIndex += 1;
  }

  return terms;
}

function findTermContainingCode(terms: PlannerTerm[], componentCode: string) {
  return (
    terms.find((term) => term.componentCodes.includes(componentCode)) ?? null
  );
}

function matchesPlannerQuery(
  card: PlannerComponentCard,
  queryParts: string[],
): boolean {
  const haystack = normalizePlannerQuery(`${card.code} ${card.title}`);
  return queryParts.every((part) => haystack.includes(part));
}

function normalizePlannerQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sortCodesBySummaryOrder(
  codes: string[],
  summaryItems: StudentProgressSummary["componentItems"],
): string[] {
  const orderIndexByCode = new Map<string, number>(
    summaryItems.map((item, index): [string, number] => [item.code, index]),
  );

  return [...codes].sort((left, right) => {
    const leftIndex = orderIndexByCode.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndexByCode.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.localeCompare(right);
  });
}

function computeTransitiveCodes(
  componentCode: string,
  adjacencyMap: Record<string, string[]>,
): string[] {
  const visited = new Set<string>();
  const stack = [...(adjacencyMap[componentCode] ?? [])];

  while (stack.length > 0) {
    const nextCode = stack.pop();
    if (!nextCode || visited.has(nextCode)) {
      continue;
    }

    visited.add(nextCode);
    for (const childCode of adjacencyMap[nextCode] ?? []) {
      if (!visited.has(childCode)) {
        stack.push(childCode);
      }
    }
  }

  return [...visited].sort((left, right) => left.localeCompare(right));
}

function createEmptyCodeMap(codes: string[]): Record<string, string[]> {
  return Object.fromEntries(
    codes.map((code): [string, string[]] => [code, []]),
  ) as Record<string, string[]>;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function countStatuses(cardsByCode: Record<string, PlannerComponentCard>) {
  return countStatusesFromCodes(cardsByCode, Object.keys(cardsByCode));
}

function countStatusesFromCodes(
  cardsByCode: Record<string, PlannerComponentCard>,
  codes: string[],
) {
  const counts: Record<ComponentAcademicStatus, number> = {
    completed: 0,
    inProgress: 0,
    review: 0,
  };

  for (const code of codes) {
    const card = cardsByCode[code];
    if (!card) {
      continue;
    }

    counts[card.academicStatus] += 1;
  }

  return counts;
}

function countActivePlannerFilters(input: {
  query: string;
  selectedStatuses: ComponentAcademicStatus[];
  focusComponentCode: string | null;
  connectedOnly: boolean;
  showAvailableOnly: boolean;
  showScheduledOnly: boolean;
  showReviewOnly: boolean;
}) {
  const defaultStatuses = 3;
  let activeFilterCount = 0;

  if (input.query.trim().length > 0) {
    activeFilterCount += 1;
  }

  if (
    input.selectedStatuses.length > 0 &&
    input.selectedStatuses.length < defaultStatuses
  ) {
    activeFilterCount += 1;
  }

  if (input.focusComponentCode) {
    activeFilterCount += 1;
  }

  if (input.connectedOnly) {
    activeFilterCount += 1;
  }

  if (input.showAvailableOnly) {
    activeFilterCount += 1;
  }

  if (input.showScheduledOnly) {
    activeFilterCount += 1;
  }

  if (input.showReviewOnly) {
    activeFilterCount += 1;
  }

  return activeFilterCount;
}

function parsePlannerAcademicPeriod(value: string): {
  year: number;
  semester: 1 | 2;
  periodLabel: string;
} {
  const parsed = new Date(value);
  const year = Number.isNaN(parsed.getTime())
    ? new Date().getFullYear()
    : parsed.getFullYear();
  const semester: 1 | 2 = Number.isNaN(parsed.getTime())
    ? 1
    : parsed.getMonth() < 6
      ? 1
      : 2;

  return {
    year,
    semester,
    periodLabel: formatAcademicPeriod({ year, semester }),
  };
}

function advanceAcademicPeriod(
  period: { year: number; semester: 1 | 2 },
  offset: number,
) {
  let year = period.year;
  let semester: 1 | 2 = period.semester;

  for (let index = 0; index < offset; index += 1) {
    if (semester === 1) {
      semester = 2;
      continue;
    }

    year += 1;
    semester = 1;
  }

  return { year, semester };
}

function formatAcademicPeriod(period: { year: number; semester: 1 | 2 }) {
  return `${period.year}.${period.semester}`;
}

function getPlannedOrdinal(board: PlannerBoard, termIndex: number) {
  const plannedTermsBeforeCurrent = board.terms
    .slice(0, termIndex + 1)
    .filter((term) => term.kind === "planned").length;

  return plannedTermsBeforeCurrent > 0 ? plannedTermsBeforeCurrent : null;
}
