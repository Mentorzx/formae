const PAGE_BRIDGE_SOURCE = "formae-web-page";
const EXTENSION_BRIDGE_SOURCE = "formae-extension";
const BRIDGE_KINDS = new Set([
  "RequestSync",
  "ProvideEphemeralCredentials",
  "RawSigaaPayload",
  "NormalizedSnapshot",
  "StoreEncryptedSnapshot",
  "WipeLocalVault",
]);
const extensionApi = globalThis.browser ?? globalThis.chrome ?? null;

bootstrapContentScript();

function bootstrapContentScript() {
  const cleanup = installPageBridgeRelay((request) => {
    sendRuntimeMessage(request.envelope)
      .then((response) => {
        window.postMessage(
          createExtensionBridgeResponse(request.requestId, response),
          window.location.origin,
        );
      })
      .catch((error) => {
        window.postMessage(
          createExtensionBridgeResponse(request.requestId, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
          window.location.origin,
        );
      });
  });

  return cleanup;
}

function installPageBridgeRelay(onMessage) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event) => {
    if (!isPageBridgeRequest(event.data)) {
      return;
    }

    onMessage(event.data, event);
  };

  window.addEventListener("message", listener);

  return () => window.removeEventListener("message", listener);
}

function sendRuntimeMessage(message) {
  if (extensionApi?.runtime?.sendMessage && extensionApi === globalThis.browser) {
    return extensionApi.runtime.sendMessage(message);
  }

  if (extensionApi?.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      extensionApi.runtime.sendMessage(message, (response) => {
        const lastError = extensionApi.runtime.lastError;
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

function isPageBridgeRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    value.source === PAGE_BRIDGE_SOURCE &&
    typeof value.requestId === "string" &&
    isBridgeMessage(value.envelope)
  );
}

function isBridgeMessage(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    BRIDGE_KINDS.has(value.kind) &&
    typeof value.protocolVersion === "number" &&
    typeof value.payload === "object" &&
    value.payload !== null
  );
}

function createExtensionBridgeResponse(requestId, response) {
  return {
    source: EXTENSION_BRIDGE_SOURCE,
    requestId,
    response,
  };
}
