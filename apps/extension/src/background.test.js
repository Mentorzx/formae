import assert from "node:assert/strict";
import test from "node:test";

import {
  isExternalBridgeMessageKindAllowed,
  isAllowedExternalSender,
  shouldRequireApprovalForRequestSync,
} from "./background.js";

test("external page traffic is restricted to RequestSync only", () => {
  assert.equal(isExternalBridgeMessageKindAllowed("RequestSync"), true);
  assert.equal(isExternalBridgeMessageKindAllowed("GetCredentialState"), false);
  assert.equal(isExternalBridgeMessageKindAllowed("RawSigaaPayload"), false);
  assert.equal(isExternalBridgeMessageKindAllowed("WipeLocalVault"), false);
});

test("page-triggered sync always requires popup approval while internal popup sync stays allowed", () => {
  assert.equal(
    shouldRequireApprovalForRequestSync(
      { source: "external" },
      {
        payload: {
          reason: "popup",
        },
      },
    ),
    true,
  );
  assert.equal(
    shouldRequireApprovalForRequestSync(
      { source: "internal" },
      {
        payload: {
          reason: "popup",
        },
      },
    ),
    false,
  );
  assert.equal(
    shouldRequireApprovalForRequestSync(
      { source: "internal" },
      {
        payload: {
          reason: "manual",
        },
      },
    ),
    true,
  );
});

test("external senders are limited to localhost and GitHub Pages", () => {
  assert.equal(
    isAllowedExternalSender({ url: "https://mentorzx.github.io/formae/" }),
    true,
  );
  assert.equal(isAllowedExternalSender({ url: "http://localhost:5173/" }), true);
  assert.equal(isAllowedExternalSender({ url: "http://127.0.0.1:5173/" }), false);
  assert.equal(
    isAllowedExternalSender({ url: "https://sigaa.ufba.br/" }),
    false,
  );
});
