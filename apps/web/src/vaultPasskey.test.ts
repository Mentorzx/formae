import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVaultPasskeySession,
  createVaultPasskeyCredential,
  isVaultPasskeySessionUnlocked,
  readAuthenticatorFlags,
  type VaultPasskeyCredentialConfig,
  verifyVaultPasskeyCredential,
} from "./vaultPasskey";

describe("vaultPasskey", () => {
  beforeEach(() => {
    clearVaultPasskeySession();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a local passkey credential and unlocks the session", async () => {
    const challengeAwareCreate = vi.fn().mockImplementation(async () => ({
      rawId: new Uint8Array([1, 2, 3, 4]).buffer,
      response: {},
    }));

    Object.defineProperty(globalThis.navigator, "credentials", {
      configurable: true,
      value: {
        create: challengeAwareCreate,
        get: vi.fn(),
      },
    });
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredentialMock {},
    });

    const credential = await createVaultPasskeyCredential("Vault de teste");

    expect(credential.displayName).toBe("Vault de teste");
    expect(credential.rpId).toBe(globalThis.location.hostname);
    expect(credential.origin).toBe(globalThis.location.origin);
    expect(isVaultPasskeySessionUnlocked(credential)).toBe(true);
    expect(challengeAwareCreate).toHaveBeenCalledTimes(1);
  });

  it("validates a passkey assertion and refreshes the unlocked session", async () => {
    const challengeAwareGet = vi
      .fn()
      .mockImplementation(async (options: CredentialRequestOptions) => {
        const publicKey = options.publicKey;
        const challenge = publicKey?.challenge;
        const challengeBytes =
          challenge instanceof Uint8Array
            ? challenge
            : challenge instanceof ArrayBuffer
              ? new Uint8Array(challenge)
              : null;

        if (!challengeBytes) {
          throw new Error("Expected Uint8Array challenge in test.");
        }

        return {
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {
            clientDataJSON: new TextEncoder().encode(
              JSON.stringify({
                type: "webauthn.get",
                challenge: bytesToBase64Url(challengeBytes),
                origin: globalThis.location.origin,
                crossOrigin: false,
              }),
            ),
            authenticatorData: new Uint8Array([
              ...new Array(32).fill(0),
              0x05,
              0,
              0,
              0,
              1,
            ]),
          },
        };
      });

    Object.defineProperty(globalThis.navigator, "credentials", {
      configurable: true,
      value: {
        create: vi.fn(),
        get: challengeAwareGet,
      },
    });
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredentialMock {},
    });

    const config: VaultPasskeyCredentialConfig = {
      schemaVersion: 1,
      credentialId: "AQIDBA",
      displayName: "Vault de teste",
      rpId: globalThis.location.hostname,
      origin: globalThis.location.origin,
      createdAt: "2026-03-24T03:30:00.000Z",
      lastVerifiedAt: null,
      userVerification: "required",
    };

    const verifiedConfig = await verifyVaultPasskeyCredential(config);

    expect(verifiedConfig.lastVerifiedAt).not.toBeNull();
    expect(isVaultPasskeySessionUnlocked(config)).toBe(true);
    expect(challengeAwareGet).toHaveBeenCalledTimes(1);
  });

  it("parses authenticator flags and rejects incomplete assertions", () => {
    expect(
      readAuthenticatorFlags(
        new Uint8Array([...new Array(32).fill(0), 0x05, 0, 0, 0, 0]),
      ),
    ).toEqual({
      userPresent: true,
      userVerified: true,
    });

    expect(() => readAuthenticatorFlags(new Uint8Array([1, 2, 3]))).toThrow(
      /incompletos/i,
    );
  });

  it("expires the unlocked passkey session after the in-memory ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T04:00:00.000Z"));

    Object.defineProperty(globalThis.navigator, "credentials", {
      configurable: true,
      value: {
        create: vi.fn(async () => ({
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          response: {},
        })),
        get: vi.fn(),
      },
    });
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredentialMock {},
    });

    const credential = await createVaultPasskeyCredential("Vault de teste");

    expect(isVaultPasskeySessionUnlocked(credential)).toBe(true);
    vi.setSystemTime(new Date("2026-03-24T04:11:00.000Z"));
    expect(isVaultPasskeySessionUnlocked(credential)).toBe(false);
  });
});

function bytesToBase64Url(value: Uint8Array): string {
  return globalThis
    .btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}
