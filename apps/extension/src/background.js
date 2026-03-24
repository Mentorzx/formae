import { isBridgeMessage } from "./bridge.js";
import {
  hasActiveSyncApproval,
  clearExpiredSession,
  createCredentialState,
  clearEphemeralCredentials,
  storeEphemeralCredentials,
  takeEphemeralCredentials,
} from "./credential-store.js";
import { runAutomaticSigaaSync } from "./sigaa-sync.js";
import { extensionApi } from "./runtime.js";

const ALLOWED_EXTERNAL_BRIDGE_MESSAGE_KINDS = new Set(["RequestSync"]);

const syncState = {
  credentialState: createCredentialState(),
  latestRawPayload: null,
  latestNormalizedSnapshot: null,
};

if (extensionApi?.runtime?.onInstalled) {
  extensionApi.runtime.onInstalled.addListener(() => {
    syncState.credentialState = createCredentialState();
    syncState.latestRawPayload = null;
    syncState.latestNormalizedSnapshot = null;
  });
}

if (extensionApi?.runtime?.onMessage) {
  extensionApi.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (!isBridgeMessage(message)) {
        return false;
      }

      handleBridgeMessage(message, { source: "internal" })
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown bridge error",
          }),
        );

      return true;
    },
  );
}

if (extensionApi?.runtime?.onMessageExternal) {
  extensionApi.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
      if (!isBridgeMessage(message)) {
        return false;
      }

      handleBridgeMessage(message, { source: "external", sender })
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error ? error.message : "Unknown bridge error",
          }),
        );

      return true;
    },
  );
}

export function isExternalBridgeMessageKindAllowed(kind) {
  return ALLOWED_EXTERNAL_BRIDGE_MESSAGE_KINDS.has(kind);
}

export function shouldRequireApprovalForRequestSync(context, message) {
  if (context.source === "external") {
    return true;
  }

  return message.payload.reason !== "popup";
}

async function handleBridgeMessage(message, context) {
  if (
    context.source === "external" &&
    !isAllowedExternalSender(context.sender)
  ) {
    return {
      ok: false,
      error:
        "This web origin is not allowed to talk directly to the Formaê extension.",
    };
  }

  if (
    context.source === "external" &&
    !isExternalBridgeMessageKindAllowed(message.kind)
  ) {
    return {
      ok: false,
      error:
        "This web origin can only request a sync from the Formaê extension.",
    };
  }

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

      if (
        shouldRequireApprovalForRequestSync(context, message) &&
        !hasActiveSyncApproval(syncState.credentialState)
      ) {
        return {
          ok: false,
          error:
            "A aprovacao curta do sync expirou. Abra a popup da extensao, salve novamente as credenciais efemeras e tente de novo.",
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

function isAllowedExternalSender(sender) {
  const senderUrl = sender?.url;

  if (!senderUrl) {
    return false;
  }

  let origin;

  try {
    origin = new URL(senderUrl).origin;
  } catch {
    return false;
  }

  return (
    origin === "https://mentorzx.github.io" ||
    /^http:\/\/localhost(?::\d+)?$/u.test(origin) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/u.test(origin)
  );
}
