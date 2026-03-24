import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicCatalogComponentCandidate,
  PublicCatalogPageSnapshot,
  PublicCatalogScheduleGuideEntry,
  PublicCatalogSnapshot,
  PublicCatalogSourceDefinition,
  PublicCatalogTimeSlotEntry,
} from "./types.js";
import { extractPublicSourceData } from "./extract.js";
import { loadSourcesFile, resolveSourceFixturePath } from "./sources.js";

export interface BuildCatalogSnapshotInput {
  sourcesFilePath?: string;
  sources?: PublicCatalogSourceDefinition[];
  fixturesDir: string | null;
  builderVersion: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export interface BuildCatalogSnapshotResult {
  snapshot: PublicCatalogSnapshot;
  sourceStatuses: Array<{
    sourceId: string;
    origin: "fixture" | "live";
    finalUrl: string;
    title: string;
  }>;
}

export async function buildCatalogSnapshot(
  input: BuildCatalogSnapshotInput,
): Promise<BuildCatalogSnapshotResult> {
  const sources =
    input.sources ?? (input.sourcesFilePath ? await loadSourcesFile(input.sourcesFilePath) : []);

  if (sources.length === 0) {
    throw new Error("No public catalog sources were provided.");
  }

  const fetchedAt = (input.now ?? new Date()).toISOString();
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const pages: PublicCatalogPageSnapshot[] = [];
  const components: PublicCatalogComponentCandidate[] = [];
  const scheduleGuide: PublicCatalogScheduleGuideEntry[] = [];
  const timeSlots: PublicCatalogTimeSlotEntry[] = [];
  const sourceStatuses: BuildCatalogSnapshotResult["sourceStatuses"] = [];

  for (const source of sources) {
    const resolved = await loadSourceHtml({
      source,
      fixturesDir: input.fixturesDir,
      fetchImpl,
    });
    const extracted = extractPublicSourceData(
      source,
      resolved.html,
      fetchedAt,
      resolved.finalUrl,
      resolved.origin,
    );

    pages.push(extracted.page);
    components.push(...extracted.components);
    scheduleGuide.push(...extracted.scheduleGuide);
    timeSlots.push(...extracted.timeSlots);
    sourceStatuses.push({
      sourceId: source.id,
      origin: resolved.origin,
      finalUrl: resolved.finalUrl,
      title: extracted.page.title,
    });
  }

  return {
    snapshot: {
      schemaVersion: 1,
      builderVersion: input.builderVersion,
      generatedAt: fetchedAt,
      institution: "UFBA",
      timingProfileId: "Ufba2025",
      sources,
      pages,
      components: dedupeComponents(components),
      scheduleGuide: dedupeScheduleGuide(scheduleGuide),
      timeSlots: dedupeTimeSlots(timeSlots),
      notes: [
        "First-pass public catalog snapshot built from official public pages.",
        "This artifact is intentionally separate from the private student snapshot pipeline.",
      ],
    },
    sourceStatuses,
  };
}

async function loadSourceHtml(input: {
  source: PublicCatalogSourceDefinition;
  fixturesDir: string | null;
  fetchImpl: typeof fetch;
}): Promise<{
  html: string;
  finalUrl: string;
  origin: "fixture" | "live";
}> {
  const fixturePath = resolveSourceFixturePath(input.source, input.fixturesDir);

  if (fixturePath) {
    const html = await readFile(fixturePath, "utf8");
    return {
      html,
      finalUrl: input.source.url,
      origin: "fixture",
    };
  }

  const response = await input.fetchImpl(input.source.url, {
    headers: {
      "user-agent": "Formae public-catalog-builder/0.1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${input.source.id} from ${input.source.url}: ${response.status} ${response.statusText}`,
    );
  }

  return {
    html: await response.text(),
    finalUrl: response.url || input.source.url,
    origin: "live",
  };
}

function dedupeComponents(
  components: PublicCatalogComponentCandidate[],
): PublicCatalogComponentCandidate[] {
  const byKey = new Map<string, PublicCatalogComponentCandidate>();

  for (const component of components) {
    const key = `${component.sourceId}:${component.code}`;
    if (!byKey.has(key)) {
      byKey.set(key, component);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourceCompare = left.sourceId.localeCompare(right.sourceId);
    return sourceCompare !== 0 ? sourceCompare : left.code.localeCompare(right.code);
  });
}

function dedupeScheduleGuide(
  entries: PublicCatalogScheduleGuideEntry[],
): PublicCatalogScheduleGuideEntry[] {
  const byKey = new Map<string, PublicCatalogScheduleGuideEntry>();

  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.code}:${entry.description}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourceCompare = left.sourceId.localeCompare(right.sourceId);
    return sourceCompare !== 0 ? sourceCompare : left.code.localeCompare(right.code);
  });
}

function dedupeTimeSlots(
  entries: PublicCatalogTimeSlotEntry[],
): PublicCatalogTimeSlotEntry[] {
  const byKey = new Map<string, PublicCatalogTimeSlotEntry>();

  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.slot}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourceCompare = left.sourceId.localeCompare(right.sourceId);
    return sourceCompare !== 0 ? sourceCompare : left.slot.localeCompare(right.slot);
  });
}
