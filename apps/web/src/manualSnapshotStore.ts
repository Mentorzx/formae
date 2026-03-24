import type {
  LocalStudentSnapshotBundle,
  ManualImportStoredSnapshot,
} from "@formae/protocol";
import {
  clearVaultPasskeySession,
  createVaultPasskeyCredential,
  defaultVaultPasskeyLabel,
  getVaultPasskeySessionKeyMaterialMode,
  getVaultPasskeySessionWrappingKey,
  getVaultPasskeySupportReason,
  isVaultPasskeySessionUnlocked,
  type VaultPasskeyCredentialConfig,
  verifyVaultPasskeyCredential,
} from "./vaultPasskey";

const DATABASE_NAME = "formae-local";
const DATABASE_VERSION = 4;
const LEGACY_STORE_NAME = "manual-import-snapshots";
const VAULT_STATE_STORE_NAME = "vault-state";
const VAULT_RECORD_STORE_NAME = "vault-records";
const VAULT_KEY_STORE_NAME = "vault-keys";
const VAULT_WRAP_SECRET_STORE_NAME = "vault-wrap-secrets";
const VAULT_PASSKEY_STORE_NAME = "vault-passkey";
const ACTIVE_VAULT_STATE_KEY = "active";
const LATEST_SNAPSHOT_KEY = "latest";
const ACTIVE_VAULT_PASSKEY_KEY = "active";
const LEGACY_DEVICE_LOCAL_KEY_ID = "device-local-v1";
const BROWSER_WRAP_KEY_ID = "browser-wrap-v1";
const WRAP_SECRET_RECORD_KEY = "active";
const CONTENT_KEY_RECORD_KEY = "active";
const CURRENT_VAULT_STORAGE_VERSION = 4;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
type VaultPayloadKind =
  | "manualImportStoredSnapshot"
  | "localStudentSnapshotBundle";
type VaultPayload = ManualImportStoredSnapshot | LocalStudentSnapshotBundle;
type VaultKeyDerivationMode =
  | "device-local"
  | "browser-local-wrap"
  | "webauthn-prf";

export type ManualImportVaultStatus = "empty" | "sealed";
export type ManualImportVaultWipeReason =
  | "manual-clear"
  | "logout"
  | "legacy-migration";
export type ManualImportVaultMigrationSource = "legacy-cleartext-store";
export type ManualImportVaultPasskeySessionStatus =
  | "unsupported"
  | "not-configured"
  | "locked"
  | "unlocked";

export interface ManualImportVaultState {
  schemaVersion: 1;
  storageVersion: number;
  status: ManualImportVaultStatus;
  payloadKind: VaultPayloadKind | null;
  keyDerivation: VaultKeyDerivationMode;
  keyId: string | null;
  updatedAt: string | null;
  lastWipeAt: string | null;
  lastWipeReason: ManualImportVaultWipeReason | null;
  migrationSource: ManualImportVaultMigrationSource | null;
}

export interface ManualImportVaultPasskeyState {
  supported: boolean;
  supportReason: string | null;
  configured: boolean;
  sessionStatus: ManualImportVaultPasskeySessionStatus;
  keyMaterialMode: VaultKeyDerivationMode | null;
  displayName: string | null;
  rpId: string | null;
  createdAt: string | null;
  lastVerifiedAt: string | null;
}

interface ManualImportVaultRecord {
  schemaVersion: 1;
  payloadKind: VaultPayloadKind;
  algorithm: "AES-GCM";
  keyDerivation: VaultKeyDerivationMode;
  contentKeyId: string;
  aadContext: string;
  ivB64: string;
  ciphertextB64: string;
  updatedAt: string;
}

interface VaultWrapSecretRecord {
  schemaVersion: 1;
  secretId: string;
  contentKeyId: string;
  wrappedContentKeyB64: string;
  prfWrappedContentKeyB64: string | null;
  keyDerivation: VaultKeyDerivationMode;
  updatedAt: string;
}

export class VaultLockedError extends Error {
  constructor() {
    super(
      "O vault local esta bloqueado por passkey. Desbloqueie a sessao antes de acessar ou alterar os snapshots.",
    );
    this.name = "VaultLockedError";
  }
}

export function isVaultLockedError(error: unknown): error is VaultLockedError {
  return error instanceof VaultLockedError;
}

export async function loadLatestManualImportSnapshot(): Promise<ManualImportStoredSnapshot | null> {
  const database = await openManualSnapshotDatabase();
  await migrateLegacySnapshotIfNeeded(database);
  await assertVaultUnlockedIfRequired(database);
  await ensureVaultMaterial(database);

  const vaultRecord = await readVaultRecord(database);

  if (!vaultRecord) {
    return null;
  }

  const { contentKey } = await resolveVaultContentKeyMaterial(database);

  if (vaultRecord.payloadKind === "manualImportStoredSnapshot") {
    return openManualImportSnapshotFromVault(vaultRecord, contentKey);
  }

  const bundle = await openLocalStudentSnapshotBundleFromVault(
    vaultRecord,
    contentKey,
  );

  return bundle.manualImport;
}

export async function saveLatestManualImportSnapshot(
  snapshot: ManualImportStoredSnapshot,
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  await assertVaultUnlockedIfRequired(database);
  const { contentKey, keyDerivation, contentKeyId } =
    await resolveVaultContentKeyMaterial(database, "write");
  const vaultRecord = await sealManualImportSnapshotForVault(
    snapshot,
    contentKey,
    contentKeyId,
    keyDerivation,
  );
  const vaultState = buildSealedVaultState(vaultRecord);

  await writeSealedVault(database, vaultRecord, vaultState);

  return vaultState;
}

export async function loadLatestLocalStudentSnapshotBundle(): Promise<LocalStudentSnapshotBundle | null> {
  const database = await openManualSnapshotDatabase();
  await migrateLegacySnapshotIfNeeded(database);
  await assertVaultUnlockedIfRequired(database);
  await ensureVaultMaterial(database);

  const vaultRecord = await readVaultRecord(database);

  if (
    !vaultRecord ||
    vaultRecord.payloadKind !== "localStudentSnapshotBundle"
  ) {
    return null;
  }

  const { contentKey } = await resolveVaultContentKeyMaterial(database);

  return openLocalStudentSnapshotBundleFromVault(vaultRecord, contentKey);
}

export async function saveLatestLocalStudentSnapshotBundle(
  bundle: LocalStudentSnapshotBundle,
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  await assertVaultUnlockedIfRequired(database);
  const { contentKey, keyDerivation, contentKeyId } =
    await resolveVaultContentKeyMaterial(database, "write");
  const vaultRecord = await sealLocalStudentSnapshotBundleForVault(
    bundle,
    contentKey,
    contentKeyId,
    keyDerivation,
  );
  const vaultState = buildSealedVaultState(vaultRecord);

  await writeSealedVault(database, vaultRecord, vaultState);

  return vaultState;
}

export async function clearLatestManualImportSnapshot(
  reason: ManualImportVaultWipeReason = "manual-clear",
): Promise<ManualImportVaultState> {
  const database = await openManualSnapshotDatabase();
  await assertVaultUnlockedIfRequired(database);
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

export async function loadManualImportVaultPasskeyState(): Promise<ManualImportVaultPasskeyState> {
  const database = await openManualSnapshotDatabase();
  const config = await readVaultPasskeyConfig(database);

  return buildManualImportVaultPasskeyState(
    config,
    await resolveReportedVaultPasskeyKeyMaterialMode(database, config),
  );
}

export async function enableManualImportVaultPasskey(
  displayName = defaultVaultPasskeyLabel(),
): Promise<ManualImportVaultPasskeyState> {
  const database = await openManualSnapshotDatabase();
  const config = await createVaultPasskeyCredential(displayName);

  await writeVaultPasskeyConfig(database, config);
  await ensureVaultMaterial(database);

  return buildManualImportVaultPasskeyState(
    config,
    await resolveReportedVaultPasskeyKeyMaterialMode(database, config),
  );
}

export async function unlockManualImportVaultPasskey(): Promise<ManualImportVaultPasskeyState> {
  const database = await openManualSnapshotDatabase();
  const config = await readVaultPasskeyConfig(database);

  if (!config) {
    return buildManualImportVaultPasskeyState(null, null);
  }

  const verifiedConfig = await verifyVaultPasskeyCredential(config);
  await writeVaultPasskeyConfig(database, verifiedConfig);
  await ensureVaultMaterial(database);

  return buildManualImportVaultPasskeyState(
    verifiedConfig,
    await resolveReportedVaultPasskeyKeyMaterialMode(database, verifiedConfig),
  );
}

export async function lockManualImportVaultSession(): Promise<ManualImportVaultPasskeyState> {
  const database = await openManualSnapshotDatabase();
  const config = await readVaultPasskeyConfig(database);

  clearVaultPasskeySession();

  return buildManualImportVaultPasskeyState(
    config,
    await resolveReportedVaultPasskeyKeyMaterialMode(database, config),
  );
}

export async function disableManualImportVaultPasskey(): Promise<ManualImportVaultPasskeyState> {
  const database = await openManualSnapshotDatabase();
  await assertVaultUnlockedIfRequired(database);

  clearVaultPasskeySession();
  await deleteVaultPasskeyConfig(database);

  return buildManualImportVaultPasskeyState(null, null);
}

export async function sealManualImportSnapshotForVault(
  snapshot: ManualImportStoredSnapshot,
  encryptionKey: CryptoKey,
  keyId = CONTENT_KEY_RECORD_KEY,
  keyDerivation: VaultKeyDerivationMode = "browser-local-wrap",
): Promise<ManualImportVaultRecord> {
  return sealPayloadForVault({
    payload: snapshot,
    payloadKind: "manualImportStoredSnapshot",
    updatedAt: snapshot.savedAt,
    aadContext: buildManualSnapshotAadContext(snapshot),
    encryptionKey,
    keyId,
    keyDerivation,
  });
}

export async function sealLocalStudentSnapshotBundleForVault(
  bundle: LocalStudentSnapshotBundle,
  encryptionKey: CryptoKey,
  keyId = CONTENT_KEY_RECORD_KEY,
  keyDerivation: VaultKeyDerivationMode = "browser-local-wrap",
): Promise<ManualImportVaultRecord> {
  return sealPayloadForVault({
    payload: bundle,
    payloadKind: "localStudentSnapshotBundle",
    updatedAt: bundle.derivedAt,
    aadContext: buildLocalStudentSnapshotBundleAadContext(bundle),
    encryptionKey,
    keyId,
    keyDerivation,
  });
}

async function sealPayloadForVault({
  payload,
  payloadKind,
  updatedAt,
  aadContext,
  encryptionKey,
  keyId,
  keyDerivation,
}: {
  payload: VaultPayload;
  payloadKind: VaultPayloadKind;
  updatedAt: string;
  aadContext: string;
  encryptionKey: CryptoKey;
  keyId: string;
  keyDerivation: VaultKeyDerivationMode;
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
    keyDerivation,
    contentKeyId: keyId,
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
    keyId: vaultRecord.contentKeyId,
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
    keyDerivation: "browser-local-wrap",
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
    retentionMode: snapshot.retentionMode ?? "full-raw-text",
    preferredCurriculumSeedId: snapshot.preferredCurriculumSeedId ?? null,
    structuredContext: snapshot.structuredContext ?? null,
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

  await ensureVaultMaterial(database);
  const { contentKey, keyDerivation, contentKeyId } =
    await resolveVaultContentKeyMaterial(database);
  const vaultRecord = await sealManualImportSnapshotForVault(
    legacySnapshot,
    contentKey,
    contentKeyId,
    keyDerivation,
  );
  const vaultState = buildSealedVaultState(
    vaultRecord,
    "legacy-cleartext-store",
  );

  await writeMigratedVault(database, vaultRecord, vaultState);
}

async function ensureVaultMaterial(
  database: IDBDatabase,
): Promise<VaultWrapSecretRecord | null> {
  const browserWrapKey = await ensureBrowserWrapKey(database);
  const existingRecord = await readVaultWrapSecretRecord(database);
  const prfWrappingKey = getVaultPasskeySessionWrappingKey();

  if (!existingRecord) {
    const contentKeyBytes = randomBytes(32);
    const browserWrappedContentKeyB64 = await wrapContentKeyBytes(
      browserWrapKey.key,
      contentKeyBytes,
      buildVaultWrapAadContext(CONTENT_KEY_RECORD_KEY, "browser-local-wrap"),
    );
    const prfWrappedContentKeyB64 = prfWrappingKey
      ? await wrapContentKeyBytes(
          prfWrappingKey,
          contentKeyBytes,
          buildVaultWrapAadContext(CONTENT_KEY_RECORD_KEY, "webauthn-prf"),
        )
      : null;
    const record: VaultWrapSecretRecord = {
      schemaVersion: 1,
      secretId: WRAP_SECRET_RECORD_KEY,
      contentKeyId: CONTENT_KEY_RECORD_KEY,
      wrappedContentKeyB64: browserWrappedContentKeyB64,
      prfWrappedContentKeyB64,
      keyDerivation: prfWrappedContentKeyB64
        ? "webauthn-prf"
        : "browser-local-wrap",
      updatedAt: new Date().toISOString(),
    };

    await writeVaultWrapSecretRecord(database, record);

    return record;
  }

  if (prfWrappingKey && !existingRecord.prfWrappedContentKeyB64) {
    const contentKeyBytes = await unwrapWrappedContentKeyBytes(
      browserWrapKey.key,
      existingRecord.wrappedContentKeyB64,
      buildVaultWrapAadContext(
        existingRecord.contentKeyId,
        "browser-local-wrap",
      ),
    );
    const prfWrappedContentKeyB64 = await wrapContentKeyBytes(
      prfWrappingKey,
      contentKeyBytes,
      buildVaultWrapAadContext(existingRecord.contentKeyId, "webauthn-prf"),
    );
    const updatedRecord: VaultWrapSecretRecord = {
      ...existingRecord,
      prfWrappedContentKeyB64,
      keyDerivation: "webauthn-prf",
      updatedAt: new Date().toISOString(),
    };

    await writeVaultWrapSecretRecord(database, updatedRecord);

    return updatedRecord;
  }

  return existingRecord;
}

async function resolveVaultContentKeyMaterial(
  database: IDBDatabase,
  _mode: "read" | "write" = "read",
): Promise<{
  contentKey: CryptoKey;
  contentKeyId: string;
  keyDerivation: VaultKeyDerivationMode;
}> {
  const wrapSecretRecord = await ensureVaultMaterial(database);

  if (wrapSecretRecord) {
    const prfWrappingKey = getVaultPasskeySessionWrappingKey();

    if (prfWrappingKey && wrapSecretRecord.prfWrappedContentKeyB64) {
      const rawContentKey = await unwrapWrappedContentKeyBytes(
        prfWrappingKey,
        wrapSecretRecord.prfWrappedContentKeyB64,
        buildVaultWrapAadContext(wrapSecretRecord.contentKeyId, "webauthn-prf"),
      );
      const contentKey = await importContentKey(rawContentKey);

      return {
        contentKey,
        contentKeyId: wrapSecretRecord.contentKeyId,
        keyDerivation: "webauthn-prf",
      };
    }

    const browserWrapKey = await ensureBrowserWrapKey(database);
    const rawContentKey = await unwrapWrappedContentKeyBytes(
      browserWrapKey.key,
      wrapSecretRecord.wrappedContentKeyB64,
      buildVaultWrapAadContext(
        wrapSecretRecord.contentKeyId,
        "browser-local-wrap",
      ),
    );
    const contentKey = await importContentKey(rawContentKey);

    return {
      contentKey,
      contentKeyId: wrapSecretRecord.contentKeyId,
      keyDerivation: "browser-local-wrap",
    };
  }

  const currentVaultRecord = await readVaultRecord(database);

  if (currentVaultRecord) {
    const legacyContentKey = await readVaultKey(
      database,
      currentVaultRecord.contentKeyId,
    );

    if (legacyContentKey) {
      return {
        contentKey: legacyContentKey,
        contentKeyId: currentVaultRecord.contentKeyId,
        keyDerivation: currentVaultRecord.keyDerivation,
      };
    }
  }

  throw new Error("Failed to resolve the wrapped local vault key material.");
}

async function ensureBrowserWrapKey(
  database: IDBDatabase,
): Promise<{ key: CryptoKey; keyId: string }> {
  assertSubtleCrypto();

  const existingKey = await readVaultKey(database, BROWSER_WRAP_KEY_ID);

  if (existingKey) {
    return { key: existingKey, keyId: BROWSER_WRAP_KEY_ID };
  }

  const generatedKey = await globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  await writeVaultKey(database, BROWSER_WRAP_KEY_ID, generatedKey);

  return { key: generatedKey, keyId: BROWSER_WRAP_KEY_ID };
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
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(textEncoder.encode(aadContext)),
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
      iv: asArrayBuffer(base64ToBytes(vaultRecord.ivB64)),
      additionalData: asArrayBuffer(textEncoder.encode(vaultRecord.aadContext)),
    },
    encryptionKey,
    asArrayBuffer(base64ToBytes(vaultRecord.ciphertextB64)),
  );

  return JSON.parse(textDecoder.decode(plaintextBuffer)) as TPayload;
}

async function assertVaultUnlockedIfRequired(
  database: IDBDatabase,
): Promise<void> {
  const config = await readVaultPasskeyConfig(database);

  if (!config) {
    return;
  }

  if (!isVaultPasskeySessionUnlocked(config)) {
    throw new VaultLockedError();
  }
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

async function readVaultPasskeyConfig(
  database: IDBDatabase,
): Promise<VaultPasskeyCredentialConfig | null> {
  if (!database.objectStoreNames.contains(VAULT_PASSKEY_STORE_NAME)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_PASSKEY_STORE_NAME,
      "readonly",
    );
    const store = transaction.objectStore(VAULT_PASSKEY_STORE_NAME);
    const request = store.get(ACTIVE_VAULT_PASSKEY_KEY);

    request.onsuccess = () => {
      resolve(
        (request.result as VaultPasskeyCredentialConfig | undefined) ?? null,
      );
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error("Failed to read the local vault passkey."),
      );
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

async function readVaultWrapSecretRecord(
  database: IDBDatabase,
): Promise<VaultWrapSecretRecord | null> {
  if (!database.objectStoreNames.contains(VAULT_WRAP_SECRET_STORE_NAME)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_WRAP_SECRET_STORE_NAME,
      "readonly",
    );
    const store = transaction.objectStore(VAULT_WRAP_SECRET_STORE_NAME);
    const request = store.get(WRAP_SECRET_RECORD_KEY);

    request.onsuccess = () => {
      resolve((request.result as VaultWrapSecretRecord | undefined) ?? null);
    };
    request.onerror = () => {
      reject(
        request.error ??
          new Error("Failed to read the local vault wrap secret."),
      );
    };
  });
}

async function writeVaultWrapSecretRecord(
  database: IDBDatabase,
  record: VaultWrapSecretRecord,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_WRAP_SECRET_STORE_NAME,
      "readwrite",
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error("Failed to persist the local vault wrap secret."),
      );
    };

    transaction
      .objectStore(VAULT_WRAP_SECRET_STORE_NAME)
      .put(record, WRAP_SECRET_RECORD_KEY);
  });
}

async function writeVaultPasskeyConfig(
  database: IDBDatabase,
  config: VaultPasskeyCredentialConfig,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_PASSKEY_STORE_NAME,
      "readwrite",
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error("Failed to persist the local vault passkey."),
      );
    };

    transaction
      .objectStore(VAULT_PASSKEY_STORE_NAME)
      .put(config, ACTIVE_VAULT_PASSKEY_KEY);
  });
}

async function deleteVaultPasskeyConfig(database: IDBDatabase): Promise<void> {
  if (!database.objectStoreNames.contains(VAULT_PASSKEY_STORE_NAME)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      VAULT_PASSKEY_STORE_NAME,
      "readwrite",
    );

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(
        requestError(transaction) ??
          new Error("Failed to clear the local vault passkey."),
      );
    };

    transaction
      .objectStore(VAULT_PASSKEY_STORE_NAME)
      .delete(ACTIVE_VAULT_PASSKEY_KEY);
  });
}

async function writeSealedVault(
  database: IDBDatabase,
  vaultRecord: ManualImportVaultRecord,
  vaultState: ManualImportVaultState,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [VAULT_STATE_STORE_NAME, VAULT_RECORD_STORE_NAME],
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
  });
}

async function writeMigratedVault(
  database: IDBDatabase,
  vaultRecord: ManualImportVaultRecord,
  vaultState: ManualImportVaultState,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [LEGACY_STORE_NAME, VAULT_STATE_STORE_NAME, VAULT_RECORD_STORE_NAME],
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
          VAULT_WRAP_SECRET_STORE_NAME,
        ]
      : [
          VAULT_STATE_STORE_NAME,
          VAULT_RECORD_STORE_NAME,
          VAULT_KEY_STORE_NAME,
          VAULT_WRAP_SECRET_STORE_NAME,
        ];
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
    transaction
      .objectStore(VAULT_KEY_STORE_NAME)
      .delete(LEGACY_DEVICE_LOCAL_KEY_ID);
    transaction.objectStore(VAULT_KEY_STORE_NAME).delete(BROWSER_WRAP_KEY_ID);
    transaction
      .objectStore(VAULT_WRAP_SECRET_STORE_NAME)
      .delete(WRAP_SECRET_RECORD_KEY);
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

      if (!database.objectStoreNames.contains(VAULT_WRAP_SECRET_STORE_NAME)) {
        database.createObjectStore(VAULT_WRAP_SECRET_STORE_NAME);
      }

      if (!database.objectStoreNames.contains(VAULT_PASSKEY_STORE_NAME)) {
        database.createObjectStore(VAULT_PASSKEY_STORE_NAME);
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

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

function requestError(transaction: IDBTransaction): DOMException | null {
  return transaction.error ?? null;
}

function assertSubtleCrypto(): void {
  if (!("crypto" in globalThis) || !("subtle" in globalThis.crypto)) {
    throw new Error("Web Crypto is unavailable in this browser.");
  }
}

function buildManualImportVaultPasskeyState(
  config: VaultPasskeyCredentialConfig | null,
  keyMaterialMode: VaultKeyDerivationMode | null,
): ManualImportVaultPasskeyState {
  const supportReason = getVaultPasskeySupportReason();
  const supported = supportReason === null;

  if (!config) {
    return {
      supported,
      supportReason,
      configured: false,
      sessionStatus: supported ? "not-configured" : "unsupported",
      keyMaterialMode,
      displayName: null,
      rpId: null,
      createdAt: null,
      lastVerifiedAt: null,
    };
  }

  return {
    supported,
    supportReason,
    configured: true,
    sessionStatus:
      supported && isVaultPasskeySessionUnlocked(config)
        ? "unlocked"
        : "locked",
    keyMaterialMode,
    displayName: config.displayName,
    rpId: config.rpId,
    createdAt: config.createdAt,
    lastVerifiedAt: config.lastVerifiedAt,
  };
}

async function resolveReportedVaultPasskeyKeyMaterialMode(
  database: IDBDatabase,
  config: VaultPasskeyCredentialConfig | null,
): Promise<VaultKeyDerivationMode | null> {
  if (!config) {
    return null;
  }

  const sessionKeyMaterialMode = getVaultPasskeySessionKeyMaterialMode();

  if (sessionKeyMaterialMode) {
    return sessionKeyMaterialMode;
  }

  const wrapSecretRecord = await readVaultWrapSecretRecord(database);

  if (wrapSecretRecord) {
    return wrapSecretRecord.keyDerivation;
  }

  return (
    (await readVaultState(database))?.keyDerivation ?? "browser-local-wrap"
  );
}

async function wrapContentKeyBytes(
  wrappingKey: CryptoKey,
  contentKeyBytes: Uint8Array,
  aadContext: string,
): Promise<string> {
  assertSubtleCrypto();

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(textEncoder.encode(aadContext)),
    },
    wrappingKey,
    asArrayBuffer(contentKeyBytes),
  );

  return bytesToBase64(new Uint8Array([...iv, ...new Uint8Array(ciphertext)]));
}

async function unwrapWrappedContentKeyBytes(
  wrappingKey: CryptoKey,
  wrappedContentKeyB64: string,
  aadContext: string,
): Promise<Uint8Array> {
  assertSubtleCrypto();

  const wrappedBytes = base64ToBytes(wrappedContentKeyB64);
  const iv = wrappedBytes.slice(0, 12);
  const ciphertext = wrappedBytes.slice(12);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(textEncoder.encode(aadContext)),
    },
    wrappingKey,
    asArrayBuffer(ciphertext),
  );

  return new Uint8Array(plaintext);
}

async function importContentKey(rawKeyBytes: Uint8Array): Promise<CryptoKey> {
  assertSubtleCrypto();

  return globalThis.crypto.subtle.importKey(
    "raw",
    asArrayBuffer(rawKeyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function buildVaultWrapAadContext(
  contentKeyId: string,
  keyDerivation: VaultKeyDerivationMode,
): string {
  return `formae:vault-wrap:${WRAP_SECRET_RECORD_KEY}:${contentKeyId}:${keyDerivation}`;
}
