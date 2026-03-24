import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAutomaticSigaaSync } from "./sigaaBridge";

function createRawPayloadResponse() {
  return {
    kind: "RawSigaaPayload",
    protocolVersion: 1,
    payload: {
      syncSessionId: "sync-test",
      source: "dom",
      capturedAt: "2026-03-24T05:00:00.000Z",
      routeHint: "sigaa-mobile:classes+grades",
      htmlOrText: "texto",
    },
  } as const;
}

describe("sigaaBridge", () => {
  beforeEach(() => {
    document.documentElement.dataset.formaeExtensionId = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete document.documentElement.dataset.formaeExtensionId;
    vi.unstubAllGlobals();
  });

  it("prefers the direct runtime bridge when the extension advertises its id", async () => {
    const sendMessage = vi.fn(
      (
        _extensionId: string,
        _message: unknown,
        callback: (value: unknown) => void,
      ) => {
        callback(createRawPayloadResponse());
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
    vi.spyOn(window, "postMessage").mockImplementation(
      (message: unknown, targetOrigin?: string | WindowPostMessageOptions) => {
        const request = message as { requestId: string };
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "formae-extension",
              requestId: request.requestId,
              response: createRawPayloadResponse(),
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
});
