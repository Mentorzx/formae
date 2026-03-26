import type {
  BridgeMessage,
  ExtensionCredentialState,
  RequestSyncMessage,
  RequestSyncPayload,
  SigaaSyncSnapshotMessage,
  TimingProfileId,
} from "@formae/protocol";
import { BRIDGE_PROTOCOL_VERSION } from "@formae/protocol";

const PAGE_BRIDGE_SOURCE = "formae-web-page";
const EXTENSION_BRIDGE_SOURCE = "formae-extension";
const EXTENSION_READY_EVENT = "formae:extension-ready";
const LEGACY_BRIDGE_ATTRIBUTE = "formaeLegacyBridge";

interface PageBridgeRequest {
  source: typeof PAGE_BRIDGE_SOURCE;
  requestId: string;
  envelope: BridgeMessage;
}

interface ExtensionBridgeResponse {
  source: typeof EXTENSION_BRIDGE_SOURCE;
  requestId: string;
  response:
    | BridgeMessage
    | {
        ok: false;
        error: string;
      };
}

interface ExternalRuntimeApi {
  sendMessage: (
    extensionId: string,
    message: BridgeMessage,
    callback: (response: unknown) => void,
  ) => void;
  lastError?: {
    message: string;
  };
}

interface CredentialStateResponse {
  ok: true;
  kind: "GetCredentialState";
  credentialState: ExtensionCredentialState;
}

export interface ExtensionBridgeStatus {
  installed: boolean;
  extensionId: string | null;
  sessionState: "missing" | "ready" | "unknown";
  credentialState: ExtensionCredentialState | null;
}

export async function runAutomaticSigaaSync(input: {
  timingProfileId: TimingProfileId;
}): Promise<SigaaSyncSnapshotMessage["payload"]> {
  const syncSessionId = globalThis.crypto.randomUUID();
  const requestMessage: RequestSyncMessage = {
    kind: "RequestSync",
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    payload: {
      syncSessionId,
      timingProfileId: input.timingProfileId,
      requestedAt: new Date().toISOString(),
      reason: "manual",
    } satisfies RequestSyncPayload,
  };
  const response = await postBridgeMessage(requestMessage, 90_000);

  if (response.kind !== "SigaaSyncSnapshot") {
    throw new Error(
      `Unexpected bridge response from the extension: ${response.kind}.`,
    );
  }

  return response.payload;
}

export async function readExtensionBridgeStatus(): Promise<ExtensionBridgeStatus> {
  if (typeof window === "undefined") {
    return {
      installed: false,
      extensionId: null,
      sessionState: "unknown",
      credentialState: null,
    };
  }

  const runtime = resolveExternalRuntime();
  const extensionId = await discoverExtensionId();

  if (!runtime || !extensionId) {
    return {
      installed: false,
      extensionId: null,
      sessionState: "unknown",
      credentialState: null,
    };
  }

  const response = await new Promise<CredentialStateResponse>(
    (resolve, reject) => {
      runtime.sendMessage(
        extensionId,
        {
          kind: "GetCredentialState",
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          payload: {
            requestedAt: new Date().toISOString(),
          },
        },
        (value: unknown) => {
          if (runtime.lastError) {
            reject(new Error(runtime.lastError.message));
            return;
          }

          if (!isCredentialStateResponse(value)) {
            reject(
              new Error(
                "The Formaê extension returned an invalid credential-state response.",
              ),
            );
            return;
          }

          resolve(value);
        },
      );
    },
  );

  const sessionState =
    response.credentialState.hasSession &&
    response.credentialState.syncApprovalActive
      ? "ready"
      : response.credentialState.hasSession
        ? "missing"
        : "missing";

  return {
    installed: true,
    extensionId,
    sessionState,
    credentialState: response.credentialState,
  };
}

async function postBridgeMessage(
  envelope: BridgeMessage,
  timeoutMs: number,
): Promise<BridgeMessage> {
  if (typeof window === "undefined") {
    throw new Error("The SIGAA bridge can only run in a browser context.");
  }

  const directResponse = await postExternalRuntimeMessage(envelope, timeoutMs);

  if (directResponse) {
    return directResponse;
  }

  if (!isLegacyWindowBridgeEnabled()) {
    throw new Error(
      "The Formaê extension direct runtime bridge is unavailable. Legacy relay is restricted to local development, so open the extension in a supported browser or use localhost for relay debugging.",
    );
  }

  return postLegacyWindowBridgeMessage(envelope, timeoutMs);
}

async function postExternalRuntimeMessage(
  envelope: BridgeMessage,
  timeoutMs: number,
): Promise<BridgeMessage | null> {
  const runtime = resolveExternalRuntime();
  const extensionId = await discoverExtensionId();

  if (!runtime || !extensionId) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const cleanup = installTimeout(timeoutMs, () => {
      reject(
        new Error(
          "Timed out waiting for the Formaê extension direct runtime bridge.",
        ),
      );
    });

    runtime.sendMessage(extensionId, envelope, (response: unknown) => {
      cleanup();

      if (runtime.lastError) {
        reject(new Error(runtime.lastError.message));
        return;
      }

      if (isBridgeFailure(response)) {
        reject(new Error(response.error));
        return;
      }

      if (!isBridgeMessageResponse(response)) {
        reject(
          new Error(
            "The Formaê extension returned an invalid direct runtime response.",
          ),
        );
        return;
      }

      resolve(response);
    });
  });
}

async function postLegacyWindowBridgeMessage(
  envelope: BridgeMessage,
  timeoutMs: number,
): Promise<BridgeMessage> {
  const requestId = globalThis.crypto.randomUUID();
  const request: PageBridgeRequest = {
    source: PAGE_BRIDGE_SOURCE,
    requestId,
    envelope,
  };

  return new Promise((resolve, reject) => {
    const cleanup = installTimeout(timeoutMs, () => {
      window.removeEventListener("message", onMessage);
      reject(
        new Error(
          "Timed out waiting for the Formaê extension. Load the MV3 extension in this browser, fill the ephemeral SIGAA credentials in the extension popup, and try again.",
        ),
      );
    });

    const onMessage = (event: MessageEvent<ExtensionBridgeResponse>) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !isExtensionBridgeResponse(event.data)
      ) {
        return;
      }

      if (event.data.requestId !== requestId) {
        return;
      }

      cleanup();
      window.removeEventListener("message", onMessage);

      const { response } = event.data;
      if (isBridgeFailure(response)) {
        reject(new Error(response.error));
        return;
      }

      resolve(response);
    };

    window.addEventListener("message", onMessage);
    window.postMessage(request, window.location.origin);
  });
}

async function discoverExtensionId(): Promise<string | null> {
  const advertisedExtensionId =
    document.documentElement.dataset.formaeExtensionId ?? null;

  if (advertisedExtensionId) {
    return advertisedExtensionId;
  }

  return new Promise((resolve) => {
    const cleanup = installTimeout(120, () => {
      window.removeEventListener(
        EXTENSION_READY_EVENT,
        onExtensionReady as EventListener,
      );
      resolve(null);
    });

    const onExtensionReady = (
      event: Event | CustomEvent<{ extensionId?: string }>,
    ) => {
      const extensionId = (event as CustomEvent<{ extensionId?: string }>)
        .detail?.extensionId;

      if (typeof extensionId !== "string" || extensionId.length === 0) {
        return;
      }

      cleanup();
      window.removeEventListener(
        EXTENSION_READY_EVENT,
        onExtensionReady as EventListener,
      );
      resolve(extensionId);
    };

    window.addEventListener(
      EXTENSION_READY_EVENT,
      onExtensionReady as EventListener,
      { once: true },
    );
  });
}

function resolveExternalRuntime(): ExternalRuntimeApi | null {
  const runtime = (
    globalThis as typeof globalThis & {
      chrome?: {
        runtime?: ExternalRuntimeApi;
      };
    }
  ).chrome?.runtime;

  if (typeof runtime?.sendMessage !== "function") {
    return null;
  }

  return runtime;
}

function isLegacyWindowBridgeEnabled(): boolean {
  return (
    document.documentElement.dataset[LEGACY_BRIDGE_ATTRIBUTE] === "enabled" &&
    /^localhost$|^127(?:\.\d{1,3}){3}$/u.test(window.location.hostname)
  );
}

function isExtensionBridgeResponse(
  value: unknown,
): value is ExtensionBridgeResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.source === EXTENSION_BRIDGE_SOURCE &&
    typeof candidate.requestId === "string" &&
    "response" in candidate
  );
}

function isBridgeFailure(
  value: unknown,
): value is { ok: false; error: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      "error" in value &&
      (value as { ok?: unknown }).ok === false &&
      typeof (value as { error?: unknown }).error === "string",
  );
}

function isCredentialStateResponse(
  value: unknown,
): value is CredentialStateResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.ok === true &&
    candidate.kind === "GetCredentialState" &&
    typeof candidate.credentialState === "object" &&
    candidate.credentialState !== null
  );
}

function isBridgeMessageResponse(value: unknown): value is BridgeMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { kind?: unknown }).kind === "string" &&
      (value as { protocolVersion?: unknown }).protocolVersion ===
        BRIDGE_PROTOCOL_VERSION &&
      "payload" in value,
  );
}

function installTimeout(timeoutMs: number, onTimeout: () => void) {
  const timeoutId = window.setTimeout(onTimeout, timeoutMs);
  return () => window.clearTimeout(timeoutId);
}

export const bridgeProtocolVersion = BRIDGE_PROTOCOL_VERSION;
