import type {
  Component,
  Course,
  Equivalence,
  PrerequisiteRule,
  TimingProfileId,
} from "@formae/protocol";
import catalogIndex from "../../../infra/static-data/catalog-index.json";
import publicCatalogSnapshotIndex from "../../../infra/static-data/public-catalog.snapshot.json";

export interface PublicCatalogSource {
  id: string;
  title: string;
  kind: "html";
  url: string;
  pii: "none";
}

export interface PublicCatalogSnapshotSource {
  id: string;
  title: string;
  kind: "html";
  url: string;
  fixture: string;
  notes: string[];
}

export interface PublicCatalogSnapshotPage {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  origin: "fixture";
  title: string;
  headingCount: number;
  linkCount: number;
  textExcerpt: string;
  componentCodes: string[];
  scheduleCodes: string[];
  timeSlotCodes: string[];
}

export interface PublicCatalogSnapshotComponent {
  code: string;
  title: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  scheduleCode: string;
  canonicalScheduleCode: string;
  evidence: string[];
}

export interface PublicCatalogSnapshotScheduleGuideEntry {
  code: string;
  description: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  evidence: string[];
}

export interface PublicCatalogSnapshotTimeSlot {
  slot: string;
  turn: string;
  label: string;
  startTime: string;
  endTime: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface PublicCatalogSnapshot {
  schemaVersion: number;
  builderVersion: string;
  generatedAt: string;
  institution: "UFBA";
  timingProfileId: TimingProfileId;
  sources: PublicCatalogSnapshotSource[];
  pages: PublicCatalogSnapshotPage[];
  components: PublicCatalogSnapshotComponent[];
  scheduleGuide: PublicCatalogSnapshotScheduleGuideEntry[];
  timeSlots: PublicCatalogSnapshotTimeSlot[];
  notes: string[];
}

export interface PublicCatalogSourceCoverage {
  source: PublicCatalogSnapshotSource & {
    pii: PublicCatalogSource["pii"];
  };
  pageCount: number;
  fixtureBackedPageCount: number;
  componentCodeCount: number;
  scheduleCodeCount: number;
  timeSlotCodeCount: number;
  pageCoverageRatio: number;
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

export interface PublicCatalogCurriculumMatch {
  curriculum: PublicCatalogCurriculumSeed;
  matchedCount: number;
  detectedCoverageRatio: number;
  curriculumCoverageRatio: number;
  matchedComponentCodes: string[];
  missingDetectedCodes: string[];
}

export type CurriculumSeedResolutionConfidence = "high" | "medium" | "low";
export type CurriculumSeedSelectionMode = "automatic" | "manual-override";

export interface CurriculumSeedResolution {
  selectedMatch: PublicCatalogCurriculumMatch | null;
  alternativeMatches: PublicCatalogCurriculumMatch[];
  confidence: CurriculumSeedResolutionConfidence;
  isAmbiguous: boolean;
  requiresReview: boolean;
  reason: string;
  selectionMode: CurriculumSeedSelectionMode;
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
const snapshot = publicCatalogSnapshotIndex as unknown as PublicCatalogSnapshot;

export const publicCatalog: PublicCatalogIndex = {
  ...catalog,
  components: [...catalog.components].sort((left, right) =>
    left.code.localeCompare(right.code),
  ),
};

export const publicCatalogSnapshot: PublicCatalogSnapshot = snapshot;

export const publicCatalogSourceCoverage = publicCatalogSnapshot.sources.map(
  (source) => buildSourceCoverage(source),
);

export const publicCatalogProvenance = {
  schemaVersion: publicCatalogSnapshot.schemaVersion,
  builderVersion: publicCatalogSnapshot.builderVersion,
  generatedAt: publicCatalogSnapshot.generatedAt,
  sourceCount: publicCatalogSnapshot.sources.length,
  pageCount: publicCatalogSnapshot.pages.length,
  fixtureBackedPageCount: publicCatalogSnapshot.pages.filter(
    (page) => page.origin === "fixture",
  ).length,
  componentCount: publicCatalogSnapshot.components.length,
  scheduleGuideCount: publicCatalogSnapshot.scheduleGuide.length,
  timeSlotCount: publicCatalogSnapshot.timeSlots.length,
  noteCount: publicCatalogSnapshot.notes.length,
  pagesWithComponentEvidence: publicCatalogSnapshot.pages.filter(
    (page) => page.componentCodes.length > 0,
  ).length,
  pagesWithScheduleEvidence: publicCatalogSnapshot.pages.filter(
    (page) => page.scheduleCodes.length > 0,
  ).length,
};

export const publicCatalogSummary = {
  sourceCount: publicCatalog.sources.length,
  componentCount: publicCatalog.components.length,
  curriculumCount: publicCatalog.curricula.length,
  shortcutCount: publicCatalog.documentShortcuts.length,
  snapshotSourceCount: publicCatalogSnapshot.sources.length,
  snapshotPageCount: publicCatalogSnapshot.pages.length,
  snapshotFixtureBackedPageCount:
    publicCatalogProvenance.fixtureBackedPageCount,
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
  preferredCurriculumSeedId: string | null = null,
): PublicCatalogCurriculumSeed | null {
  return (
    resolveCurriculumSeed(componentCodes, preferredCurriculumSeedId)
      .selectedMatch?.curriculum ?? null
  );
}

export function rankCurriculumSeeds(
  componentCodes: string[],
): PublicCatalogCurriculumMatch[] {
  const detectedCodes = [...new Set(componentCodes)];

  if (detectedCodes.length === 0) {
    return [];
  }

  return publicCatalog.curricula
    .map((curriculum) => createCurriculumMatch(curriculum, detectedCodes))
    .filter((match) => match.matchedCount > 0)
    .sort(compareCurriculumMatches);
}

export function resolveCurriculumSeed(
  componentCodes: string[],
  preferredCurriculumSeedId: string | null = null,
): CurriculumSeedResolution {
  const rankedMatches = rankCurriculumSeeds(componentCodes);
  const preferredCurriculum = preferredCurriculumSeedId
    ? findCurriculumSeedById(preferredCurriculumSeedId)
    : null;

  if (preferredCurriculum) {
    const selectedMatch = createCurriculumMatch(preferredCurriculum, [
      ...new Set(componentCodes),
    ]);

    return {
      selectedMatch,
      alternativeMatches: rankedMatches
        .filter((match) => match.curriculum.id !== preferredCurriculum.id)
        .slice(0, 3),
      confidence: resolveCurriculumConfidence(selectedMatch, false),
      isAmbiguous: false,
      requiresReview: false,
      reason: buildManualCurriculumOverrideReason(selectedMatch),
      selectionMode: "manual-override",
    };
  }

  const selectedMatch = rankedMatches[0] ?? null;
  const alternativeMatches = rankedMatches.slice(1, 4);

  if (componentCodes.length === 0) {
    return {
      selectedMatch: null,
      alternativeMatches: [],
      confidence: "low",
      isAmbiguous: false,
      requiresReview: false,
      reason: "Nenhum componente detectado ainda para estimar a grade seed.",
      selectionMode: "automatic",
    };
  }

  if (!selectedMatch) {
    return {
      selectedMatch: null,
      alternativeMatches: [],
      confidence: "low",
      isAmbiguous: false,
      requiresReview: true,
      reason:
        "Nenhuma grade seed publica teve sobreposicao com os componentes detectados.",
      selectionMode: "automatic",
    };
  }

  const isAmbiguous =
    alternativeMatches.length > 0 &&
    haveEquivalentSelectionWeight(selectedMatch, alternativeMatches[0]);
  const confidence = resolveCurriculumConfidence(selectedMatch, isAmbiguous);
  const requiresReview =
    isAmbiguous ||
    selectedMatch.matchedCount < 2 ||
    selectedMatch.detectedCoverageRatio < 0.5;

  return {
    selectedMatch,
    alternativeMatches,
    confidence,
    isAmbiguous,
    requiresReview,
    reason: buildCurriculumResolutionReason({
      selectedMatch,
      alternativeMatches,
      isAmbiguous,
    }),
    selectionMode: "automatic",
  };
}

export function findCurriculumSeedById(
  curriculumSeedId: string,
): PublicCatalogCurriculumSeed | null {
  return (
    publicCatalog.curricula.find(
      (curriculum) => curriculum.id === curriculumSeedId,
    ) ?? null
  );
}

function createCurriculumMatch(
  curriculum: PublicCatalogCurriculumSeed,
  detectedCodes: string[],
): PublicCatalogCurriculumMatch {
  const curriculumComponentCodes = new Set(
    curriculum.components.map((component) => component.code),
  );
  const matchedComponentCodes = detectedCodes.filter((componentCode) =>
    curriculumComponentCodes.has(componentCode),
  );
  const missingDetectedCodes = detectedCodes.filter(
    (componentCode) => !curriculumComponentCodes.has(componentCode),
  );

  return {
    curriculum,
    matchedCount: matchedComponentCodes.length,
    detectedCoverageRatio:
      detectedCodes.length === 0
        ? 0
        : matchedComponentCodes.length / detectedCodes.length,
    curriculumCoverageRatio:
      curriculum.components.length === 0
        ? 0
        : matchedComponentCodes.length / curriculum.components.length,
    matchedComponentCodes,
    missingDetectedCodes,
  };
}

function compareCurriculumMatches(
  left: PublicCatalogCurriculumMatch,
  right: PublicCatalogCurriculumMatch,
): number {
  if (right.matchedCount !== left.matchedCount) {
    return right.matchedCount - left.matchedCount;
  }

  if (right.detectedCoverageRatio !== left.detectedCoverageRatio) {
    return right.detectedCoverageRatio - left.detectedCoverageRatio;
  }

  if (right.curriculumCoverageRatio !== left.curriculumCoverageRatio) {
    return right.curriculumCoverageRatio - left.curriculumCoverageRatio;
  }

  return left.curriculum.id.localeCompare(right.curriculum.id);
}

function haveEquivalentSelectionWeight(
  left: PublicCatalogCurriculumMatch,
  right: PublicCatalogCurriculumMatch,
): boolean {
  return (
    left.matchedCount === right.matchedCount &&
    left.detectedCoverageRatio === right.detectedCoverageRatio &&
    left.curriculumCoverageRatio === right.curriculumCoverageRatio
  );
}

function resolveCurriculumConfidence(
  selectedMatch: PublicCatalogCurriculumMatch,
  isAmbiguous: boolean,
): CurriculumSeedResolutionConfidence {
  if (isAmbiguous || selectedMatch.matchedCount < 2) {
    return "low";
  }

  if (
    selectedMatch.matchedCount >= 3 &&
    selectedMatch.detectedCoverageRatio >= 0.6
  ) {
    return "high";
  }

  return "medium";
}

function buildCurriculumResolutionReason({
  selectedMatch,
  alternativeMatches,
  isAmbiguous,
}: {
  selectedMatch: PublicCatalogCurriculumMatch;
  alternativeMatches: PublicCatalogCurriculumMatch[];
  isAmbiguous: boolean;
}): string {
  const selectedId = selectedMatch.curriculum.id;

  if (isAmbiguous) {
    const nextMatch = alternativeMatches[0];

    if (!nextMatch) {
      return `Empate tecnico envolvendo ${selectedId}, mas sem segunda opcao materializada na lista local.`;
    }

    return `Empate tecnico entre ${selectedId} e ${nextMatch.curriculum.id} com ${selectedMatch.matchedCount} componentes em comum.`;
  }

  if (selectedMatch.matchedCount < 2) {
    return `A grade seed ${selectedId} foi selecionada com apenas ${selectedMatch.matchedCount} componente(s) em comum.`;
  }

  if (selectedMatch.detectedCoverageRatio < 0.5) {
    return `A grade seed ${selectedId} cobre menos da metade dos componentes detectados no texto importado.`;
  }

  if (alternativeMatches.length > 0) {
    return `A grade seed ${selectedId} venceu o ranking local com ${selectedMatch.matchedCount} componente(s) coincidentes.`;
  }

  return `A grade seed ${selectedId} foi a unica candidata com coincidencia local.`;
}

function buildManualCurriculumOverrideReason(
  selectedMatch: PublicCatalogCurriculumMatch,
): string {
  if (selectedMatch.matchedCount === 0) {
    return `Grade seed fixada manualmente: ${selectedMatch.curriculum.id}, ainda sem sobreposicao com os componentes detectados.`;
  }

  return `Grade seed fixada manualmente: ${selectedMatch.curriculum.id} com ${selectedMatch.matchedCount} componente(s) em comum.`;
}

function buildSourceCoverage(source: PublicCatalogSnapshotSource) {
  const catalogSource = publicCatalog.sources.find(
    (candidate) => candidate.id === source.id,
  );
  const pages = publicCatalogSnapshot.pages.filter(
    (page) => page.sourceId === source.id,
  );
  const uniqueComponentCodes = new Set(
    pages.flatMap((page) => page.componentCodes),
  );
  const uniqueScheduleCodes = new Set(
    pages.flatMap((page) => page.scheduleCodes),
  );
  const uniqueTimeSlotCodes = new Set(
    pages.flatMap((page) => page.timeSlotCodes),
  );

  return {
    source: {
      ...source,
      pii: catalogSource?.pii ?? "none",
    },
    pageCount: pages.length,
    fixtureBackedPageCount: pages.filter((page) => page.origin === "fixture")
      .length,
    componentCodeCount: uniqueComponentCodes.size,
    scheduleCodeCount: uniqueScheduleCodes.size,
    timeSlotCodeCount: uniqueTimeSlotCodes.size,
    pageCoverageRatio:
      publicCatalogSnapshot.pages.length === 0
        ? 0
        : pages.length / publicCatalogSnapshot.pages.length,
  };
}
