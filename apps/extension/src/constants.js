export const EXTENSION_NAMESPACE = "formae-extension";
export const SIGAA_HOST = "sigaa.ufba.br";
export const BRIDGE_PROTOCOL_VERSION = 1;
export const SIGAA_SELECTOR_VERSION = "sigaa-contract-v1";
export const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

export const bridgeMessageKinds = [
  "RequestSync",
  "ProvideEphemeralCredentials",
  "RawSigaaPayload",
  "NormalizedSnapshot",
  "StoreEncryptedSnapshot",
  "WipeLocalVault",
];

export const sigaaPageKinds = [
  "login",
  "history",
  "turmas",
  "document",
  "unknown",
];
