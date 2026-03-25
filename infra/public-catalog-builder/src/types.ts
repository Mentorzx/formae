export type PublicCatalogSourceKind = "html";
export type PublicCatalogSourceOrigin = "fixture" | "live";

export interface PublicCatalogSourceDefinition {
  id: string;
  title: string;
  kind: PublicCatalogSourceKind;
  url: string;
  fixture: string | null;
  notes: string[];
}

export interface PublicCatalogPageSnapshot {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  origin: PublicCatalogSourceOrigin;
  contentDigest: string;
  contentLength: number;
  contentType: string | null;
  httpStatus: number | null;
  responseEtag: string | null;
  responseLastModified: string | null;
  title: string;
  headingCount: number;
  linkCount: number;
  textExcerpt: string;
  componentCodes: string[];
  scheduleCodes: string[];
  timeSlotCodes: string[];
}

export interface PublicCatalogPageCoreSnapshot {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  origin: PublicCatalogSourceOrigin;
  title: string;
  headingCount: number;
  linkCount: number;
  textExcerpt: string;
  componentCodes: string[];
  scheduleCodes: string[];
  timeSlotCodes: string[];
}

export interface PublicCatalogCurriculumStructureEntry {
  curriculumId: string;
  code: string;
  label: string;
  groupLabel: string;
  status: "active" | "inactive" | "unknown";
  createdYear: number | null;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePageOrigin?: PublicCatalogSourceOrigin;
  sourcePageFinalUrl?: string;
  sourcePageFetchedAt?: string;
  sourcePageContentDigest?: string;
  evidence: string[];
}

export interface PublicCatalogCurriculumDetailComponentEntry {
  code: string;
  title: string;
  workloadHours: number | null;
  categoryLabel: string | null;
  componentId: string | null;
  evidence: string[];
}

export interface PublicCatalogCurriculumDetailSectionEntry {
  sectionId: string;
  label: string;
  kind: "term" | "elective" | "complementary" | "unknown";
  periodOrdinal: number | null;
  components: PublicCatalogCurriculumDetailComponentEntry[];
}

export interface PublicCatalogCurriculumDetailEntry {
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
  detailPageOrigin: PublicCatalogSourceOrigin;
  detailPageFinalUrl: string;
  detailPageFetchedAt: string;
  detailPageContentDigest: string;
  sectionCount: number;
  componentCount: number;
  sections: PublicCatalogCurriculumDetailSectionEntry[];
  evidence: string[];
}

export interface PublicCatalogComponentCandidate {
  code: string;
  title: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  scheduleCode: string | null;
  canonicalScheduleCode: string | null;
  evidence: string[];
}

export interface PublicCatalogScheduleGuideEntry {
  code: string;
  description: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  evidence: string[];
}

export interface PublicCatalogTimeSlotEntry {
  slot: string;
  turn: "morning" | "afternoon" | "night";
  label: string;
  startTime: string;
  endTime: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface PublicCatalogSnapshot {
  schemaVersion: 2;
  builderVersion: string;
  generatedAt: string;
  institution: "UFBA";
  timingProfileId: "Ufba2025";
  sources: PublicCatalogSourceDefinition[];
  pages: PublicCatalogPageSnapshot[];
  curriculumStructures: PublicCatalogCurriculumStructureEntry[];
  curriculumDetails: PublicCatalogCurriculumDetailEntry[];
  components: PublicCatalogComponentCandidate[];
  scheduleGuide: PublicCatalogScheduleGuideEntry[];
  timeSlots: PublicCatalogTimeSlotEntry[];
  notes: string[];
}

export interface PublicCatalogSourceStatus {
  sourceId: string;
  origin: PublicCatalogSourceOrigin;
  finalUrl: string;
  title: string;
  contentDigest: string;
  contentLength: number;
  contentType: string | null;
  httpStatus: number | null;
  responseEtag: string | null;
  responseLastModified: string | null;
}
