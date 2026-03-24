import { buildPlannerConnectionPaths } from "./plannerConnections";

describe("buildPlannerConnectionPaths", () => {
  it("skips edges with missing nodes", () => {
    const result = buildPlannerConnectionPaths(
      {
        A: { x: 0, y: 0, width: 100, height: 40 },
        B: { x: 220, y: 0, width: 100, height: 40 },
      },
      [
        { sourceId: "A", targetId: "B" },
        { sourceId: "A", targetId: "C" },
        { sourceId: "Z", targetId: "A" },
      ],
    );

    expect(result).toEqual([
      {
        id: "A->B",
        sourceId: "A",
        targetId: "B",
        start: { x: 100, y: 20 },
        control1: { x: 160, y: 20 },
        control2: { x: 160, y: 20 },
        end: { x: 220, y: 20 },
        path: "M 100 20 C 160 20 160 20 220 20",
      },
    ]);
  });

  it("deduplicates repeated edges while preserving distinct directions", () => {
    const result = buildPlannerConnectionPaths(
      {
        A: { x: 0, y: 0, width: 100, height: 40 },
        B: { x: 220, y: 0, width: 100, height: 40 },
      },
      [
        { sourceId: "A", targetId: "B" },
        { sourceId: "A", targetId: "B" },
        { sourceId: "B", targetId: "A" },
      ],
    );

    expect(result).toEqual([
      {
        id: "A->B",
        sourceId: "A",
        targetId: "B",
        start: { x: 100, y: 20 },
        control1: { x: 160, y: 20 },
        control2: { x: 160, y: 20 },
        end: { x: 220, y: 20 },
        path: "M 100 20 C 160 20 160 20 220 20",
      },
      {
        id: "B->A",
        sourceId: "B",
        targetId: "A",
        start: { x: 220, y: 20 },
        control1: { x: 160, y: 20 },
        control2: { x: 160, y: 20 },
        end: { x: 100, y: 20 },
        path: "M 220 20 C 160 20 160 20 100 20",
      },
    ]);
  });

  it("returns connections in deterministic sorted order", () => {
    const rects = {
      A: { x: 0, y: 0, width: 100, height: 40 },
      B: { x: 220, y: 0, width: 100, height: 40 },
      C: { x: 440, y: 0, width: 100, height: 40 },
    };

    const result = buildPlannerConnectionPaths(rects, [
      { sourceId: "C", targetId: "B" },
      { sourceId: "A", targetId: "C" },
      { sourceId: "A", targetId: "B" },
    ]);

    expect(result.map((connection) => connection.id)).toEqual([
      "A->B",
      "A->C",
      "C->B",
    ]);
  });
});
