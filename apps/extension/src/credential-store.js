import {
  createEphemeralSigaaSession,
  isSigaaSessionExpired,
} from "./login-session.js";

export function createCredentialState() {
  return {
    session: null,
    updatedAt: null,
  };
}

export function storeEphemeralCredentials(state, input) {
  state.session = createEphemeralSigaaSession(input);
  state.updatedAt = new Date().toISOString();
  return summarizeCredentialState(state);
}

export function takeEphemeralCredentials(state) {
  const session = state.session;
  state.session = null;
  state.updatedAt = new Date().toISOString();
  return session;
}

export function clearEphemeralCredentials(state) {
  state.session = null;
  state.updatedAt = new Date().toISOString();
  return summarizeCredentialState(state);
}

export function summarizeCredentialState(state, now = new Date()) {
  const session = state.session;
  if (!session) {
    return {
      hasSession: false,
      isExpired: false,
      updatedAt: state.updatedAt,
      expiresAt: null,
      syncSessionId: null,
      usernameOrCpfMasked: null,
      keepOnlyInMemory: true,
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
  };
}

export function clearExpiredSession(state, now = new Date()) {
  if (state.session && isSigaaSessionExpired(state.session, now)) {
    state.session = null;
    state.updatedAt = now.toISOString();
  }

  return summarizeCredentialState(state, now);
}

function maskCredential(value) {
  const text = String(value ?? "").trim();
  if (text.length <= 4) {
    return "*".repeat(Math.max(text.length, 1));
  }

  return `${"*".repeat(Math.max(text.length - 4, 3))}${text.slice(-4)}`;
}
