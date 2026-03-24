import { findBestCurriculumSeed, publicCatalogSummary } from "./publicCatalog";

describe("publicCatalog", () => {
  it("resolves the seeded curriculum with the highest overlap", () => {
    const curriculum = findBestCurriculumSeed(["BIOD01", "MATA37"]);

    expect(curriculum?.id).toBe("ufba-trilha-base-2026-seed");
    expect(curriculum?.components.map((component) => component.code)).toContain(
      "PROJ01",
    );
  });

  it("returns null when there is no overlap with any seed curriculum", () => {
    expect(findBestCurriculumSeed(["ZZZ999"])).toBeNull();
  });

  it("exposes curriculum counts in the public summary", () => {
    expect(publicCatalogSummary.curriculumCount).toBe(1);
  });
});
