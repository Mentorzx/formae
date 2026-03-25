import {
  findBestCurriculumSeed,
  findCurriculumStructureGroup,
  publicCatalogCurriculumDetails,
  publicCatalogCurriculumProfiles,
  publicCatalogCurriculumStructureIndex,
  publicCatalogProvenance,
  publicCatalogSnapshot,
  publicCatalogSourceCoverage,
  publicCatalogSummary,
  rankCurriculumSeeds,
  resolveCurriculumSeed,
} from "./publicCatalog";

describe("publicCatalog", () => {
  it("resolves the seeded curriculum with the highest overlap", () => {
    const curriculum = findBestCurriculumSeed(["BIOD01", "FIS123", "MATA37"]);

    expect(curriculum?.id).toBe("ufba-trilha-base-2026-seed");
    expect(curriculum?.components.map((component) => component.code)).toContain(
      "PROJ01",
    );
  });

  it("ranks multiple seed candidates and flags ambiguous selections", () => {
    const rankedMatches = rankCurriculumSeeds(["BIOD01", "MATA37"]);
    const resolution = resolveCurriculumSeed(["BIOD01", "MATA37"]);

    expect(rankedMatches.map((match) => match.curriculum.id)).toEqual([
      "ufba-trilha-base-2026-seed",
      "ufba-trilha-interdisciplinar-2026-seed",
    ]);
    expect(resolution.selectedMatch?.curriculum.id).toBe(
      "ufba-trilha-base-2026-seed",
    );
    expect(resolution.isAmbiguous).toBe(true);
    expect(resolution.requiresReview).toBe(true);
    expect(resolution.reason).toMatch(/Empate tecnico/i);
  });

  it("marks low-confidence selections when only one component overlaps", () => {
    const resolution = resolveCurriculumSeed(["FIS123"]);

    expect(resolution.selectedMatch?.curriculum.id).toBe(
      "ufba-trilha-base-2026-seed",
    );
    expect(resolution.confidence).toBe("low");
    expect(resolution.requiresReview).toBe(true);
    expect(resolution.reason).toMatch(/apenas 1 componente/i);
  });

  it("honors a manual curriculum override and suppresses automatic review", () => {
    const resolution = resolveCurriculumSeed(
      ["BIOD01", "MATA37"],
      "ufba-trilha-interdisciplinar-2026-seed",
    );

    expect(resolution.selectedMatch?.curriculum.id).toBe(
      "ufba-trilha-interdisciplinar-2026-seed",
    );
    expect(resolution.selectionMode).toBe("manual-override");
    expect(resolution.requiresReview).toBe(false);
    expect(resolution.reason).toMatch(/fixada manualmente/i);
  });

  it("returns null when there is no overlap with any seed curriculum", () => {
    expect(findBestCurriculumSeed(["ZZZ999"])).toBeNull();
  });

  it("exposes curriculum counts in the public summary", () => {
    expect(publicCatalogSummary.curriculumCount).toBe(2);
    expect(publicCatalogSummary.curriculumStructureCount).toBe(17);
    expect(publicCatalogSummary.curriculumDetailCount).toBeGreaterThan(0);
  });

  it("surfaces catalog snapshot provenance and source coverage", () => {
    expect(publicCatalogSnapshot.builderVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(publicCatalogProvenance.sourceCount).toBe(
      publicCatalogSnapshot.sources.length,
    );
    expect(publicCatalogProvenance.pageCount).toBeGreaterThan(0);
    expect(publicCatalogProvenance.fixtureBackedPageCount).toBeLessThanOrEqual(
      publicCatalogProvenance.pageCount,
    );
    expect(publicCatalogProvenance.curriculumStructureCount).toBe(17);
    expect(publicCatalogProvenance.curriculumDetailCount).toBeGreaterThan(0);
    expect(publicCatalogSourceCoverage).toHaveLength(
      publicCatalogSnapshot.sources.length,
    );

    const sigaaCoverage = publicCatalogSourceCoverage.find(
      (coverage) => coverage.source.id === "sigaa-public-turmas",
    );

    expect(sigaaCoverage?.componentCodeCount).toBeGreaterThan(0);
    expect(sigaaCoverage?.scheduleCodeCount).toBeGreaterThan(0);
    expect(sigaaCoverage?.curriculumDetailCount).toBe(0);

    const curriculumCoverage = publicCatalogSourceCoverage.find(
      (coverage) => coverage.source.id === "eng-civil-curriculo",
    );

    expect(curriculumCoverage?.curriculumDetailCount).toBeGreaterThan(0);
  });

  it("indexes curriculum structures by intake and exposes rule profiles", () => {
    expect(publicCatalogCurriculumStructureIndex).toHaveLength(17);
    expect(publicCatalogCurriculumDetails.length).toBeGreaterThan(0);

    const activeGroup = findCurriculumStructureGroup("2477782");
    const inactiveGroup = findCurriculumStructureGroup("1880549");

    expect(activeGroup).toEqual({
      curriculumId: "2477782",
      structureCount: 1,
      activeCount: 1,
      inactiveCount: 0,
      unknownCount: 0,
      codes: ["G20251"],
      groupLabels: ["Matutino e Vespertino"],
      sourceIds: ["eng-civil-curriculo"],
      latestCreatedYear: 2025,
    });
    expect(inactiveGroup?.inactiveCount).toBe(1);
    expect(inactiveGroup?.codes).toEqual(["102140"]);

    const baseProfile = publicCatalogCurriculumProfiles.find(
      (profile) => profile.curriculumId === "ufba-trilha-base-2026-seed",
    );
    const interdisciplinaryProfile = publicCatalogCurriculumProfiles.find(
      (profile) =>
        profile.curriculumId === "ufba-trilha-interdisciplinar-2026-seed",
    );

    expect(baseProfile).toMatchObject({
      curriculumId: "ufba-trilha-base-2026-seed",
      versionTag: "2026.1-seed",
      courseCode: "UFBA-BASE-SEED",
      courseName: "Trilha base UFBA",
      componentCount: 8,
      prerequisiteRuleCount: 3,
      equivalenceCount: 0,
      rootComponentCodes: ["BIOD01", "LETR01", "MATA37", "MATD01", "QUI101"],
      leafComponentCodes: ["BIOT02", "FIS123", "MATD01", "PROJ01", "QUI101"],
      maxPrerequisiteDepth: 1,
    });

    expect(interdisciplinaryProfile).toMatchObject({
      curriculumId: "ufba-trilha-interdisciplinar-2026-seed",
      versionTag: "2026.1-seed",
      courseCode: "UFBA-INTER-SEED",
      courseName: "Trilha interdisciplinar UFBA",
      componentCount: 8,
      prerequisiteRuleCount: 2,
      equivalenceCount: 0,
      rootComponentCodes: [
        "BIOD01",
        "DCC105",
        "LETR01",
        "MATA37",
        "MATD01",
        "SOC115",
      ],
      leafComponentCodes: [
        "DCC105",
        "EST201",
        "LETR01",
        "MATD01",
        "PROJ11",
        "SOC115",
      ],
      maxPrerequisiteDepth: 1,
    });
  });
});
