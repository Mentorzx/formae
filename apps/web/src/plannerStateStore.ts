import type { ComponentAcademicStatus } from "./studentProgress";

export const PLANNER_STATE_STORAGE_KEY = "formae:planner-state:v1";

export interface PlannerFilterDraft {
  query: string;
  connectedOnly: boolean;
  focusComponentCode: string | null;
  selectedStatuses: ComponentAcademicStatus[];
  showAvailableOnly: boolean;
  showScheduledOnly: boolean;
  showReviewOnly: boolean;
}

export interface PlannerUiPreferences {
  compact: boolean;
  darkGraphFocus: boolean;
  termLabels: Record<string, string>;
  filterDraft: PlannerFilterDraft | null;
}

export interface PlannerState {
  schemaVersion: 1;
  preferences: PlannerUiPreferences;
}

export interface PlannerStateStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PlannerFilterDraftInput {
  query?: unknown;
  connectedOnly?: unknown;
  focusComponentCode?: unknown;
  selectedStatuses?: unknown;
  showAvailableOnly?: unknown;
  showScheduledOnly?: unknown;
  showReviewOnly?: unknown;
}

export interface PlannerStatePersistenceRecord {
  [key: string]: unknown;
  schemaVersion?: number;
  preferences?: Partial<PlannerUiPreferences>;
  compact?: boolean;
  darkGraphFocus?: boolean;
  termLabels?: Record<string, unknown>;
  filterDraft?: Record<string, unknown> | null;
}

const DEFAULT_PLANNER_STATE: PlannerState = {
  schemaVersion: 1,
  preferences: {
    compact: false,
    darkGraphFocus: false,
    termLabels: {},
    filterDraft: null,
  },
};

export function createDefaultPlannerState(): PlannerState {
  return clonePlannerState(DEFAULT_PLANNER_STATE);
}

export function loadPlannerState(
  storage: PlannerStateStorageLike = globalThis.localStorage,
  key: string = PLANNER_STATE_STORAGE_KEY,
): PlannerState {
  if (!storage) {
    return createDefaultPlannerState();
  }

  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return createDefaultPlannerState();
  }

  try {
    const parsed = JSON.parse(rawValue) as PlannerStatePersistenceRecord;
    return migratePlannerState(parsed);
  } catch {
    return createDefaultPlannerState();
  }
}

export function savePlannerState(
  storage: PlannerStateStorageLike = globalThis.localStorage,
  state: PlannerState,
  key: string = PLANNER_STATE_STORAGE_KEY,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(serializePlannerState(state)));
}

export function clearPlannerState(
  storage: PlannerStateStorageLike = globalThis.localStorage,
  key: string = PLANNER_STATE_STORAGE_KEY,
): void {
  storage?.removeItem(key);
}

export function updatePlannerState(
  state: PlannerState,
  patch: Partial<PlannerUiPreferences>,
): PlannerState {
  return normalizePlannerState({
    schemaVersion: 1,
    preferences: {
      ...state.preferences,
      ...patch,
    },
  });
}

export function migratePlannerState(
  record: PlannerStatePersistenceRecord | null | undefined,
): PlannerState {
  if (!record || typeof record !== "object") {
    return createDefaultPlannerState();
  }

  const legacyPreferences = sanitizePlannerUiPreferences({
    compact:
      typeof record.preferences?.compact === "boolean"
        ? record.preferences.compact
        : typeof record.compact === "boolean"
          ? record.compact
          : undefined,
    darkGraphFocus:
      typeof record.preferences?.darkGraphFocus === "boolean"
        ? record.preferences.darkGraphFocus
        : typeof record.darkGraphFocus === "boolean"
          ? record.darkGraphFocus
          : undefined,
    termLabels:
      record.preferences?.termLabels ??
      (isPlainObject(record.termLabels) ? record.termLabels : undefined),
    filterDraft: isPlainObject(record.preferences?.filterDraft)
      ? (record.preferences.filterDraft as PlannerFilterDraftInput)
      : isPlainObject(record.filterDraft)
        ? (record.filterDraft as PlannerFilterDraftInput)
        : null,
  });

  return normalizePlannerState({
    schemaVersion: 1,
    preferences: legacyPreferences,
  });
}

export function normalizePlannerState(state: PlannerState): PlannerState {
  return {
    schemaVersion: 1,
    preferences: sanitizePlannerUiPreferences(state.preferences),
  };
}

export function sanitizePlannerUiPreferences(
  preferences:
    | {
        compact?: unknown;
        darkGraphFocus?: unknown;
        termLabels?: Record<string, unknown> | undefined;
        filterDraft?: PlannerFilterDraftInput | null | undefined;
      }
    | null
    | undefined,
): PlannerUiPreferences {
  const compact =
    typeof preferences?.compact === "boolean" ? preferences.compact : false;
  const darkGraphFocus =
    typeof preferences?.darkGraphFocus === "boolean"
      ? preferences.darkGraphFocus
      : false;
  const termLabels = sanitizeTermLabels(preferences?.termLabels);
  const filterDraft = sanitizeFilterDraft(preferences?.filterDraft);

  return {
    compact,
    darkGraphFocus,
    termLabels,
    filterDraft,
  };
}

function sanitizeFilterDraft(
  draft: PlannerFilterDraftInput | null | undefined,
): PlannerFilterDraft | null {
  if (!draft || typeof draft !== "object") {
    return null;
  }

  const query = typeof draft.query === "string" ? draft.query.trim() : "";
  const connectedOnly = Boolean(draft.connectedOnly);
  const focusComponentCode =
    typeof draft.focusComponentCode === "string" &&
    draft.focusComponentCode.trim().length > 0
      ? draft.focusComponentCode.trim()
      : null;
  const selectedStatuses = sanitizeSelectedStatuses(draft.selectedStatuses);
  const showAvailableOnly = Boolean(draft.showAvailableOnly);
  const showScheduledOnly = Boolean(draft.showScheduledOnly);
  const showReviewOnly = Boolean(draft.showReviewOnly);

  if (
    query.length === 0 &&
    !connectedOnly &&
    !focusComponentCode &&
    selectedStatuses.length === 0 &&
    !showAvailableOnly &&
    !showScheduledOnly &&
    !showReviewOnly
  ) {
    return null;
  }

  return {
    query,
    connectedOnly,
    focusComponentCode,
    selectedStatuses,
    showAvailableOnly,
    showScheduledOnly,
    showReviewOnly,
  };
}

function sanitizeSelectedStatuses(
  selectedStatuses: unknown,
): ComponentAcademicStatus[] {
  if (!Array.isArray(selectedStatuses)) {
    return [];
  }

  const allowedStatuses: ComponentAcademicStatus[] = [
    "completed",
    "inProgress",
    "review",
  ];
  const allowedSet = new Set(allowedStatuses);

  return Array.from(
    new Set(
      selectedStatuses.flatMap((status) =>
        typeof status === "string" &&
        allowedSet.has(status as ComponentAcademicStatus)
          ? [status as ComponentAcademicStatus]
          : [],
      ),
    ),
  );
}

function sanitizeTermLabels(
  termLabels: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!termLabels || !isPlainObject(termLabels)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(termLabels).flatMap(([key, value]) => {
      const normalizedKey = key.trim();
      const normalizedValue = typeof value === "string" ? value.trim() : "";

      if (!normalizedKey || !normalizedValue) {
        return [];
      }

      return [[normalizedKey, normalizedValue] as const];
    }),
  );
}

function serializePlannerState(state: PlannerState): PlannerState {
  return normalizePlannerState({
    schemaVersion: 1,
    preferences: {
      compact: state.preferences.compact,
      darkGraphFocus: state.preferences.darkGraphFocus,
      termLabels: state.preferences.termLabels,
      filterDraft: state.preferences.filterDraft,
    },
  });
}

function clonePlannerState(state: PlannerState): PlannerState {
  return {
    schemaVersion: state.schemaVersion,
    preferences: {
      compact: state.preferences.compact,
      darkGraphFocus: state.preferences.darkGraphFocus,
      termLabels: { ...state.preferences.termLabels },
      filterDraft: state.preferences.filterDraft
        ? {
            query: state.preferences.filterDraft.query,
            connectedOnly: state.preferences.filterDraft.connectedOnly,
            focusComponentCode:
              state.preferences.filterDraft.focusComponentCode,
            selectedStatuses: [
              ...state.preferences.filterDraft.selectedStatuses,
            ],
            showAvailableOnly: state.preferences.filterDraft.showAvailableOnly,
            showScheduledOnly: state.preferences.filterDraft.showScheduledOnly,
            showReviewOnly: state.preferences.filterDraft.showReviewOnly,
          }
        : null,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
