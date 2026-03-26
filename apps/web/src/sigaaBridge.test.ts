import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readExtensionBridgeStatus,
  runAutomaticSigaaSync,
} from "./sigaaBridge";

function createSyncSnapshotResponse() {
  return {
    kind: "SigaaSyncSnapshot",
    protocolVersion: 1,
    payload: {
      syncSessionId: "sync-test",
      source: "dom",
      capturedAt: "2026-03-24T05:00:00.000Z",
      routeHint: "sigaa-mobile:classes+grades",
      retentionMode: "structured-minimized",
      persistedRawInput: "texto",
      structuredContext: null,
      warnings: [],
    },
  } as const;
}

describe("sigaaBridge", () => {
  beforeEach(() => {
    document.documentElement.dataset.formaeExtensionId = "";
    document.documentElement.dataset.formaeLegacyBridge = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete document.documentElement.dataset.formaeExtensionId;
    delete document.documentElement.dataset.formaeLegacyBridge;
    vi.unstubAllGlobals();
  });

  it("prefers the direct runtime bridge when the extension advertises its id", async () => {
    const sendMessage = vi.fn(
      (
        _extensionId: string,
        _message: unknown,
        callback: (value: unknown) => void,
      ) => {
        callback(createSyncSnapshotResponse());
      },
    );
    const postMessageSpy = vi.spyOn(window, "postMessage");

    document.documentElement.dataset.formaeExtensionId = "ext-test";
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
      },
    });

    const payload = await runAutomaticSigaaSync({
      timingProfileId: "Ufba2025",
    });

    expect(payload.routeHint).toContain("sigaa-mobile");
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("falls back to the legacy window bridge when no direct runtime is available", async () => {
    document.documentElement.dataset.formaeLegacyBridge = "enabled";
    vi.spyOn(window, "postMessage").mockImplementation(
      (message: unknown, targetOrigin?: string | WindowPostMessageOptions) => {
        const request = message as { requestId: string };
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "formae-extension",
              requestId: request.requestId,
              response: createSyncSnapshotResponse(),
            },
            origin:
              typeof targetOrigin === "string"
                ? targetOrigin
                : window.location.origin,
            source: window,
          }),
        );
      },
    );

    const payload = await runAutomaticSigaaSync({
      timingProfileId: "Ufba2025",
    });

    expect(payload.source).toBe("dom");
  });

  it("rejects the legacy relay when it is not explicitly enabled", async () => {
    await expect(
      runAutomaticSigaaSync({
        timingProfileId: "Ufba2025",
      }),
    ).rejects.toThrow(/Legacy relay is restricted to local development/i);
  });

  it("reads the extension readiness state from the direct runtime bridge", async () => {
    const sendMessage = vi.fn(
      (
        _extensionId: string,
        message: { kind: string },
        callback: (value: unknown) => void,
      ) => {
        if (message.kind === "GetCredentialState") {
          callback({
            ok: true,
            kind: "GetCredentialState",
            credentialState: {
              hasSession: true,
              syncSessionId: "sync-cred",
              usernameOrCpfMasked: "***540",
              expiresAt: "2026-03-24T05:02:00.000Z",
              syncApprovalActive: true,
              syncApprovalExpiresAt: "2026-03-24T05:02:00.000Z",
            },
          });
          return;
        }

        callback(createSyncSnapshotResponse());
      },
    );

    document.documentElement.dataset.formaeExtensionId = "ext-test";
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
      },
    });

    const status = await readExtensionBridgeStatus();

    expect(status.installed).toBe(true);
    expect(status.sessionState).toBe("ready");
    expect(status.credentialState?.hasSession).toBe(true);
  });
});
