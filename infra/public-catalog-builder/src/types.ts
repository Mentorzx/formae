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
  schemaVersion: 1;
  builderVersion: string;
  generatedAt: string;
  institution: "UFBA";
  timingProfileId: "Ufba2025";
  sources: PublicCatalogSourceDefinition[];
  pages: PublicCatalogPageSnapshot[];
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
