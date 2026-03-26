import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("./localStudentSnapshot", () => ({
  loadLatestProjectedStudentSnapshot: vi.fn(async () => ({
    bundle: null,
    source: "none",
  })),
}));

vi.mock("./manualSnapshotStore", () => ({
  loadManualImportVaultPasskeyState: vi.fn(async () => ({
    supported: true,
    supportReason: null,
    configured: false,
    sessionStatus: "not-configured",
    keyMaterialMode: null,
    displayName: null,
    rpId: null,
    createdAt: null,
    lastVerifiedAt: null,
  })),
  enableManualImportVaultPasskey: vi.fn(),
  unlockManualImportVaultPasskey: vi.fn(),
  lockManualImportVaultSession: vi.fn(),
  disableManualImportVaultPasskey: vi.fn(),
  isVaultLockedError: vi.fn(() => false),
}));

vi.mock("./sigaaBridge", () => ({
  readExtensionBridgeStatus: vi.fn(async () => ({
    installed: false,
    extensionId: null,
    sessionState: "unknown",
    credentialState: null,
  })),
}));

import App from "./App";

describe("App", () => {
  it("renders the public onboarding shell", async () => {
    render(<App />);

    expect(await screen.findAllByText("Formaê")).not.toHaveLength(0);
    expect(
      await screen.findByText(
        /Instale a extensão e conecte o SIGAA sem backend/i,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findAllByRole("link", { name: /Instalar extensão/i }),
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByRole("link", { name: "Privacidade" }),
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByRole("link", { name: "Suporte" }),
    ).not.toHaveLength(0);
    expect(
      await screen.findByText(/Nenhum snapshot acadêmico salvo/i),
    ).toBeInTheDocument();
  });
});
