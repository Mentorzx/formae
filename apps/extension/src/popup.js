import {
  createClearEphemeralCredentialsMessage,
  createGetCredentialStateMessage,
  createRequestSyncMessage,
  createSetEphemeralCredentialsMessage,
} from "./bridge.js";
import { sendRuntimeMessage } from "./runtime.js";

const credentialForm = document.getElementById("credentialForm");
const usernameOrCpfInput = document.getElementById("usernameOrCpf");
const passwordInput = document.getElementById("password");
const statusText = document.getElementById("statusText");
const syncSessionIdNode = document.getElementById("syncSessionId");
const usernameMaskedNode = document.getElementById("usernameMasked");
const expiresAtNode = document.getElementById("expiresAt");
const clearButton = document.getElementById("clearButton");
const syncNowButton = document.getElementById("syncNowButton");

if (
  credentialForm instanceof HTMLFormElement &&
  usernameOrCpfInput instanceof HTMLInputElement &&
  passwordInput instanceof HTMLInputElement &&
  statusText instanceof HTMLElement &&
  syncSessionIdNode instanceof HTMLElement &&
  usernameMaskedNode instanceof HTMLElement &&
  expiresAtNode instanceof HTMLElement &&
  clearButton instanceof HTMLButtonElement &&
  syncNowButton instanceof HTMLButtonElement
) {
  credentialForm.addEventListener("submit", onSaveCredentials);
  clearButton.addEventListener("click", onClearCredentials);
  syncNowButton.addEventListener("click", onSyncNow);
  refreshCredentialState();
}

async function onSaveCredentials(event) {
  event.preventDefault();

  const usernameOrCpf = usernameOrCpfInput.value.trim();
  const password = passwordInput.value;

  if (!usernameOrCpf || !password) {
    renderStatus("Preencha CPF/usuário e senha.", "error");
    return;
  }

  setBusyState(true);
  try {
    const response = await sendRuntimeMessage(
      createSetEphemeralCredentialsMessage({
        syncSessionId: createSyncSessionId("credentials"),
        usernameOrCpf,
        password,
      }),
    );

    passwordInput.value = "";
    renderCredentialState(response.credentialState);
    renderStatus("Credenciais guardadas apenas em memória.", "success");
  } catch (error) {
    renderStatus(getErrorMessage(error), "error");
  } finally {
    setBusyState(false);
  }
}

async function onClearCredentials() {
  setBusyState(true);
  try {
    const response = await sendRuntimeMessage(
      createClearEphemeralCredentialsMessage({
        requestedAt: new Date().toISOString(),
      }),
    );

    passwordInput.value = "";
    renderCredentialState(response.credentialState);
    renderStatus("Sessão efêmera limpa.", "success");
  } catch (error) {
    renderStatus(getErrorMessage(error), "error");
  } finally {
    setBusyState(false);
  }
}

async function onSyncNow() {
  setBusyState(true);
  try {
    const response = await sendRuntimeMessage(
      createRequestSyncMessage({
        syncSessionId: createSyncSessionId("popup-sync"),
        reason: "popup",
        requestedAt: new Date().toISOString(),
        timingProfileId: "Ufba2025",
      }),
    );

    renderStatus(
      response?.ok === false
        ? response.error ?? "Falha ao sincronizar."
        : "Sincronização disparada.",
      response?.ok === false ? "error" : "success",
    );
    await refreshCredentialState();
  } catch (error) {
    renderStatus(getErrorMessage(error), "error");
  } finally {
    setBusyState(false);
  }
}

async function refreshCredentialState() {
  try {
    const response = await sendRuntimeMessage(
      createGetCredentialStateMessage({ requestedAt: new Date().toISOString() }),
    );
    renderCredentialState(response.credentialState);
    renderStatus(
      response.credentialState?.hasSession
        ? "Credenciais prontas para uma sincronização."
        : "Nenhuma credencial em memória.",
      "info",
    );
  } catch (error) {
    renderStatus(getErrorMessage(error), "error");
  }
}

function renderCredentialState(credentialState) {
  syncSessionIdNode.textContent = credentialState?.syncSessionId ?? "-";
  usernameMaskedNode.textContent = credentialState?.usernameOrCpfMasked ?? "-";
  expiresAtNode.textContent = credentialState?.expiresAt ?? "-";
}

function renderStatus(message, tone = "info") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setBusyState(isBusy) {
  credentialForm.toggleAttribute("aria-busy", isBusy);
  syncNowButton.disabled = isBusy;
  clearButton.disabled = isBusy;
  credentialForm.querySelector('button[type="submit"]').disabled = isBusy;
}

function createSyncSessionId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
