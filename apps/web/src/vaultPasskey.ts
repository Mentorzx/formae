export interface VaultPasskeyCredentialConfig {
  schemaVersion: 1;
  credentialId: string;
  displayName: string;
  rpId: string;
  origin: string;
  createdAt: string;
  lastVerifiedAt: string | null;
  userVerification: "required";
}

interface VaultPasskeySessionMarker {
  credentialId: string;
  unlockedAt: string;
}

const PASSKEY_SESSION_STORAGE_KEY = "formae:vault-passkey-session";
const WEBAUTHN_TIMEOUT_MS = 60_000;
const CHALLENGE_BYTE_LENGTH = 32;
const USER_ID_BYTE_LENGTH = 16;

export function isVaultPasskeySupported(): boolean {
  return (
    globalThis.isSecureContext === true &&
    "PublicKeyCredential" in globalThis &&
    "navigator" in globalThis &&
    "credentials" in globalThis.navigator &&
    typeof globalThis.navigator.credentials.create === "function" &&
    typeof globalThis.navigator.credentials.get === "function"
  );
}

export function getVaultPasskeySupportReason(): string | null {
  if (globalThis.isSecureContext !== true) {
    return "Passkeys exigem um contexto seguro (HTTPS ou localhost).";
  }

  if (!("PublicKeyCredential" in globalThis)) {
    return "Este navegador nao expoe a API WebAuthn.";
  }

  if (
    !("navigator" in globalThis) ||
    !("credentials" in globalThis.navigator)
  ) {
    return "Este navegador nao expoe navigator.credentials.";
  }

  if (typeof globalThis.navigator.credentials.create !== "function") {
    return "Este navegador nao consegue registrar passkeys locais.";
  }

  if (typeof globalThis.navigator.credentials.get !== "function") {
    return "Este navegador nao consegue validar passkeys locais.";
  }

  return null;
}

export async function createVaultPasskeyCredential(
  displayName = defaultVaultPasskeyLabel(),
): Promise<VaultPasskeyCredentialConfig> {
  assertVaultPasskeySupport();

  const challenge = randomBytes(CHALLENGE_BYTE_LENGTH);
  const userId = randomBytes(USER_ID_BYTE_LENGTH);
  const rpId = resolveVaultPasskeyRpId();
  const createdAt = new Date().toISOString();
  const credential = await globalThis.navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Formae",
        id: rpId,
      },
      user: {
        id: userId,
        name: `vault@${rpId}`,
        displayName,
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      timeout: WEBAUTHN_TIMEOUT_MS,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    },
  });

  const createdCredential = assertPublicKeyCredential(
    credential,
    "Falha ao registrar a passkey local do vault.",
  );
  const credentialId = bytesToBase64Url(
    new Uint8Array(createdCredential.rawId),
  );

  writeVaultPasskeySession({
    credentialId,
    unlockedAt: createdAt,
  });

  return {
    schemaVersion: 1,
    credentialId,
    displayName,
    rpId,
    origin: globalThis.location.origin,
    createdAt,
    lastVerifiedAt: createdAt,
    userVerification: "required",
  };
}

export async function verifyVaultPasskeyCredential(
  config: VaultPasskeyCredentialConfig,
): Promise<VaultPasskeyCredentialConfig> {
  assertVaultPasskeySupport();

  const challenge = randomBytes(CHALLENGE_BYTE_LENGTH);
  const assertion = await globalThis.navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBytes(config.credentialId),
        },
      ],
      userVerification: config.userVerification,
      timeout: WEBAUTHN_TIMEOUT_MS,
    },
  });

  const credential = assertPublicKeyCredential(
    assertion,
    "Falha ao validar a passkey local do vault.",
  );
  const returnedCredentialId = bytesToBase64Url(
    new Uint8Array(credential.rawId),
  );

  if (returnedCredentialId !== config.credentialId) {
    throw new Error(
      "A credencial retornada pelo navegador nao corresponde a passkey do vault.",
    );
  }

  const response =
    credential.response as Partial<AuthenticatorAssertionResponse>;
  const clientDataBuffer = asBinaryBuffer(response.clientDataJSON);
  const authenticatorDataBuffer = asBinaryBuffer(response.authenticatorData);

  if (!clientDataBuffer || !authenticatorDataBuffer) {
    throw new Error("A resposta da passkey nao trouxe os dados esperados.");
  }

  const clientData = JSON.parse(new TextDecoder().decode(clientDataBuffer)) as {
    type?: string;
    challenge?: string;
    origin?: string;
    crossOrigin?: boolean;
  };

  if (clientData.type !== "webauthn.get") {
    throw new Error("A passkey retornou um tipo de operacao invalido.");
  }

  if (clientData.challenge !== bytesToBase64Url(challenge)) {
    throw new Error("O desafio local da passkey nao confere.");
  }

  if (clientData.origin !== globalThis.location.origin) {
    throw new Error("A origem da passkey nao confere com a origem atual.");
  }

  if (clientData.crossOrigin === true) {
    throw new Error("A passkey foi resolvida em contexto cross-origin.");
  }

  const authenticatorData = new Uint8Array(authenticatorDataBuffer);
  const flags = readAuthenticatorFlags(authenticatorData);

  if (!flags.userPresent) {
    throw new Error("A passkey nao confirmou presenca do usuario.");
  }

  if (!flags.userVerified) {
    throw new Error("A passkey nao confirmou verificacao do usuario.");
  }

  const verifiedAt = new Date().toISOString();
  writeVaultPasskeySession({
    credentialId: config.credentialId,
    unlockedAt: verifiedAt,
  });

  return {
    ...config,
    lastVerifiedAt: verifiedAt,
  };
}

export function isVaultPasskeySessionUnlocked(
  config: Pick<VaultPasskeyCredentialConfig, "credentialId">,
): boolean {
  const marker = readVaultPasskeySession();

  return marker?.credentialId === config.credentialId;
}

export function clearVaultPasskeySession(): void {
  if (!("sessionStorage" in globalThis)) {
    return;
  }

  globalThis.sessionStorage.removeItem(PASSKEY_SESSION_STORAGE_KEY);
}

export function defaultVaultPasskeyLabel(): string {
  return `Vault local ${resolveVaultPasskeyRpId()}`;
}

export function readAuthenticatorFlags(authenticatorData: Uint8Array): {
  userPresent: boolean;
  userVerified: boolean;
} {
  if (authenticatorData.length < 37) {
    throw new Error("Os dados da passkey vieram incompletos.");
  }

  const flags = authenticatorData[32] ?? 0;

  return {
    userPresent: Boolean(flags & 0x01),
    userVerified: Boolean(flags & 0x04),
  };
}

function resolveVaultPasskeyRpId(): string {
  const hostname = globalThis.location.hostname.trim();

  if (hostname.length === 0) {
    throw new Error("Nao foi possivel resolver o RP ID local da passkey.");
  }

  return hostname;
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

function assertVaultPasskeySupport(): void {
  const reason = getVaultPasskeySupportReason();

  if (reason) {
    throw new Error(reason);
  }
}

function assertPublicKeyCredential(
  credential: Credential | PublicKeyCredential | null,
  errorMessage: string,
): PublicKeyCredential {
  if (
    !credential ||
    typeof credential !== "object" ||
    !("rawId" in credential) ||
    !(credential.rawId instanceof ArrayBuffer) ||
    !("response" in credential)
  ) {
    throw new Error(errorMessage);
  }

  return credential as PublicKeyCredential;
}

function readVaultPasskeySession(): VaultPasskeySessionMarker | null {
  if (!("sessionStorage" in globalThis)) {
    return null;
  }

  const rawMarker = globalThis.sessionStorage.getItem(
    PASSKEY_SESSION_STORAGE_KEY,
  );

  if (!rawMarker) {
    return null;
  }

  try {
    return JSON.parse(rawMarker) as VaultPasskeySessionMarker;
  } catch {
    return null;
  }
}

function asBinaryBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    );
  }

  return null;
}

function writeVaultPasskeySession(marker: VaultPasskeySessionMarker): void {
  if (!("sessionStorage" in globalThis)) {
    return;
  }

  globalThis.sessionStorage.setItem(
    PASSKEY_SESSION_STORAGE_KEY,
    JSON.stringify(marker),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return globalThis
    .btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalizedValue.length % 4)) % 4;
  const paddedValue = `${normalizedValue}${"=".repeat(paddingLength)}`;
  const decodedValue = globalThis.atob(paddedValue);
  const bytes = new Uint8Array(decodedValue.length);

  for (const [index, char] of Array.from(decodedValue).entries()) {
    bytes[index] = char.charCodeAt(0);
  }

  return bytes;
}
