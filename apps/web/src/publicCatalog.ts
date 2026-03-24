import type {
  Component,
  Course,
  Equivalence,
  PrerequisiteRule,
  TimingProfileId,
} from "@formae/protocol";
import catalogIndex from "../../../infra/static-data/catalog-index.json";

export interface PublicCatalogSource {
  id: string;
  title: string;
  kind: "html";
  url: string;
  pii: "none";
}

export interface PublicCatalogComponent {
  code: string;
  title: string;
  sourceId: string;
  scheduleCode: string;
  canonicalScheduleCode: string;
  summary: string;
}

export interface PublicCatalogShortcut {
  label: string;
  url: string;
  kind: "validation" | "guide";
}

export interface PublicCatalogCurriculumSeed {
  id: string;
  versionTag: string;
  name: string;
  course: Course;
  components: Component[];
  prerequisiteRules: PrerequisiteRule[];
  equivalences: Equivalence[];
  notes: string[];
}

export interface PublicCatalogIndex {
  schemaVersion: number;
  generatedAt: string;
  institution: "UFBA";
  timingProfileId: TimingProfileId;
  sources: PublicCatalogSource[];
  components: PublicCatalogComponent[];
  curricula: PublicCatalogCurriculumSeed[];
  documentShortcuts: PublicCatalogShortcut[];
  notes: string[];
}

const catalog = catalogIndex as PublicCatalogIndex;

export const publicCatalog: PublicCatalogIndex = {
  ...catalog,
  components: [...catalog.components].sort((left, right) =>
    left.code.localeCompare(right.code),
  ),
};

export const publicCatalogSummary = {
  sourceCount: publicCatalog.sources.length,
  componentCount: publicCatalog.components.length,
  curriculumCount: publicCatalog.curricula.length,
  shortcutCount: publicCatalog.documentShortcuts.length,
};

export function findCatalogMatches(
  componentCodes: string[],
): PublicCatalogComponent[] {
  const lookup = new Set(componentCodes);
  return publicCatalog.components.filter((component) =>
    lookup.has(component.code),
  );
}

export function findBestCurriculumSeed(
  componentCodes: string[],
): PublicCatalogCurriculumSeed | null {
  const lookup = new Set(componentCodes);
  const rankedMatches = publicCatalog.curricula
    .map((curriculum) => {
      const matchedCount = curriculum.components.filter((component) =>
        lookup.has(component.code),
      ).length;

      return {
        curriculum,
        matchedCount,
        coverageRatio:
          curriculum.components.length === 0
            ? 0
            : matchedCount / curriculum.components.length,
      };
    })
    .filter((item) => item.matchedCount > 0)
    .sort((left, right) => {
      if (right.matchedCount !== left.matchedCount) {
        return right.matchedCount - left.matchedCount;
      }

      if (right.coverageRatio !== left.coverageRatio) {
        return right.coverageRatio - left.coverageRatio;
      }

      return (
        left.curriculum.components.length - right.curriculum.components.length
      );
    });

  return rankedMatches[0]?.curriculum ?? null;
}
