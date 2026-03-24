import assert from "node:assert/strict";
import test from "node:test";

import {
  armSyncApproval,
  clearEphemeralCredentials,
  createCredentialState,
  hasActiveSyncApproval,
  storeEphemeralCredentials,
  summarizeCredentialState,
  takeEphemeralCredentials,
} from "./credential-store.js";

test("credential state stays memory only and can be consumed once", () => {
  const state = createCredentialState();

  const summary = storeEphemeralCredentials(state, {
    syncSessionId: "sync-1",
    usernameOrCpf: "00011122233",
    password: "secret",
    createdAt: "2026-03-24T03:00:00.000Z",
    ttlMs: 60_000,
  });

  assert.equal(summary.hasSession, true);
  assert.equal(summary.usernameOrCpfMasked.endsWith("2233"), true);
  assert.equal(summary.syncApprovalActive, true);

  const consumed = takeEphemeralCredentials(state);
  assert.equal(consumed.password, "secret");
  assert.equal(summarizeCredentialState(state).hasSession, false);
});

test("credential state can be cleared explicitly", () => {
  const state = createCredentialState();
  storeEphemeralCredentials(state, {
    syncSessionId: "sync-2",
    usernameOrCpf: "00011122233",
    password: "secret",
  });

  const summary = clearEphemeralCredentials(state);
  assert.equal(summary.hasSession, false);
  assert.equal(summary.usernameOrCpfMasked, null);
  assert.equal(summary.syncApprovalActive, false);
});

test("sync approval can be re-armed and expires independently", () => {
  const state = createCredentialState();
  storeEphemeralCredentials(state, {
    syncSessionId: "sync-3",
    usernameOrCpf: "00011122233",
    password: "secret",
  });

  armSyncApproval(state, new Date("2026-03-24T03:00:00.000Z"), 5_000);
  assert.equal(
    hasActiveSyncApproval(state, new Date("2026-03-24T03:00:03.000Z")),
    true,
  );
  assert.equal(
    hasActiveSyncApproval(state, new Date("2026-03-24T03:00:06.000Z")),
    false,
  );
});
