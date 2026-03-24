import type { LocalStudentSnapshotBundle } from "@formae/protocol";
import {
  loadLatestLocalStudentSnapshotBundle,
  loadLatestManualImportSnapshot,
} from "./manualSnapshotStore";
import { findCatalogMatches } from "./publicCatalog";
import { buildLocalStudentSnapshotBundle } from "./studentSnapshot";

export type LocalStudentSnapshotSource =
  | "bundle"
  | "manual-snapshot-fallback"
  | "none";

export interface LoadedLocalStudentSnapshot {
  bundle: LocalStudentSnapshotBundle | null;
  source: LocalStudentSnapshotSource;
}

export async function loadLatestProjectedStudentSnapshot(): Promise<LoadedLocalStudentSnapshot> {
  const persistedBundle = await loadLatestLocalStudentSnapshotBundle();

  if (persistedBundle) {
    return {
      bundle: persistedBundle,
      source: "bundle",
    };
  }

  const manualSnapshot = await loadLatestManualImportSnapshot();

  if (!manualSnapshot) {
    return {
      bundle: null,
      source: "none",
    };
  }

  return {
    bundle: buildLocalStudentSnapshotBundle({
      manualImport: manualSnapshot,
      matchedCatalogComponents: findCatalogMatches(
        manualSnapshot.detectedComponentCodes,
      ),
      derivedAt: manualSnapshot.savedAt,
    }),
    source: "manual-snapshot-fallback",
  };
}
