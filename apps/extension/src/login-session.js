import { DEFAULT_SESSION_TTL_MS } from "./constants.js";

export function createEphemeralSigaaSession(input) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const ttlMs = input.ttlMs ?? DEFAULT_SESSION_TTL_MS;

  return {
    syncSessionId: input.syncSessionId,
    usernameOrCpf: input.usernameOrCpf,
    password: input.password,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + ttlMs).toISOString(),
    keepOnlyInMemory: true,
  };
}

export function sanitizeSigaaSession(session) {
  return {
    syncSessionId: session.syncSessionId,
    usernameOrCpf: session.usernameOrCpf,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    keepOnlyInMemory: true,
  };
}

export function isSigaaSessionExpired(session, now = new Date()) {
  return now.getTime() >= Date.parse(session.expiresAt);
}

export function createEphemeralCredentialsPayload(session) {
  return {
    syncSessionId: session.syncSessionId,
    usernameOrCpf: session.usernameOrCpf,
    password: session.password,
    keepOnlyInMemory: true,
  };
}
