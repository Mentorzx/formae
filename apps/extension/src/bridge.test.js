import assert from "node:assert/strict";
import test from "node:test";
import {
  createBridgeEnvelope,
  createRawSigaaPayloadMessage,
  isBridgeMessage,
} from "./bridge.js";

test("createBridgeEnvelope builds a typed protocol envelope", () => {
  const envelope = createBridgeEnvelope("RequestSync", {
    syncSessionId: "sync-1",
    reason: "manual",
    requestedAt: "2026-03-23T21:45:00.000Z",
    timingProfileId: "Ufba2025",
  });

  assert.equal(envelope.kind, "RequestSync");
  assert.equal(envelope.protocolVersion, 1);
  assert.equal(envelope.payload.syncSessionId, "sync-1");
});

test("isBridgeMessage validates bridge payloads", () => {
  assert.equal(
    isBridgeMessage(
      createRawSigaaPayloadMessage({
        syncSessionId: "sync-1",
        source: "dom",
        capturedAt: "2026-03-23T21:45:00.000Z",
        routeHint: "https://sigaa.ufba.br/",
        htmlOrText: "texto",
      }),
    ),
    true,
  );
  assert.equal(isBridgeMessage({ kind: "Nope" }), false);
});
