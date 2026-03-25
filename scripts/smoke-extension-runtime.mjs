import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageExtension } from "./package-extension.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (isMain(import.meta.url, process.argv[1])) {
  smokeExtensionRuntime({ repoRoot }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function smokeExtensionRuntime({
  repoRoot: providedRepoRoot = repoRoot,
  outputRoot,
} = {}) {
  const build =
    outputRoot == null
      ? await packageExtension({ repoRoot: providedRepoRoot })
      : await packageExtension({
          repoRoot: providedRepoRoot,
          outputRoot,
        });

  const chromeResult = await smokePackagedTarget({
    runtimeTarget: "chrome",
    packageRoot: build.packageRoots.chrome,
  });
  const firefoxResult = await smokePackagedTarget({
    runtimeTarget: "firefox",
    packageRoot: build.packageRoots.firefox,
  });

  process.stdout.write(
    [
      `chrome popup runtime: ${chromeResult.popupStatus}`,
      `chrome background runtime: ${chromeResult.backgroundStatus}`,
      `chrome content script runtime: ${chromeResult.contentScriptStatus}`,
      `firefox popup runtime: ${firefoxResult.popupStatus}`,
      `firefox background runtime: ${firefoxResult.backgroundStatus}`,
      `firefox content script runtime: ${firefoxResult.contentScriptStatus}`,
    ].join("\n") + "\n",
  );

  return {
    chrome: chromeResult,
    firefox: firefoxResult,
  };
}

async function smokePackagedTarget({ runtimeTarget, packageRoot }) {
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "manifest.json"), "utf8"),
  );
  const backgroundStatus = await smokeBackgroundRuntime({
    runtimeTarget,
    packageRoot,
    manifest,
  });
  const popupStatus = await smokePopupRuntime({ runtimeTarget, packageRoot, manifest });
  const contentScriptStatus = await smokeContentScriptRuntime({
    runtimeTarget,
    packageRoot,
    manifest,
  });

  return {
    runtimeTarget,
    packageRoot: basename(packageRoot),
    popupStatus,
    backgroundStatus,
    contentScriptStatus,
  };
}

async function smokePopupRuntime({ runtimeTarget, packageRoot, manifest }) {
  const popupPath = manifest.action?.default_popup;
  assert.equal(typeof popupPath, "string", "Packaged popup path is missing.");
  const popupHtml = await readFile(join(packageRoot, popupPath), "utf8");
  assert.match(popupHtml, /<script type="module" src="\.\/popup\.js"><\/script>/);

  const elements = createPopupElementMap();
  const runtimeMessages = [];
  const cleanup = installMockGlobals({
    runtimeTarget,
    browser:
      runtimeTarget === "firefox"
        ? createRuntimeMock(runtimeMessages, runtimeTarget)
        : null,
    chrome:
      runtimeTarget === "chrome"
        ? createRuntimeMock(runtimeMessages, runtimeTarget)
        : null,
    document: createPopupDocument(elements),
    window: createWindowMock("moz-extension://formae/popup.html"),
    popupClasses: elements.classes,
  });

  try {
    await importFreshModule(join(packageRoot, "src", "popup.js"));
    await flushMicrotasks();

    assert.equal(elements.statusText.textContent, "Nenhuma credencial em memória.");
  } finally {
    cleanup();
  }

  return "loaded";
}

async function smokeBackgroundRuntime({ runtimeTarget, packageRoot, manifest }) {
  const listeners = {
    installed: [],
    message: [],
    messageExternal: [],
  };
  const runtimeApi = createBackgroundRuntimeMock(listeners, runtimeTarget);
  const cleanup = installMockGlobals({
    runtimeTarget,
    browser: runtimeTarget === "firefox" ? runtimeApi : null,
    chrome: runtimeTarget === "chrome" ? runtimeApi : null,
  });

  try {
    const backgroundEntry =
      runtimeTarget === "firefox"
        ? manifest.background?.scripts?.[0]
        : manifest.background?.service_worker;
    assert.equal(typeof backgroundEntry, "string");
    await importFreshModule(join(packageRoot, backgroundEntry));

    assert.equal(listeners.installed.length, 1);
    assert.equal(listeners.message.length, 1);
    assert.equal(listeners.messageExternal.length, 1);
  } finally {
    cleanup();
  }

  return "loaded";
}

async function smokeContentScriptRuntime({ runtimeTarget, packageRoot, manifest }) {
  const contentScriptPath = manifest.content_scripts?.[0]?.js?.[0];
  assert.equal(typeof contentScriptPath, "string");
  const runtimeId = runtimeTarget === "firefox" ? "formae-firefox" : "formae-chrome";
  const documentElement = { dataset: {} };
  const eventLog = [];
  const windowMock = createWindowMock("https://mentorzx.github.io/formae/");
  windowMock.dispatchEvent = (event) => {
    eventLog.push(event.type);
    return true;
  };
  const cleanup = installMockGlobals({
    runtimeTarget,
    browser:
      runtimeTarget === "firefox"
        ? { runtime: { id: runtimeId } }
        : null,
    chrome:
      runtimeTarget === "chrome"
        ? { runtime: { id: runtimeId } }
        : null,
    document: { documentElement },
    window: windowMock,
    CustomEvent: class CustomEventMock {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail ?? null;
      }
    },
  });

  try {
    await importFreshModule(join(packageRoot, contentScriptPath));
    assert.equal(documentElement.dataset.formaeExtensionId, runtimeId);
    assert.equal(documentElement.dataset.formaeBridgeMode, "runtime-external");
    assert.equal(eventLog.includes("formae:extension-ready"), true);
  } finally {
    cleanup();
  }

  return "loaded";
}

function createRuntimeMock(runtimeMessages, runtimeTarget) {
  const response = {
    ok: true,
    kind: "GetCredentialState",
    credentialState: {
      hasSession: false,
      syncSessionId: null,
      usernameOrCpfMasked: null,
      expiresAt: null,
      syncApprovalActive: false,
      syncApprovalExpiresAt: null,
    },
  };

  return {
    runtime: {
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        if (runtimeTarget === "firefox") {
          return Promise.resolve(response);
        }

        callback?.(response);
        return undefined;
      },
    },
  };
}

function createBackgroundRuntimeMock(listeners, runtimeTarget) {
  const api = {
    runtime: {
      id: runtimeTarget === "firefox" ? "formae-firefox" : "formae-chrome",
      sendMessage(message, callback) {
        const response = {
          ok: true,
          kind: "GetCredentialState",
          credentialState: {
            hasSession: false,
            syncSessionId: null,
            usernameOrCpfMasked: null,
            expiresAt: null,
            syncApprovalActive: false,
            syncApprovalExpiresAt: null,
          },
        };

        if (runtimeTarget === "firefox") {
          return Promise.resolve(response);
        }

        callback?.(response);
        return undefined;
      },
      onInstalled: {
        addListener(listener) {
          listeners.installed.push(listener);
        },
      },
      onMessage: {
        addListener(listener) {
          listeners.message.push(listener);
        },
      },
      onMessageExternal: {
        addListener(listener) {
          listeners.messageExternal.push(listener);
        },
      },
    },
  };

  return api;
}

function createPopupElementMap() {
  class ElementMock {
    constructor(id = null) {
      this.id = id;
      this.textContent = "";
      this.value = "";
      this.disabled = false;
      this.dataset = {};
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      const current = this.listeners.get(type) ?? [];
      current.push(listener);
      this.listeners.set(type, current);
    }

    toggleAttribute(name, value) {
      this[name] = value;
    }
  }

  class InputMock extends ElementMock {}
  class ButtonMock extends ElementMock {}
  class HTMLElementMock extends ElementMock {}
  class FormMock extends ElementMock {
    querySelector(selector) {
      if (selector === 'button[type="submit"]') {
        return this.submitButton;
      }

      return null;
    }
  }

  const form = new FormMock("credentialForm");
  const submitButton = new ButtonMock("submitButton");
  form.submitButton = submitButton;

  return {
    classes: {
      HTMLFormElement: FormMock,
      HTMLInputElement: InputMock,
      HTMLButtonElement: ButtonMock,
      HTMLElement: HTMLElementMock,
    },
    credentialForm: form,
    usernameOrCpf: new InputMock("usernameOrCpf"),
    password: new InputMock("password"),
    statusText: new HTMLElementMock("statusText"),
    syncSessionId: new HTMLElementMock("syncSessionId"),
    usernameMasked: new HTMLElementMock("usernameMasked"),
    expiresAt: new HTMLElementMock("expiresAt"),
    syncApprovalExpiresAt: new HTMLElementMock("syncApprovalExpiresAt"),
    clearButton: new ButtonMock("clearButton"),
    syncNowButton: new ButtonMock("syncNowButton"),
  };
}

function createPopupDocument(elements) {
  const elementLookup = new Map(
    Object.entries(elements).filter(([key]) => key !== "classes"),
  );

  return {
    getElementById(id) {
      return elementLookup.get(id) ?? null;
    },
  };
}

function createWindowMock(url) {
  return {
    location: new URL(url),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
}

function installMockGlobals(overrides) {
  const trackedEntries = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    if (key === "runtimeTarget" || key === "popupClasses") {
      continue;
    }

    if (value == null) {
      continue;
    }

    trackedEntries.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  const popupClasses = overrides.popupClasses;

  if (popupClasses) {
    for (const [key, value] of Object.entries(popupClasses)) {
      trackedEntries.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value,
      });
    }
  }

  return () => {
    for (const [key, descriptor] of trackedEntries.entries()) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
  };
}

async function importFreshModule(filePath) {
  return import(`${pathToFileURL(resolve(filePath)).href}?smoke=${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function isMain(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }

  return metaUrl === pathToFileURL(resolve(argvPath)).href;
}
