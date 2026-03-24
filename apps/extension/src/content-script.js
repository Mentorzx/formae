bootstrapContentScript();

function bootstrapContentScript() {
  const cleanup = installPageBridgeRelay((request) => {
    chrome.runtime.sendMessage(request.envelope, (response) => {
      const runtimeError = chrome.runtime.lastError;
      const reply =
        runtimeError && !response
          ? {
              ok: false,
              error: runtimeError.message,
            }
          : response;

      window.postMessage(
        createExtensionBridgeResponse(request.requestId, reply),
        window.location.origin,
      );
    });
  });

  return cleanup;
}

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
