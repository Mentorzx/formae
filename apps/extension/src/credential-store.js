import {
  createEphemeralSigaaSession,
  isSigaaSessionExpired,
} from "./login-session.js";
import { DEFAULT_SYNC_APPROVAL_TTL_MS } from "./constants.js";

export function createCredentialState() {
  return {
    session: null,
    syncApproval: null,
    updatedAt: null,
  };
}

export function storeEphemeralCredentials(state, input) {
  state.session = createEphemeralSigaaSession(input);
  state.syncApproval = createSyncApproval();
  state.updatedAt = new Date().toISOString();
  return summarizeCredentialState(state);
}

export function takeEphemeralCredentials(state) {
  const session = state.session;
  state.session = null;
  state.syncApproval = null;
  state.updatedAt = new Date().toISOString();
  return session;
}

export function clearEphemeralCredentials(state) {
  state.session = null;
  state.syncApproval = null;
  state.updatedAt = new Date().toISOString();
  return summarizeCredentialState(state);
}

export function hasActiveSyncApproval(state, now = new Date()) {
  const syncApproval = state.syncApproval;

  if (!syncApproval) {
    return false;
  }

  return new Date(syncApproval.expiresAt).getTime() > now.getTime();
}

export function armSyncApproval(
  state,
  now = new Date(),
  ttlMs = DEFAULT_SYNC_APPROVAL_TTL_MS,
) {
  if (!state.session) {
    state.syncApproval = null;
    return summarizeCredentialState(state, now);
  }

  state.syncApproval = createSyncApproval(now, ttlMs);
  state.updatedAt = now.toISOString();
  return summarizeCredentialState(state, now);
}

export function summarizeCredentialState(state, now = new Date()) {
  const session = state.session;
  const syncApproval = resolveSyncApproval(state, now);
  if (!session) {
    return {
      hasSession: false,
      isExpired: false,
      updatedAt: state.updatedAt,
      expiresAt: null,
      syncSessionId: null,
      usernameOrCpfMasked: null,
      keepOnlyInMemory: true,
      syncApprovalActive: false,
      syncApprovalExpiresAt: null,
    };
  }

  return {
    hasSession: true,
    isExpired: isSigaaSessionExpired(session, now),
    updatedAt: state.updatedAt,
    expiresAt: session.expiresAt,
    syncSessionId: session.syncSessionId,
    usernameOrCpfMasked: maskCredential(session.usernameOrCpf),
    keepOnlyInMemory: true,
    syncApprovalActive: syncApproval !== null,
    syncApprovalExpiresAt: syncApproval?.expiresAt ?? null,
  };
}

export function clearExpiredSession(state, now = new Date()) {
  if (state.session && isSigaaSessionExpired(state.session, now)) {
    state.session = null;
    state.syncApproval = null;
    state.updatedAt = now.toISOString();
  }

  if (state.syncApproval && !hasActiveSyncApproval(state, now)) {
    state.syncApproval = null;
    state.updatedAt = now.toISOString();
  }

  return summarizeCredentialState(state, now);
}

function resolveSyncApproval(state, now) {
  if (!hasActiveSyncApproval(state, now)) {
    return null;
  }

  return state.syncApproval;
}

function createSyncApproval(
  now = new Date(),
  ttlMs = DEFAULT_SYNC_APPROVAL_TTL_MS,
) {
  return {
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

function maskCredential(value) {
  const text = String(value ?? "").trim();
  if (text.length <= 4) {
    return "*".repeat(Math.max(text.length, 1));
  }

  return `${"*".repeat(Math.max(text.length - 4, 3))}${text.slice(-4)}`;
}
