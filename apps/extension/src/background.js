import { isBridgeMessage } from "./bridge.js";
import {
  createEphemeralSigaaSession,
  isSigaaSessionExpired,
} from "./login-session.js";
import { runAutomaticSigaaSync } from "./sigaa-sync.js";

const syncState = {
  session: null,
  latestRawPayload: null,
  latestNormalizedSnapshot: null,
};

chrome.runtime.onInstalled.addListener(() => {
  syncState.session = null;
  syncState.latestRawPayload = null;
  syncState.latestNormalizedSnapshot = null;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      if (!syncState.session) {
        return {
          ok: false,
          error:
            "SIGAA credentials are missing in memory. Provide them before starting the sync.",
        };
      }

      if (isSigaaSessionExpired(syncState.session)) {
        syncState.session = null;
        return {
          ok: false,
          error: "The in-memory SIGAA session expired before the sync started.",
        };
      }

      const syncResult = await runAutomaticSigaaSync({
        syncSessionId: message.payload.syncSessionId,
        session: syncState.session,
      });
      syncState.latestRawPayload = syncResult.rawPayloadMessage.payload;
      return syncResult.rawPayloadMessage;
    case "ProvideEphemeralCredentials":
      syncState.session = createEphemeralSigaaSession({
        syncSessionId: message.payload.syncSessionId,
        usernameOrCpf: message.payload.usernameOrCpf,
        password: message.payload.password,
      });
      return {
        ok: true,
        kind: "ProvideEphemeralCredentials",
        syncSessionId: message.payload.syncSessionId,
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
      syncState.session = null;
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
