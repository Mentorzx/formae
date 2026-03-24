import {
  BRIDGE_PROTOCOL_VERSION,
  bridgeMessageKinds,
} from "./constants.js";

export function createBridgeEnvelope(kind, payload) {
  assertBridgeMessageKind(kind);

  return {
    kind,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    payload,
  };
}

export function isBridgeMessage(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value;
  return (
    typeof candidate.kind === "string" &&
    typeof candidate.protocolVersion === "number" &&
    candidate.protocolVersion === BRIDGE_PROTOCOL_VERSION &&
    bridgeMessageKinds.includes(candidate.kind) &&
    "payload" in candidate
  );
}

export function createRequestSyncMessage(payload) {
  return createBridgeEnvelope("RequestSync", payload);
}

export function createProvideEphemeralCredentialsMessage(payload) {
  return createBridgeEnvelope("ProvideEphemeralCredentials", payload);
}

export function createRawSigaaPayloadMessage(payload) {
  return createBridgeEnvelope("RawSigaaPayload", payload);
}

export function createNormalizedSnapshotMessage(payload) {
  return createBridgeEnvelope("NormalizedSnapshot", payload);
}

export function createStoreEncryptedSnapshotMessage(payload) {
  return createBridgeEnvelope("StoreEncryptedSnapshot", payload);
}

export function createWipeLocalVaultMessage(payload) {
  return createBridgeEnvelope("WipeLocalVault", payload);
}

function assertBridgeMessageKind(kind) {
  if (!bridgeMessageKinds.includes(kind)) {
    throw new Error(`Unsupported bridge message kind: ${kind}`);
  }
}
