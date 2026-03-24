export const BRIDGE_PROTOCOL_VERSION = 1;

export const bridgeMessageKinds = [
  "RequestSync",
  "ProvideEphemeralCredentials",
  "RawSigaaPayload",
  "NormalizedSnapshot",
  "StoreEncryptedSnapshot",
  "WipeLocalVault",
] as const;

export type BridgeMessageKind = (typeof bridgeMessageKinds)[number];

export type TimingProfileId = "Ufba2025";
export type SyncReason = "manual" | "rehydrate" | "background-refresh";
export type WipeMode = "memory-only" | "full-device-purge";
export type ManualImportSource = "sigaa-history" | "sigaa-html" | "plain-text";
export type ManualImportStatus = "idle" | "ready";
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";
export type TurnCode = "morning" | "afternoon" | "night";
export type ScheduleParseWarningCode =
  | "emptyInput"
  | "normalizedWhitespace"
  | "normalizedCase"
  | "canonicalizedSegment"
  | "reorderedSegments"
  | "deduplicatedDays"
  | "deduplicatedSlots"
  | "unparsedToken"
  | "outOfRangeSlot";

export interface BridgeEnvelope<TKind extends BridgeMessageKind, TPayload> {
  kind: TKind;
  protocolVersion: typeof BRIDGE_PROTOCOL_VERSION;
  payload: TPayload;
}

export interface RequestSyncPayload {
  syncSessionId: string;
  reason: SyncReason;
  requestedAt: string;
  timingProfileId: TimingProfileId;
}

export interface ProvideEphemeralCredentialsPayload {
  syncSessionId: string;
  usernameOrCpf: string;
  password: string;
  keepOnlyInMemory: true;
}

export interface RawSigaaPayloadPayload {
  syncSessionId: string;
  source: "dom" | "download";
  capturedAt: string;
  routeHint: string;
  htmlOrText: string;
}

export interface NormalizedSnapshotPayload {
  syncSessionId: string;
  schemaVersion: number;
  timingProfileId: TimingProfileId;
  canonicalScheduleCodes: string[];
  warnings: string[];
}

export interface StoreEncryptedSnapshotPayload {
  syncSessionId: string;
  encryptionContext: "indexeddb-webcrypto";
  storedAt: string;
  keyDerivation: "webauthn-unlock" | "device-local";
}

export interface WipeLocalVaultPayload {
  reason: "logout" | "manual-wipe" | "recovery";
  wipeMode: WipeMode;
  requestedAt: string;
}

export interface ManualImportDraft {
  source: ManualImportSource;
  rawInput: string;
  capturedAt: string;
  timingProfileId: TimingProfileId;
}

export interface ClockTime {
  hour: number;
  minute: number;
}

export interface ScheduleMeeting {
  day: Weekday;
  turn: TurnCode;
  slotStart: number;
  slotEnd: number;
  startTime: ClockTime;
  endTime: ClockTime;
  sourceSegment: string;
}

export interface ScheduleParseWarning {
  code: ScheduleParseWarningCode;
  message: string;
}

export interface ScheduleParseResult {
  rawCode: string;
  normalizedCode: string;
  canonicalCode: string;
  meetings: ScheduleMeeting[];
  warnings: ScheduleParseWarning[];
  profileId: TimingProfileId;
}

export interface ManualImportPreview {
  status: ManualImportStatus;
  rawLength: number;
  detectedScheduleCodes: string[];
  detectedComponentCodes: string[];
  warnings: string[];
  timingProfileId: TimingProfileId;
}

export interface ManualImportNormalizedSchedule {
  inputCode: string;
  parser: "rust-wasm";
  result: ScheduleParseResult;
}

export type RequestSyncMessage = BridgeEnvelope<
  "RequestSync",
  RequestSyncPayload
>;
export type ProvideEphemeralCredentialsMessage = BridgeEnvelope<
  "ProvideEphemeralCredentials",
  ProvideEphemeralCredentialsPayload
>;
export type RawSigaaPayloadMessage = BridgeEnvelope<
  "RawSigaaPayload",
  RawSigaaPayloadPayload
>;
export type NormalizedSnapshotMessage = BridgeEnvelope<
  "NormalizedSnapshot",
  NormalizedSnapshotPayload
>;
export type StoreEncryptedSnapshotMessage = BridgeEnvelope<
  "StoreEncryptedSnapshot",
  StoreEncryptedSnapshotPayload
>;
export type WipeLocalVaultMessage = BridgeEnvelope<
  "WipeLocalVault",
  WipeLocalVaultPayload
>;

export type BridgeMessage =
  | RequestSyncMessage
  | ProvideEphemeralCredentialsMessage
  | RawSigaaPayloadMessage
  | NormalizedSnapshotMessage
  | StoreEncryptedSnapshotMessage
  | WipeLocalVaultMessage;

export function createRequestSyncExample(): RequestSyncMessage {
  return {
    kind: "RequestSync",
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    payload: {
      syncSessionId: "sync_2026_03_23T19_45_00Z",
      reason: "manual",
      requestedAt: "2026-03-23T19:45:00.000Z",
      timingProfileId: "Ufba2025",
    },
  };
}
