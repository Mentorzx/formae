import type {
  LocalStudentSnapshotBundle,
  ManualImportStoredSnapshot,
} from "@formae/protocol";

const DATABASE_NAME = "formae-local";
const DATABASE_VERSION = 2;
const LEGACY_STORE_NAME = "manual-import-snapshots";
const VAULT_STATE_STORE_NAME = "vault-state";
const VAULT_RECORD_STORE_NAME = "vault-records";
const VAULT_KEY_STORE_NAME = "vault-keys";
const ACTIVE_VAULT_STATE_KEY = "active";
const LATEST_SNAPSHOT_KEY = "latest";
const DEVICE_LOCAL_KEY_ID = "device-local-v1";
const CURRENT_VAULT_STORAGE_VERSION = 3;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
type VaultPayloadKind =
  | "manualImportStoredSnapshot"
  | "localStudentSnapshotBundle";
type VaultPayload = ManualImportStoredSnapshot | LocalStudentSnapshotBundle;

export type ManualImportVaultStatus = "empty" | "sealed";
export type ManualImportVaultWipeReason =
  | "manual-clear"
  | "logout"
  | "legacy-migration";
export type ManualImportVaultMigrationSource = "legacy-cleartext-store";

export interface ManualImportVaultState {
  schemaVersion: 1;
  storageVersion: number;
  status: ManualImportVaultStatus;
  payloadKind: VaultPayloadKind | null;
  keyDerivation: "device-local";
  keyId: string | null;
  updatedAt: string | null;
  lastWipeAt: string | null;
  lastWipeReason: ManualImportVaultWipeReason | null;
  migrationSource: ManualImportVaultMigrationSource | null;
}

interface ManualImportVaultRecord {
  schemaVersion: 1;
  payloadKind: VaultPayloadKind;
  algorithm: "AES-GCM";
  keyDerivation: "device-local";
  keyId: string;
  aadContext: string;
  ivB64: string;
  ciphertextB64: string;
  updatedAt: string;
}

export async function loadLatestManualImportSnapshot(): Promise<ManualImportStoredSnapshot | null> {
  const database = await openManualSnapshotDatabase();
  await migrateLegacySnapshotIfNeeded(database);

  const vaultRecord = await readVaultRecord(database);

  if (!vaultRecord) {
    return null;
  }

  const encryptionKey = await readVaultKey(database, vaultRecord.keyId);

  if (!encryptionKey) {
    throw new Error(
      "Local vault key is missing for the sealed manual snapshot.",
    );
  }

  if (vaultRecord.payloadKind === "manualImportStoredSnapshot") {
    return openManualImportSnapshotFromVault(vaultRecord, encryptionKey);
  }

  const bundle = await openLocalStudentSnapshotBundleFromVault(
    vaultRecord,
    encryptionKey,
  );

  return bundle.manualImport;
}

export async function saveLatestManualImportSnapshot(
  snapshot: ManualImportStoredSnapshot,
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  const { key, keyId } = await ensureDeviceLocalKey(database);
  const vaultRecord = await sealManualImportSnapshotForVault(
    snapshot,
    key,
    keyId,
  );
  const vaultState = buildSealedVaultState(vaultRecord);

  await writeSealedVault(database, vaultRecord, vaultState, key, keyId);

  return vaultState;
}

export async function loadLatestLocalStudentSnapshotBundle(): Promise<LocalStudentSnapshotBundle | null> {
  const database = await openManualSnapshotDatabase();
  await migrateLegacySnapshotIfNeeded(database);

  const vaultRecord = await readVaultRecord(database);

  if (
    !vaultRecord ||
    vaultRecord.payloadKind !== "localStudentSnapshotBundle"
  ) {
    return null;
  }

  const encryptionKey = await readVaultKey(database, vaultRecord.keyId);

  if (!encryptionKey) {
    throw new Error(
      "Local vault key is missing for the sealed student snapshot bundle.",
    );
  }

  return openLocalStudentSnapshotBundleFromVault(vaultRecord, encryptionKey);
}

export async function saveLatestLocalStudentSnapshotBundle(
  bundle: LocalStudentSnapshotBundle,
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  const { key, keyId } = await ensureDeviceLocalKey(database);
  const vaultRecord = await sealLocalStudentSnapshotBundleForVault(
    bundle,
    key,
    keyId,
  );
  const vaultState = buildSealedVaultState(vaultRecord);

  await writeSealedVault(database, vaultRecord, vaultState, key, keyId);

  return vaultState;
}

export async function clearLatestManualImportSnapshot(
  reason: ManualImportVaultWipeReason = "manual-clear",
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  const wipedAt = new Date().toISOString();
  const vaultState = buildEmptyVaultState({
    lastWipeAt: wipedAt,
    lastWipeReason: reason,
  });

  await clearVault(database, vaultState);

  return vaultState;
}

export async function loadManualImportVaultState(): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  await migrateLegacySnapshotIfNeeded(database);

  return (await readVaultState(database)) ?? buildEmptyVaultState();
}

export async function sealManualImportSnapshotForVault(
  snapshot: ManualImportStoredSnapshot,
  encryptionKey: CryptoKey,
  keyId = DEVICE_LOCAL_KEY_ID,
): Promise<ManualImportVaultRecord> {
  return sealPayloadForVault({
    payload: snapshot,
    payloadKind: "manualImportStoredSnapshot",
    updatedAt: snapshot.savedAt,
    aadContext: buildManualSnapshotAadContext(snapshot),
    encryptionKey,
    keyId,
  });
}

export async function sealLocalStudentSnapshotBundleForVault(
  bundle: LocalStudentSnapshotBundle,
  encryptionKey: CryptoKey,
  keyId = DEVICE_LOCAL_KEY_ID,
): Promise<ManualImportVaultRecord> {
  return sealPayloadForVault({
    payload: bundle,
    payloadKind: "localStudentSnapshotBundle",
    updatedAt: bundle.derivedAt,
    aadContext: buildLocalStudentSnapshotBundleAadContext(bundle),
    encryptionKey,
    keyId,
  });
}

async function sealPayloadForVault({
  payload,
  payloadKind,
  updatedAt,
  aadContext,
  encryptionKey,
  keyId,
}: {
  payload: VaultPayload;
  payloadKind: VaultPayloadKind;
  updatedAt: string;
  aadContext: string;
  encryptionKey: CryptoKey;
  keyId: string;
}): Promise<ManualImportVaultRecord> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await encryptJsonPayload(
    payload,
    encryptionKey,
    iv,
    aadContext,
  );

  return {
    schemaVersion: 1,
    payloadKind,
    algorithm: "AES-GCM",
    keyDerivation: "device-local",
    keyId,
    aadContext,
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(ciphertext),
    updatedAt,
  };
}

export async function openManualImportSnapshotFromVault(
  vaultRecord: ManualImportVaultRecord,
  encryptionKey: CryptoKey,
): Promise<ManualImportStoredSnapshot> {
  const plaintext = await decryptJsonPayload<ManualImportStoredSnapshot>(
    vaultRecord,
    encryptionKey,
  );

  if (plaintext.schemaVersion !== 1) {
    throw new Error(
      `Unsupported manual snapshot schema version: ${plaintext.schemaVersion}.`,
    );
  }

  return normalizeManualImportStoredSnapshot(plaintext);
}

export async function openLocalStudentSnapshotBundleFromVault(
  vaultRecord: ManualImportVaultRecord,
  encryptionKey: CryptoKey,
): Promise<LocalStudentSnapshotBundle> {
  const plaintext = await decryptJsonPayload<LocalStudentSnapshotBundle>(
    vaultRecord,
    encryptionKey,
  );

  if (plaintext.schemaVersion !== 1) {
    throw new Error(
      `Unsupported student snapshot bundle schema version: ${plaintext.schemaVersion}.`,
    );
  }

  return {
    ...plaintext,
    manualImport: normalizeManualImportStoredSnapshot(plaintext.manualImport),
  };
}

function buildSealedVaultState(
  vaultRecord: ManualImportVaultRecord,
  migrationSource: ManualImportVaultMigrationSource | null = null,
): ManualImportVaultState {
  return {
    schemaVersion: 1,
    storageVersion: CURRENT_VAULT_STORAGE_VERSION,
    status: "sealed",
    payloadKind: vaultRecord.payloadKind,
    keyDerivation: vaultRecord.keyDerivation,
    keyId: vaultRecord.keyId,
    updatedAt: vaultRecord.updatedAt,
    lastWipeAt: null,
    lastWipeReason: null,
    migrationSource,
  };
}

function buildEmptyVaultState(
  overrides: Partial<ManualImportVaultState> = {},
): ManualImportVaultState {
  return {
    schemaVersion: 1,
    storageVersion: CURRENT_VAULT_STORAGE_VERSION,
    status: "empty",
    payloadKind: null,
    keyDerivation: "device-local",
    keyId: null,
    updatedAt: null,
    lastWipeAt: null,
    lastWipeReason: null,
    migrationSource: null,
    ...overrides,
  };
}

function buildManualSnapshotAadContext(
  snapshot: ManualImportStoredSnapshot,
): string {
  return `formae:manual-import:${snapshot.timingProfileId}:${snapshot.snapshotId}`;
}

function buildLocalStudentSnapshotBundleAadContext(
  bundle: LocalStudentSnapshotBundle,
): string {
  return `formae:student-snapshot:${bundle.manualImport.timingProfileId}:${bundle.manualImport.snapshotId}`;
}

function normalizeManualImportStoredSnapshot(
  snapshot: ManualImportStoredSnapshot,
): ManualImportStoredSnapshot {
  return {
    ...snapshot,
    preferredCurriculumSeedId: snapshot.preferredCurriculumSeedId ?? null,
  };
}

async function migrateLegacySnapshotIfNeeded(
  database: IDBDatabase,
): Promise<void> {
  const currentRecord = await readVaultRecord(database);

  if (currentRecord) {
    return;
  }

  const legacySnapshot = await readLegacySnapshot(database);

  if (!legacySnapshot) {
    return;
  }

  const { key, keyId } = await ensureDeviceLocalKey(database);
  const vaultRecord = await sealManualImportSnapshotForVault(
    legacySnapshot,
    key,
    keyId,
  );
  const vaultState = buildSealedVaultState(
    vaultRecord,
    "legacy-cleartext-store",
  );

  await writeMigratedVault(database, vaultRecord, vaultState, key, keyId);
}

async function ensureDeviceLocalKey(
  database: IDBDatabase,
): Promise<{ key: CryptoKey; keyId: string }> {
  assertSubtleCrypto();

  const existingKey = await readVaultKey(database, DEVICE_LOCAL_KEY_ID);

  if (existingKey) {
    return { key: existingKey, keyId: DEVICE_LOCAL_KEY_ID };
  }

  const generatedKey = await globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  await writeVaultKey(database, DEVICE_LOCAL_KEY_ID, generatedKey);

  return { key: generatedKey, keyId: DEVICE_LOCAL_KEY_ID };
}

async function encryptJsonPayload(
  payload: VaultPayload,
  encryptionKey: CryptoKey,
  iv: Uint8Array,
  aadContext: string,
): Promise<Uint8Array> {
  assertSubtleCrypto();

  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(aadContext),
    },
    encryptionKey,
    plaintext,
  );

  return new Uint8Array(ciphertext);
}

async function decryptJsonPayload<TPayload>(
  vaultRecord: ManualImportVaultRecord,
  encryptionKey: CryptoKey,
): Promise<TPayload> {
  assertSubtleCrypto();

  const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(vaultRecord.ivB64),
      additionalData: textEncoder.encode(vaultRecord.aadContext),
    },
    encryptionKey,
    base64ToBytes(vaultRecord.ciphertextB64),
  );

  return JSON.parse(textDecoder.decode(plaintextBuffer)) as TPayload;
}

async function readLegacySnapshot(
  database: IDBDatabase,
): Promise<ManualImportStoredSnapshot | null> {
  if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LEGACY_STORE_NAME, "readonly");
    const store = transaction.objectStore(LEGACY_STORE_NAME);
    const request = store.get(LATEST_SNAPSHOT_KEY);

    request.onsuccess = () => {
      resolve(
        (request.result as ManualImportStoredSnapshot | undefined) ?? null,
      );
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to read the legacy manual snapshot store."),
      );
    };
  });
}

async function readVaultState(
  database: IDBDatabase,
): Promise<ManualImportVaultState | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_STATE_STORE_NAME,
      "readonly",
    );
    const store = transaction.objectStore(VAULT_STATE_STORE_NAME);
    const request = store.get(ACTIVE_VAULT_STATE_KEY);

    request.onsuccess = () => {
      resolve((request.result as ManualImportVaultState | undefined) ?? null);
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error("Failed to read the local vault state."),
      );
    };
  });
}

async function readVaultRecord(
  database: IDBDatabase,
): Promise<ManualImportVaultRecord | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_RECORD_STORE_NAME,
      "readonly",
    );
    const store = transaction.objectStore(VAULT_RECORD_STORE_NAME);
    const request = store.get(LATEST_SNAPSHOT_KEY);

    request.onsuccess = () => {
      resolve((request.result as ManualImportVaultRecord | undefined) ?? null);
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to read the sealed manual snapshot."),
      );
    };
  });
}

async function readVaultKey(
  database: IDBDatabase,
  keyId: string,
): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VAULT_KEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(VAULT_KEY_STORE_NAME);
    const request = store.get(keyId);

    request.onsuccess = () => {
      resolve((request.result as CryptoKey | undefined) ?? null);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read the local vault key."));
    };
  });
}

async function writeVaultKey(
  database: IDBDatabase,
  keyId: string,
  encryptionKey: CryptoKey,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VAULT_KEY_STORE_NAME, "readwrite");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error("Failed to write the local vault key."),
      );
    };

    const store = transaction.objectStore(VAULT_KEY_STORE_NAME);
    store.put(encryptionKey, keyId);
  });
}

async function writeSealedVault(
  database: IDBDatabase,
  vaultRecord: ManualImportVaultRecord,
  vaultState: ManualImportVaultState,
  encryptionKey: CryptoKey,
  keyId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [VAULT_STATE_STORE_NAME, VAULT_RECORD_STORE_NAME, VAULT_KEY_STORE_NAME],
      "readwrite",
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error(
            "Failed to write the sealed manual snapshot into the local vault.",
          ),
      );
    };

    transaction
      .objectStore(VAULT_STATE_STORE_NAME)
      .put(vaultState, ACTIVE_VAULT_STATE_KEY);
    transaction
      .objectStore(VAULT_RECORD_STORE_NAME)
      .put(vaultRecord, LATEST_SNAPSHOT_KEY);
    transaction.objectStore(VAULT_KEY_STORE_NAME).put(encryptionKey, keyId);
  });
}

async function writeMigratedVault(
  database: IDBDatabase,
  vaultRecord: ManualImportVaultRecord,
  vaultState: ManualImportVaultState,
  encryptionKey: CryptoKey,
  keyId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [
        LEGACY_STORE_NAME,
        VAULT_STATE_STORE_NAME,
        VAULT_RECORD_STORE_NAME,
        VAULT_KEY_STORE_NAME,
      ],
      "readwrite",
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error(
            "Failed to migrate the legacy manual snapshot into the local vault.",
          ),
      );
    };

    transaction.objectStore(LEGACY_STORE_NAME).delete(LATEST_SNAPSHOT_KEY);
    transaction
      .objectStore(VAULT_STATE_STORE_NAME)
      .put(vaultState, ACTIVE_VAULT_STATE_KEY);
    transaction
      .objectStore(VAULT_RECORD_STORE_NAME)
      .put(vaultRecord, LATEST_SNAPSHOT_KEY);
    transaction.objectStore(VAULT_KEY_STORE_NAME).put(encryptionKey, keyId);
  });
}

async function clearVault(
  database: IDBDatabase,
  vaultState: ManualImportVaultState,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const storeNames = database.objectStoreNames.contains(LEGACY_STORE_NAME)
      ? [
          LEGACY_STORE_NAME,
          VAULT_STATE_STORE_NAME,
          VAULT_RECORD_STORE_NAME,
          VAULT_KEY_STORE_NAME,
        ]
      : [VAULT_STATE_STORE_NAME, VAULT_RECORD_STORE_NAME, VAULT_KEY_STORE_NAME];
    const transaction = database.transaction(storeNames, "readwrite");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error("Failed to clear the local manual-import vault."),
      );
    };

    if (database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      transaction.objectStore(LEGACY_STORE_NAME).delete(LATEST_SNAPSHOT_KEY);
    }

    transaction
      .objectStore(VAULT_RECORD_STORE_NAME)
      .delete(LATEST_SNAPSHOT_KEY);
    transaction.objectStore(VAULT_KEY_STORE_NAME).delete(DEVICE_LOCAL_KEY_ID);
    transaction
      .objectStore(VAULT_STATE_STORE_NAME)
      .put(vaultState, ACTIVE_VAULT_STATE_KEY);
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

      if (!database.objectStoreNames.contains(VAULT_STATE_STORE_NAME)) {
        database.createObjectStore(VAULT_STATE_STORE_NAME);
      }

      if (!database.objectStoreNames.contains(VAULT_RECORD_STORE_NAME)) {
        database.createObjectStore(VAULT_RECORD_STORE_NAME);
      }

      if (!database.objectStoreNames.contains(VAULT_KEY_STORE_NAME)) {
        database.createObjectStore(VAULT_KEY_STORE_NAME);
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (const [index, char] of Array.from(binary).entries()) {
    bytes[index] = char.charCodeAt(0);
  }

  return bytes;
}

function requestError(transaction: IDBTransaction): DOMException | null {
  return transaction.error ?? null;
}

function assertSubtleCrypto(): void {
  if (!("crypto" in globalThis) || !("subtle" in globalThis.crypto)) {
    throw new Error("Web Crypto is unavailable in this browser.");
  }
}
