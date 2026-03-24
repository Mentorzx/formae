import {
  openLocalStudentSnapshotBundleFromVault,
  openManualImportSnapshotFromVault,
  sealLocalStudentSnapshotBundleForVault,
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
      retentionMode: "full-raw-text" as const,
      timingProfileId: "Ufba2025" as const,
      rawInput: "MATA37 35N12",
      detectedScheduleCodes: ["35N12"],
      detectedComponentCodes: ["MATA37"],
      preferredCurriculumSeedId: null,
      matchedCatalogComponentCodes: ["MATA37"],
      previewWarnings: [],
      structuredContext: null,
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
    expect(vaultRecord.contentKeyId).toBe("test-key");
    expect(vaultRecord.keyDerivation).toBe("browser-local-wrap");
    expect(vaultRecord.ciphertextB64).not.toContain(snapshot.rawInput);
    expect(restoredSnapshot).toEqual(snapshot);
  });

  it("round-trips a consolidated student snapshot bundle through the vault", async () => {
    const encryptionKey = await globalThis.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const bundle = {
      schemaVersion: 1 as const,
      source: "manual-import" as const,
      derivedAt: "2026-03-23T22:30:00.000Z",
      manualImport: {
        schemaVersion: 1 as const,
        snapshotId: "snapshot-1",
        savedAt: "2026-03-23T22:00:00.000Z",
        source: "plain-text" as const,
        retentionMode: "full-raw-text" as const,
        timingProfileId: "Ufba2025" as const,
        rawInput: "MATA37 35N12",
        detectedScheduleCodes: ["35N12"],
        detectedComponentCodes: ["MATA37"],
        preferredCurriculumSeedId: null,
        matchedCatalogComponentCodes: ["MATA37"],
        previewWarnings: [],
        structuredContext: null,
        normalizedSchedules: [],
      },
      studentSnapshot: {
        schemaVersion: 1 as const,
        generatedAt: "2026-03-23T22:30:00.000Z",
        studentNumber: "manual-import",
        studentName: "Snapshot local provisório",
        curriculum: {
          curriculumId: "manual-snapshot-1",
          name: "Curriculo provisório derivado de importacao manual",
          course: {
            code: "UFBA-MANUAL",
            name: "Curso UFBA provisório",
            campus: "UFBA",
            degreeLevel: "unknown",
            totalWorkloadHours: 0,
          },
          components: [],
          prerequisiteRules: [],
          equivalences: [],
        },
        completedComponents: [],
        inProgressComponents: [],
        scheduleBlocks: [],
        pendingRequirements: [],
        issuedDocuments: [],
      },
    };

    const vaultRecord = await sealLocalStudentSnapshotBundleForVault(
      bundle,
      encryptionKey,
      "test-key",
    );
    const restoredBundle = await openLocalStudentSnapshotBundleFromVault(
      vaultRecord,
      encryptionKey,
    );

    expect(vaultRecord.payloadKind).toBe("localStudentSnapshotBundle");
    expect(vaultRecord.contentKeyId).toBe("test-key");
    expect(vaultRecord.keyDerivation).toBe("browser-local-wrap");
    expect(vaultRecord.ciphertextB64).not.toContain(
      bundle.manualImport.rawInput,
    );
    expect(restoredBundle).toEqual(bundle);
  });
});
