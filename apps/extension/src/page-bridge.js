import { createBridgeEnvelope, isBridgeMessage } from "./bridge.js";

export const PAGE_BRIDGE_SOURCE = "formae-web-page";
export const EXTENSION_BRIDGE_SOURCE = "formae-extension";

export function createPageBridgeEnvelope(kind, payload) {
  return {
    source: PAGE_BRIDGE_SOURCE,
    envelope: createBridgeEnvelope(kind, payload),
  };
}

export function createPageBridgeRequest(requestId, envelope) {
  return {
    source: PAGE_BRIDGE_SOURCE,
    requestId,
    envelope,
  };
}

export function createExtensionBridgeResponse(requestId, response) {
  return {
    source: EXTENSION_BRIDGE_SOURCE,
    requestId,
    response,
  };
}

export function isPageBridgeEnvelope(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value;
  return (
    candidate.source === PAGE_BRIDGE_SOURCE &&
    isBridgeMessage(candidate.envelope)
  );
}

export function isPageBridgeRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value;
  return (
    candidate.source === PAGE_BRIDGE_SOURCE &&
    typeof candidate.requestId === "string" &&
    isBridgeMessage(candidate.envelope)
  );
}

export function isExtensionBridgeResponse(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value;
  return (
    candidate.source === EXTENSION_BRIDGE_SOURCE &&
    typeof candidate.requestId === "string" &&
    "response" in candidate
  );
}

export function installPageBridgeRelay(onMessage) {
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
