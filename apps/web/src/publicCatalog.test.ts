import {
  findBestCurriculumSeed,
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

  it("returns null when there is no overlap with any seed curriculum", () => {
    expect(findBestCurriculumSeed(["ZZZ999"])).toBeNull();
  });

  it("exposes curriculum counts in the public summary", () => {
    expect(publicCatalogSummary.curriculumCount).toBe(2);
  });
});
