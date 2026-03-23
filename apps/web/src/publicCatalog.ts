import type { TimingProfileId } from "@formae/protocol";
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

export interface PublicCatalogIndex {
  schemaVersion: number;
  generatedAt: string;
  institution: "UFBA";
  timingProfileId: TimingProfileId;
  sources: PublicCatalogSource[];
  components: PublicCatalogComponent[];
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
