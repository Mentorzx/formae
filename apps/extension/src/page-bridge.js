import { createBridgeEnvelope, isBridgeMessage } from "./bridge.js";

export const PAGE_BRIDGE_SOURCE = "formae-web-page";
export const EXTENSION_BRIDGE_SOURCE = "formae-extension";

export function createPageBridgeEnvelope(kind, payload) {
  return {
    source: PAGE_BRIDGE_SOURCE,
    envelope: createBridgeEnvelope(kind, payload),
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

export function installPageBridgeRelay(onMessage) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event) => {
    if (!isPageBridgeEnvelope(event.data)) {
      return;
    }

    onMessage(event.data.envelope, event);
  };

  window.addEventListener("message", listener);

  return () => window.removeEventListener("message", listener);
}
