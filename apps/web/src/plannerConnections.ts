export interface PlannerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlannerEdge {
  sourceId: string;
  targetId: string;
}

export interface PlannerPoint {
  x: number;
  y: number;
}

export interface PlannerConnectionPath {
  id: string;
  sourceId: string;
  targetId: string;
  start: PlannerPoint;
  control1: PlannerPoint;
  control2: PlannerPoint;
  end: PlannerPoint;
  path: string;
}

export interface PlannerConnectionOptions {
  minCurveSpan?: number;
  precision?: number;
}

const DEFAULT_MIN_CURVE_SPAN = 32;
const DEFAULT_PRECISION = 2;

export function buildPlannerConnectionPaths(
  rectMap: Readonly<Record<string, PlannerRect>>,
  edges: readonly PlannerEdge[],
  options: PlannerConnectionOptions = {},
): PlannerConnectionPath[] {
  const uniqueEdges = dedupeAndSortEdges(edges);
  const connections: PlannerConnectionPath[] = [];

  for (const edge of uniqueEdges) {
    const sourceRect = rectMap[edge.sourceId];
    const targetRect = rectMap[edge.targetId];

    if (!sourceRect || !targetRect) {
      continue;
    }

    connections.push(
      buildPlannerConnectionPath(
        edge.sourceId,
        edge.targetId,
        sourceRect,
        targetRect,
        options,
      ),
    );
  }

  return connections;
}

function dedupeAndSortEdges(edges: readonly PlannerEdge[]): PlannerEdge[] {
  const seen = new Set<string>();
  const uniqueEdges: PlannerEdge[] = [];

  for (const edge of edges) {
    const normalizedEdge = {
      sourceId: edge.sourceId,
      targetId: edge.targetId,
    };
    const key = buildEdgeKey(normalizedEdge.sourceId, normalizedEdge.targetId);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueEdges.push(normalizedEdge);
  }

  return uniqueEdges.sort((left, right) =>
    buildEdgeKey(left.sourceId, left.targetId).localeCompare(
      buildEdgeKey(right.sourceId, right.targetId),
    ),
  );
}

function buildPlannerConnectionPath(
  sourceId: string,
  targetId: string,
  sourceRect: PlannerRect,
  targetRect: PlannerRect,
  options: PlannerConnectionOptions,
): PlannerConnectionPath {
  const precision = options.precision ?? DEFAULT_PRECISION;
  const sourceCenter = rectCenter(sourceRect);
  const targetCenter = rectCenter(targetRect);
  const leftToRight = targetCenter.x >= sourceCenter.x;

  const start = leftToRight
    ? point(sourceRect.x + sourceRect.width, sourceCenter.y)
    : point(sourceRect.x, sourceCenter.y);
  const end = leftToRight
    ? point(targetRect.x, targetCenter.y)
    : point(targetRect.x + targetRect.width, targetCenter.y);

  const curveSpan = Math.max(
    Math.abs(end.x - start.x) * 0.5,
    options.minCurveSpan ?? DEFAULT_MIN_CURVE_SPAN,
  );
  const control1 = leftToRight
    ? point(start.x + curveSpan, start.y)
    : point(start.x - curveSpan, start.y);
  const control2 = leftToRight
    ? point(end.x - curveSpan, end.y)
    : point(end.x + curveSpan, end.y);

  return {
    id: buildEdgeKey(sourceId, targetId),
    sourceId,
    targetId,
    start: normalizePoint(start, precision),
    control1: normalizePoint(control1, precision),
    control2: normalizePoint(control2, precision),
    end: normalizePoint(end, precision),
    path: buildCubicPath(start, control1, control2, end, precision),
  };
}

function buildEdgeKey(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function rectCenter(rect: PlannerRect): PlannerPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function point(x: number, y: number): PlannerPoint {
  return { x, y };
}

function normalizePoint(
  pointValue: PlannerPoint,
  precision: number,
): PlannerPoint {
  return {
    x: roundToPrecision(pointValue.x, precision),
    y: roundToPrecision(pointValue.y, precision),
  };
}

function buildCubicPath(
  start: PlannerPoint,
  control1: PlannerPoint,
  control2: PlannerPoint,
  end: PlannerPoint,
  precision: number,
): string {
  return [
    "M",
    formatNumber(start.x, precision),
    formatNumber(start.y, precision),
    "C",
    formatNumber(control1.x, precision),
    formatNumber(control1.y, precision),
    formatNumber(control2.x, precision),
    formatNumber(control2.y, precision),
    formatNumber(end.x, precision),
    formatNumber(end.y, precision),
  ].join(" ");
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, precision: number): string {
  const rounded = roundToPrecision(value, precision);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(precision).replace(/\.?0+$/, "");
}
