import type {
  BridgeMessage,
  RawSigaaPayloadMessage,
  RequestSyncMessage,
  RequestSyncPayload,
  TimingProfileId,
  WipeLocalVaultMessage,
} from "@formae/protocol";
import { BRIDGE_PROTOCOL_VERSION } from "@formae/protocol";

const PAGE_BRIDGE_SOURCE = "formae-web-page";
const EXTENSION_BRIDGE_SOURCE = "formae-extension";

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

export async function runAutomaticSigaaSync(input: {
  usernameOrCpf: string;
  password: string;
  timingProfileId: TimingProfileId;
}): Promise<RawSigaaPayloadMessage["payload"]> {
  const syncSessionId = globalThis.crypto.randomUUID();
  const wipeMessage: WipeLocalVaultMessage = {
    kind: "WipeLocalVault",
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    payload: {
      reason: "logout",
      wipeMode: "memory-only",
      requestedAt: new Date().toISOString(),
    },
  };

  try {
    await postBridgeMessage(
      {
        kind: "ProvideEphemeralCredentials",
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        payload: {
          syncSessionId,
          usernameOrCpf: input.usernameOrCpf,
          password: input.password,
          keepOnlyInMemory: true,
        },
      },
      10_000,
    );

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

    if (response.kind !== "RawSigaaPayload") {
      throw new Error(
        `Unexpected bridge response from the extension: ${response.kind}.`,
      );
    }

    return response.payload;
  } finally {
    try {
      await postBridgeMessage(wipeMessage, 10_000);
    } catch {
      // The local app already has the payload at this point; a failed wipe
      // should not mask the sync result, but it still shortens extension retention when possible.
    }
  }
}

async function postBridgeMessage(
  envelope: BridgeMessage,
  timeoutMs: number,
): Promise<BridgeMessage> {
  if (typeof window === "undefined") {
    throw new Error("The SIGAA bridge can only run in a browser context.");
  }

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
          "Timed out waiting for the Formaê extension. Make sure the MV3 scaffold is loaded in this browser.",
        ),
      );
    });

    const onMessage = (event: MessageEvent<ExtensionBridgeResponse>) => {
      if (event.source !== window || !isExtensionBridgeResponse(event.data)) {
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
  value: ExtensionBridgeResponse["response"],
): value is { ok: false; error: string } {
  return (
    !("kind" in value) && typeof value.error === "string" && value.ok === false
  );
}

function installTimeout(timeoutMs: number, onTimeout: () => void) {
  const timeoutId = window.setTimeout(onTimeout, timeoutMs);
  return () => window.clearTimeout(timeoutId);
}

export const bridgeProtocolVersion = BRIDGE_PROTOCOL_VERSION;
