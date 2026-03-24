import assert from "node:assert/strict";
import test from "node:test";
import {
  createEphemeralCredentialsPayload,
  createEphemeralSigaaSession,
  isSigaaSessionExpired,
  sanitizeSigaaSession,
} from "./login-session.js";

test("ephemeral sessions stay in memory and expire deterministically", () => {
  const session = createEphemeralSigaaSession({
    syncSessionId: "sync-1",
    usernameOrCpf: "00011122233",
    password: "secret",
    createdAt: "2026-03-23T21:00:00.000Z",
    ttlMs: 60 * 1000,
  });

  assert.equal(session.keepOnlyInMemory, true);
  assert.equal(session.password, "secret");
  assert.equal(
    isSigaaSessionExpired(session, new Date("2026-03-23T21:01:01.000Z")),
    true,
  );
  assert.equal(
    isSigaaSessionExpired(session, new Date("2026-03-23T21:00:30.000Z")),
    false,
  );
});

test("sanitizing a session strips the password", () => {
  const session = createEphemeralSigaaSession({
    syncSessionId: "sync-1",
    usernameOrCpf: "00011122233",
    password: "secret",
  });
  const sanitized = sanitizeSigaaSession(session);

  assert.equal("password" in sanitized, false);
  assert.equal(sanitized.keepOnlyInMemory, true);
  assert.deepEqual(
    createEphemeralCredentialsPayload(session),
    {
      syncSessionId: "sync-1",
      usernameOrCpf: "00011122233",
      password: "secret",
      keepOnlyInMemory: true,
    },
  );
});
