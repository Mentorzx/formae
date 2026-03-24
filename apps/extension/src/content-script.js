const PAGE_BRIDGE_SOURCE = "formae-web-page";
const EXTENSION_BRIDGE_SOURCE = "formae-extension";
const BRIDGE_PROTOCOL_VERSION = 1;
const ALLOWED_PAGE_BRIDGE_MESSAGE_KINDS = [
  "RequestSync",
  "RawSigaaPayload",
  "NormalizedSnapshot",
  "StoreEncryptedSnapshot",
  "WipeLocalVault",
];

bootstrapContentScript();

function bootstrapContentScript() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      !isPageBridgeRequest(event.data)
    ) {
      return;
    }

    sendRuntimeMessage(event.data.envelope)
      .then((response) => {
        window.postMessage(
          createExtensionBridgeResponse(event.data.requestId, response),
          window.location.origin,
        );
      })
      .catch((error) => {
        window.postMessage(
          createExtensionBridgeResponse(event.data.requestId, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
          window.location.origin,
        );
      });
  });
}

function createExtensionBridgeResponse(requestId, response) {
  return {
    source: EXTENSION_BRIDGE_SOURCE,
    requestId,
    response,
  };
}

function isPageBridgeRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    value.source === PAGE_BRIDGE_SOURCE &&
    typeof value.requestId === "string" &&
    isAllowedPageBridgeMessage(value.envelope)
  );
}

function isAllowedPageBridgeMessage(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    ALLOWED_PAGE_BRIDGE_MESSAGE_KINDS.includes(value.kind) &&
    value.protocolVersion === BRIDGE_PROTOCOL_VERSION &&
    "payload" in value
  );
}

function sendRuntimeMessage(message) {
  const browserApi = globalThis.browser ?? null;
  const chromeApi = globalThis.chrome ?? null;

  if (browserApi?.runtime?.sendMessage) {
    return browserApi.runtime.sendMessage(message);
  }

  if (chromeApi?.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chromeApi.runtime.sendMessage(message, (response) => {
        const lastError = chromeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  return Promise.reject(new Error("Extension runtime is unavailable."));
}
