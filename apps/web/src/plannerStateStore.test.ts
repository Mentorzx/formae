import { describe, expect, it } from "vitest";

import {
  clearPlannerState,
  createDefaultPlannerState,
  loadPlannerState,
  migratePlannerState,
  savePlannerState,
  type PlannerStateStorageLike,
  updatePlannerState,
} from "./plannerStateStore";

describe("plannerStateStore", () => {
  it("returns defaults when storage is empty or invalid", () => {
    const storage = createMemoryStorage();

    expect(loadPlannerState(storage)).toEqual(createDefaultPlannerState());

    storage.setItem("formae:planner-state:v1", "{not-json");
    expect(loadPlannerState(storage)).toEqual(createDefaultPlannerState());
  });

  it("migrates legacy planner state shapes and sanitizes persisted values", () => {
    const migrated = migratePlannerState({
      compact: true,
      darkGraphFocus: 1 as unknown as boolean,
      termLabels: {
        " term-a ": "  Primeiro termo  ",
        "": "ignored",
      },
      filterDraft: {
        query: "  redes  ",
        connectedOnly: true,
        focusComponentCode: " MATA05 ",
      },
      studentNumber: "219216387" as unknown as string,
      rawAcademicPayload: {
        secret: "do-not-persist",
      } as unknown as Record<string, unknown>,
    });

    expect(migrated).toEqual({
      schemaVersion: 1,
      preferences: {
        compact: true,
        darkGraphFocus: false,
        termLabels: {
          "term-a": "Primeiro termo",
        },
        filterDraft: {
          query: "redes",
          connectedOnly: true,
          focusComponentCode: "MATA05",
        },
      },
    });
  });

  it("saves and reloads only planner preferences", () => {
    const storage = createMemoryStorage();
    const nextState = updatePlannerState(createDefaultPlannerState(), {
      compact: true,
      darkGraphFocus: true,
      termLabels: {
        "completed": "Concluídos",
        "planned-1": "Plano 1",
      },
      filterDraft: {
        query: "estruturas",
        connectedOnly: false,
        focusComponentCode: null,
      },
    });

    savePlannerState(storage, nextState);

    const persisted = JSON.parse(
      storage.getItem("formae:planner-state:v1") ?? "{}",
    ) as Record<string, unknown>;

    expect(persisted).toEqual({
      schemaVersion: 1,
      preferences: {
        compact: true,
        darkGraphFocus: true,
        termLabels: {
          completed: "Concluídos",
          "planned-1": "Plano 1",
        },
        filterDraft: {
          query: "estruturas",
          connectedOnly: false,
          focusComponentCode: null,
        },
      },
    });

    expect(loadPlannerState(storage)).toEqual(nextState);
  });

  it("clears planner state from storage", () => {
    const storage = createMemoryStorage();
    storage.setItem("formae:planner-state:v1", JSON.stringify(createDefaultPlannerState()));

    clearPlannerState(storage);

    expect(storage.getItem("formae:planner-state:v1")).toBeNull();
  });
});

function createMemoryStorage(initialValue?: string): PlannerStateStorageLike {
  const values = new Map<string, string>();
  if (typeof initialValue === "string") {
    values.set("formae:planner-state:v1", initialValue);
  }

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}
