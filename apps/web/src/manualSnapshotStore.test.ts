import {
  openManualImportSnapshotFromVault,
  sealManualImportSnapshotForVault,
} from "./manualSnapshotStore";

describe("manualSnapshotStore vault helpers", () => {
  it("round-trips a manual snapshot through the sealed vault envelope", async () => {
    const encryptionKey = await globalThis.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const snapshot = {
      schemaVersion: 1 as const,
      snapshotId: "snapshot-1",
      savedAt: "2026-03-23T22:00:00.000Z",
      source: "plain-text" as const,
      timingProfileId: "Ufba2025" as const,
      rawInput: "MATA37 35N12",
      detectedScheduleCodes: ["35N12"],
      detectedComponentCodes: ["MATA37"],
      matchedCatalogComponentCodes: ["MATA37"],
      previewWarnings: [],
      normalizedSchedules: [
        {
          inputCode: "35N12",
          parser: "rust-wasm" as const,
          result: {
            rawCode: "35N12",
            normalizedCode: "35N12",
            canonicalCode: "35N12",
            meetings: [],
            warnings: [],
            profileId: "Ufba2025" as const,
          },
        },
      ],
    };

    const vaultRecord = await sealManualImportSnapshotForVault(
      snapshot,
      encryptionKey,
      "test-key",
    );
    const restoredSnapshot = await openManualImportSnapshotFromVault(
      vaultRecord,
      encryptionKey,
    );

    expect(vaultRecord.payloadKind).toBe("manualImportStoredSnapshot");
    expect(vaultRecord.keyId).toBe("test-key");
    expect(vaultRecord.ciphertextB64).not.toContain(snapshot.rawInput);
    expect(restoredSnapshot).toEqual(snapshot);
  });
});
