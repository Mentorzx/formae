import type { ManualImportStoredSnapshot } from "@formae/protocol";

const DATABASE_NAME = "formae-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "manual-import-snapshots";
const LATEST_SNAPSHOT_KEY = "latest";

export async function loadLatestManualImportSnapshot(): Promise<ManualImportStoredSnapshot | null> {
  const database = await openManualSnapshotDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(LATEST_SNAPSHOT_KEY);

    request.onsuccess = () => {
      resolve(
        (request.result as ManualImportStoredSnapshot | undefined) ?? null,
      );
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to read the latest manual snapshot."),
      );
    };
  });
}

export async function saveLatestManualImportSnapshot(
  snapshot: ManualImportStoredSnapshot,
): Promise<void> {
  const database = await openManualSnapshotDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snapshot, LATEST_SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to save the latest manual snapshot."),
      );
    };
  });
}

export async function clearLatestManualImportSnapshot(): Promise<void> {
  const database = await openManualSnapshotDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(LATEST_SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to clear the latest manual snapshot."),
      );
    };
  });
}

async function openManualSnapshotDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    throw new Error("IndexedDB is unavailable in this browser.");
  }

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to open the manual snapshot database."),
      );
    };
  });
}
