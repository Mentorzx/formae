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
  fixture: string | null;
  notes: string[];
}

export interface PublicCatalogSnapshotPage {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  origin: "fixture" | "live";
  title: string;
  headingCount: number;
  linkCount: number;
  textExcerpt: string;
  componentCodes: string[];
  scheduleCodes: string[];
  timeSlotCodes: string[];
  contentDigest?: string;
  contentLength?: number;
  contentType?: string | null;
  httpStatus?: number;
  responseEtag?: string | null;
  responseLastModified?: string | null;
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
  curriculumStructures: PublicCatalogSnapshotCurriculumStructure[];
  curriculumDetails: PublicCatalogSnapshotCurriculumDetail[];
  components: PublicCatalogSnapshotComponent[];
  scheduleGuide: PublicCatalogSnapshotScheduleGuideEntry[];
  timeSlots: PublicCatalogSnapshotTimeSlot[];
  notes: string[];
}

export interface PublicCatalogSnapshotCurriculumStructure {
  curriculumId: string;
  code: string;
  label: string;
  groupLabel: string;
  status: "active" | "inactive" | "unknown";
  createdYear: number | null;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePageOrigin?: "fixture" | "live";
  sourcePageFinalUrl?: string;
  sourcePageFetchedAt?: string;
  sourcePageContentDigest?: string;
  evidence: string[];
}

export interface PublicCatalogSnapshotCurriculumDetailComponent {
  code: string;
  title: string;
  workloadHours: number | null;
  categoryLabel: string | null;
  componentId: string | null;
  evidence: string[];
}

export interface PublicCatalogSnapshotCurriculumDetailSection {
  sectionId: string;
  label: string;
  kind: "term" | "elective" | "complementary" | "unknown";
  periodOrdinal: number | null;
  components: PublicCatalogSnapshotCurriculumDetailComponent[];
}

export interface PublicCatalogSnapshotCurriculumDetail {
  curriculumId: string;
  curriculumCode: string;
  curriculumLabel: string;
  matrixName: string | null;
  entryPeriodLabel: string | null;
  totalMinimumHours: number | null;
  minimumOptionalHours: number | null;
  minimumComplementaryHours: number | null;
  maximumTermHours: number | null;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  detailPageOrigin: "fixture" | "live";
  detailPageFinalUrl: string;
  detailPageFetchedAt: string;
  detailPageContentDigest: string;
  sectionCount: number;
  componentCount: number;
  sections: PublicCatalogSnapshotCurriculumDetailSection[];
  evidence: string[];
}

export interface PublicCatalogCurriculumStructureGroup {
  curriculumId: string;
  structureCount: number;
  activeCount: number;
  inactiveCount: number;
  unknownCount: number;
  codes: string[];
  groupLabels: string[];
  sourceIds: string[];
  latestCreatedYear: number | null;
}

export interface PublicCatalogCurriculumProfile {
  curriculumId: string;
  versionTag: string;
  courseCode: string;
  courseName: string;
  componentCount: number;
  prerequisiteRuleCount: number;
  equivalenceCount: number;
  rootComponentCodes: string[];
  leafComponentCodes: string[];
  maxPrerequisiteDepth: number;
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
  curriculumDetailCount: number;
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
const snapshot = normalizePublicCatalogSnapshot(
  publicCatalogSnapshotIndex as Partial<PublicCatalogSnapshot>,
);

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

export const publicCatalogCurriculumStructures = [
  ...publicCatalogSnapshot.curriculumStructures,
].sort((left, right) => {
  const curriculumCompare = left.curriculumId.localeCompare(right.curriculumId);
  return curriculumCompare !== 0
    ? curriculumCompare
    : left.code.localeCompare(right.code);
});

export const publicCatalogCurriculumDetails = [
  ...publicCatalogSnapshot.curriculumDetails,
].sort((left, right) => {
  const sourceCompare = left.sourceId.localeCompare(right.sourceId);
  return sourceCompare !== 0
    ? sourceCompare
    : left.curriculumCode.localeCompare(right.curriculumCode);
});

export const publicCatalogCurriculumStructureIndex =
  buildCurriculumStructureIndex(publicCatalogCurriculumStructures);

export const publicCatalogCurriculumProfiles = publicCatalog.curricula.map(
  (curriculum) => buildCurriculumProfile(curriculum),
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
  curriculumStructureCount: publicCatalogSnapshot.curriculumStructures.length,
  curriculumDetailCount: publicCatalogSnapshot.curriculumDetails.length,
  curriculumDetailComponentCount:
    publicCatalogSnapshot.curriculumDetails.reduce(
      (total, detail) => total + detail.componentCount,
      0,
    ),
  activeCurriculumStructureCount:
    publicCatalogSnapshot.curriculumStructures.filter(
      (entry) => entry.status === "active",
    ).length,
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
  curriculumStructureCount: publicCatalogCurriculumStructures.length,
  curriculumDetailCount: publicCatalogCurriculumDetails.length,
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

  const strongestAlternative = alternativeMatches[0] ?? null;
  const isAmbiguous =
    strongestAlternative !== null &&
    haveEquivalentSelectionWeight(selectedMatch, strongestAlternative);
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

export function findCurriculumStructureGroup(
  curriculumId: string,
): PublicCatalogCurriculumStructureGroup | null {
  return (
    publicCatalogCurriculumStructureIndex.find(
      (group) => group.curriculumId === curriculumId,
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
  const curriculumDetailCount = publicCatalogSnapshot.curriculumDetails.filter(
    (detail) => detail.sourceId === source.id,
  ).length;

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
    curriculumDetailCount,
    pageCoverageRatio:
      publicCatalogSnapshot.pages.length === 0
        ? 0
        : pages.length / publicCatalogSnapshot.pages.length,
  };
}

function normalizePublicCatalogSnapshot(
  snapshot: Partial<PublicCatalogSnapshot>,
): PublicCatalogSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion ?? 1,
    builderVersion: snapshot.builderVersion ?? "0.0.0",
    generatedAt: snapshot.generatedAt ?? "",
    institution: snapshot.institution ?? "UFBA",
    timingProfileId: snapshot.timingProfileId ?? "Ufba2025",
    sources: snapshot.sources ?? [],
    pages: snapshot.pages ?? [],
    curriculumStructures: snapshot.curriculumStructures ?? [],
    curriculumDetails: snapshot.curriculumDetails ?? [],
    components: snapshot.components ?? [],
    scheduleGuide: snapshot.scheduleGuide ?? [],
    timeSlots: snapshot.timeSlots ?? [],
    notes: snapshot.notes ?? [],
  };
}

function buildCurriculumStructureIndex(
  structures: PublicCatalogSnapshotCurriculumStructure[],
): PublicCatalogCurriculumStructureGroup[] {
  const grouped = new Map<string, PublicCatalogSnapshotCurriculumStructure[]>();

  for (const structure of structures) {
    const currentEntries = grouped.get(structure.curriculumId) ?? [];
    currentEntries.push(structure);
    grouped.set(structure.curriculumId, currentEntries);
  }

  return Array.from(grouped.entries())
    .map(([curriculumId, entries]) => {
      const latestCreatedYear =
        entries
          .map((entry) => entry.createdYear)
          .filter((value): value is number => value !== null)
          .sort((left, right) => right - left)[0] ?? null;

      return {
        curriculumId,
        structureCount: entries.length,
        activeCount: entries.filter((entry) => entry.status === "active")
          .length,
        inactiveCount: entries.filter((entry) => entry.status === "inactive")
          .length,
        unknownCount: entries.filter((entry) => entry.status === "unknown")
          .length,
        codes: uniqueSorted(entries.map((entry) => entry.code)),
        groupLabels: uniqueSorted(entries.map((entry) => entry.groupLabel)),
        sourceIds: uniqueSorted(entries.map((entry) => entry.sourceId)),
        latestCreatedYear,
      };
    })
    .sort((left, right) => left.curriculumId.localeCompare(right.curriculumId));
}

function buildCurriculumProfile(
  curriculum: PublicCatalogCurriculumSeed,
): PublicCatalogCurriculumProfile {
  const graph = buildCurriculumPrerequisiteGraph(curriculum);

  return {
    curriculumId: curriculum.id,
    versionTag: curriculum.versionTag,
    courseCode: curriculum.course.code,
    courseName: curriculum.course.name,
    componentCount: curriculum.components.length,
    prerequisiteRuleCount: curriculum.prerequisiteRules.length,
    equivalenceCount: curriculum.equivalences.length,
    rootComponentCodes: graph.rootComponentCodes,
    leafComponentCodes: graph.leafComponentCodes,
    maxPrerequisiteDepth: graph.maxPrerequisiteDepth,
  };
}

function buildCurriculumPrerequisiteGraph(
  curriculum: PublicCatalogCurriculumSeed,
): {
  rootComponentCodes: string[];
  leafComponentCodes: string[];
  maxPrerequisiteDepth: number;
} {
  const componentCodes = curriculum.components.map(
    (component) => component.code,
  );
  const prerequisiteMap = new Map<string, string[]>(
    componentCodes.map((code) => [code, []]),
  );
  const dependentMap = new Map<string, string[]>(
    componentCodes.map((code) => [code, []]),
  );

  for (const rule of curriculum.prerequisiteRules) {
    const requiredCodes = uniqueSorted(rule.requiredComponentCodes).filter(
      (code) => code !== rule.componentCode,
    );
    const currentPrerequisites = prerequisiteMap.get(rule.componentCode) ?? [];
    prerequisiteMap.set(
      rule.componentCode,
      uniqueSorted([...currentPrerequisites, ...requiredCodes]),
    );

    for (const requiredCode of requiredCodes) {
      const currentDependents = dependentMap.get(requiredCode) ?? [];
      dependentMap.set(
        requiredCode,
        uniqueSorted([...currentDependents, rule.componentCode]),
      );
    }
  }

  const rootComponentCodes = componentCodes.filter(
    (code) => (prerequisiteMap.get(code) ?? []).length === 0,
  );
  const leafComponentCodes = componentCodes.filter(
    (code) => (dependentMap.get(code) ?? []).length === 0,
  );
  const depthMemo = new Map<string, number>();

  const maxPrerequisiteDepth = componentCodes.reduce((maxDepth, code) => {
    return Math.max(maxDepth, getPrerequisiteDepth(code));
  }, 0);

  return {
    rootComponentCodes: uniqueSorted(rootComponentCodes),
    leafComponentCodes: uniqueSorted(leafComponentCodes),
    maxPrerequisiteDepth,
  };

  function getPrerequisiteDepth(componentCode: string): number {
    const cachedDepth = depthMemo.get(componentCode);
    if (cachedDepth !== undefined) {
      return cachedDepth;
    }

    const prerequisites = prerequisiteMap.get(componentCode) ?? [];
    if (prerequisites.length === 0) {
      depthMemo.set(componentCode, 0);
      return 0;
    }

    const depth =
      1 +
      Math.max(
        ...prerequisites.map((prerequisiteCode) =>
          getPrerequisiteDepth(prerequisiteCode),
        ),
      );
    depthMemo.set(componentCode, depth);
    return depth;
  }
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}
