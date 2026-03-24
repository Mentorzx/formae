import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestSyncMessage,
  createSetEphemeralCredentialsMessage,
} from "./bridge.js";
import {
  createExtensionBridgeResponse,
  createPageBridgeRequest,
  isExtensionBridgeResponse,
  isPageBridgeRequest,
} from "./page-bridge.js";

test("page bridge requests keep the protocol envelope intact", () => {
  const envelope = createRequestSyncMessage({
    syncSessionId: "sync-1",
    reason: "manual",
    requestedAt: "2026-03-24T03:00:00.000Z",
    timingProfileId: "Ufba2025",
  });
  const request = createPageBridgeRequest("req-1", envelope);

  assert.equal(isPageBridgeRequest(request), true);
  assert.equal(request.requestId, "req-1");
  assert.equal(request.envelope.kind, "RequestSync");
});

test("page bridge rejects credential-bearing messages", () => {
  const request = createPageBridgeRequest(
    "req-2",
    createSetEphemeralCredentialsMessage({
      syncSessionId: "sync-2",
      usernameOrCpf: "00011122233",
      password: "secret",
    }),
  );

  assert.equal(isPageBridgeRequest(request), false);
});

test("extension bridge responses preserve request correlation", () => {
  const response = createExtensionBridgeResponse("req-1", {
    ok: false,
    error: "Extension is unavailable.",
  });

  assert.equal(isExtensionBridgeResponse(response), true);
  assert.equal(response.requestId, "req-1");
});
