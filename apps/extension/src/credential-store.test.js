import assert from "node:assert/strict";
import test from "node:test";

import {
  clearEphemeralCredentials,
  createCredentialState,
  storeEphemeralCredentials,
  summarizeCredentialState,
  takeEphemeralCredentials,
} from "./credential-store.js";

test("credential state stays memory only and can be consumed once", () => {
  const state = createCredentialState();

  const summary = storeEphemeralCredentials(state, {
    syncSessionId: "sync-1",
    usernameOrCpf: "08800261540",
    password: "secret",
    createdAt: "2026-03-24T03:00:00.000Z",
    ttlMs: 60_000,
  });

  assert.equal(summary.hasSession, true);
  assert.equal(summary.usernameOrCpfMasked.endsWith("1540"), true);

  const consumed = takeEphemeralCredentials(state);
  assert.equal(consumed.password, "secret");
  assert.equal(summarizeCredentialState(state).hasSession, false);
});

test("credential state can be cleared explicitly", () => {
  const state = createCredentialState();
  storeEphemeralCredentials(state, {
    syncSessionId: "sync-2",
    usernameOrCpf: "08800261540",
    password: "secret",
  });

  const summary = clearEphemeralCredentials(state);
  assert.equal(summary.hasSession, false);
  assert.equal(summary.usernameOrCpfMasked, null);
});
