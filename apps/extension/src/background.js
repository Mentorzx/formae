import { isBridgeMessage } from "./bridge.js";
import {
  clearExpiredSession,
  createCredentialState,
  clearEphemeralCredentials,
  storeEphemeralCredentials,
  takeEphemeralCredentials,
} from "./credential-store.js";
import { runAutomaticSigaaSync } from "./sigaa-sync.js";
import { extensionApi } from "./runtime.js";

const syncState = {
  credentialState: createCredentialState(),
  latestRawPayload: null,
  latestNormalizedSnapshot: null,
};

extensionApi.runtime.onInstalled.addListener(() => {
  syncState.credentialState = createCredentialState();
  syncState.latestRawPayload = null;
  syncState.latestNormalizedSnapshot = null;
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isBridgeMessage(message)) {
    return false;
  }

  handleBridgeMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown bridge error",
      }),
    );

  return true;
});

async function handleBridgeMessage(message) {
  switch (message.kind) {
    case "RequestSync":
      clearExpiredSession(syncState.credentialState);

      if (!syncState.credentialState.session) {
        return {
          ok: false,
          error:
            "SIGAA credentials are missing in the extension popup. Open the extension, enter the credentials, and try again.",
        };
      }

      const session = takeEphemeralCredentials(syncState.credentialState);
      const syncResult = await runAutomaticSigaaSync({
        syncSessionId: message.payload.syncSessionId,
        session,
      });
      syncState.latestRawPayload = syncResult.rawPayloadMessage.payload;
      return syncResult.rawPayloadMessage;
    case "SetEphemeralCredentials":
      return {
        ok: true,
        kind: "SetEphemeralCredentials",
        credentialState: storeEphemeralCredentials(syncState.credentialState, {
          syncSessionId: message.payload.syncSessionId,
          usernameOrCpf: message.payload.usernameOrCpf,
          password: message.payload.password,
        }),
      };
    case "GetCredentialState":
      return {
        ok: true,
        kind: "GetCredentialState",
        credentialState: clearExpiredSession(syncState.credentialState),
      };
    case "ClearEphemeralCredentials":
      return {
        ok: true,
        kind: "ClearEphemeralCredentials",
        credentialState: clearEphemeralCredentials(syncState.credentialState),
      };
    case "RawSigaaPayload":
      syncState.latestRawPayload = message.payload;
      return {
        ok: true,
        kind: "RawSigaaPayload",
        syncSessionId: message.payload.syncSessionId,
      };
    case "NormalizedSnapshot":
      syncState.latestNormalizedSnapshot = message.payload;
      return {
        ok: true,
        kind: "NormalizedSnapshot",
        syncSessionId: message.payload.syncSessionId,
      };
    case "StoreEncryptedSnapshot":
      return {
        ok: true,
        kind: "StoreEncryptedSnapshot",
        syncSessionId: message.payload.syncSessionId,
      };
    case "WipeLocalVault":
      syncState.credentialState = createCredentialState();
      syncState.latestRawPayload = null;
      syncState.latestNormalizedSnapshot = null;
      return {
        ok: true,
        kind: "WipeLocalVault",
      };
    default:
      return {
        ok: false,
        error: `Unsupported bridge message kind: ${message.kind}`,
      };
  }
}
