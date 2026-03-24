import { SIGAA_HOST } from "./constants.js";
import {
  createRawSigaaPayloadMessage,
  createRequestSyncMessage,
} from "./bridge.js";
import { identifySigaaPage, normalizeSigaaText } from "./dom-contract.js";
import { installPageBridgeRelay } from "./page-bridge.js";

bootstrapContentScript();

function bootstrapContentScript() {
  const cleanup = installPageBridgeRelay((envelope) => {
    chrome.runtime.sendMessage(envelope);
  });

  if (location.hostname === SIGAA_HOST) {
    const syncSessionId = crypto.randomUUID();
    const pageKind = identifySigaaPage(location.href);
    const pageText = normalizeSigaaText(document.body?.innerText ?? "");

    chrome.runtime.sendMessage(
      createRequestSyncMessage({
        syncSessionId,
        reason: pageKind === "login" ? "manual" : "background-refresh",
        requestedAt: new Date().toISOString(),
        timingProfileId: "Ufba2025",
      }),
    );

    chrome.runtime.sendMessage(
      createRawSigaaPayloadMessage({
        syncSessionId,
        source: "dom",
        capturedAt: new Date().toISOString(),
        routeHint: location.href,
        htmlOrText: pageText,
      }),
    );
  }

  return cleanup;
}
