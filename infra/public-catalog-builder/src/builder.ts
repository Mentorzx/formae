import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicCatalogComponentCandidate,
  PublicCatalogPageSnapshot,
  PublicCatalogScheduleGuideEntry,
  PublicCatalogSnapshot,
  PublicCatalogSourceStatus,
  PublicCatalogSourceDefinition,
  PublicCatalogTimeSlotEntry,
} from "./types.js";
import { extractPublicSourceData } from "./extract.js";
import { loadSourcesFile, resolveSourceFixturePath } from "./sources.js";
import { validateCatalogSnapshot } from "./validation.js";

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
  sourceStatuses: PublicCatalogSourceStatus[];
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
    const provenance = createContentProvenance(resolved.html, resolved);

    pages.push({
      ...extracted.page,
      ...provenance,
    });
    components.push(...extracted.components);
    scheduleGuide.push(...extracted.scheduleGuide);
    timeSlots.push(...extracted.timeSlots);
    sourceStatuses.push({
      sourceId: source.id,
      origin: resolved.origin,
      finalUrl: resolved.finalUrl,
      title: extracted.page.title,
      ...provenance,
    });
  }

  const snapshot = {
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
  } satisfies PublicCatalogSnapshot;

  validateCatalogSnapshot(snapshot);

  return {
    snapshot,
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
  contentType: string | null;
  httpStatus: number | null;
  responseEtag: string | null;
  responseLastModified: string | null;
}> {
  const fixturePath = resolveSourceFixturePath(input.source, input.fixturesDir);

  if (fixturePath) {
    const html = await readFile(fixturePath, "utf8");
    return {
      html,
      finalUrl: input.source.url,
      origin: "fixture",
      contentType: "text/html; charset=utf-8",
      httpStatus: 200,
      responseEtag: null,
      responseLastModified: null,
    };
  }

  const response = await fetchWithRetry(
    () =>
      input.fetchImpl(input.source.url, {
        headers: {
          "user-agent": "Formae public-catalog-builder/0.2.0",
          accept: "text/html,application/xhtml+xml",
        },
      }),
    input.source.id,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${input.source.id} from ${input.source.url}: ${response.status} ${response.statusText}`,
    );
  }

  return {
    html: await response.text(),
    finalUrl: response.url || input.source.url,
    origin: "live",
    contentType: response.headers.get("content-type"),
    httpStatus: response.status,
    responseEtag: response.headers.get("etag"),
    responseLastModified: response.headers.get("last-modified"),
  };
}

function createContentProvenance(
  html: string,
  resolved: {
    contentType: string | null;
    httpStatus: number | null;
    responseEtag: string | null;
    responseLastModified: string | null;
  },
): Pick<
  PublicCatalogPageSnapshot,
  | "contentDigest"
  | "contentLength"
  | "contentType"
  | "httpStatus"
  | "responseEtag"
  | "responseLastModified"
> {
  return {
    contentDigest: createHash("sha256").update(html, "utf8").digest("hex"),
    contentLength: Buffer.byteLength(html, "utf8"),
    contentType: resolved.contentType,
    httpStatus: resolved.httpStatus,
    responseEtag: resolved.responseEtag,
    responseLastModified: resolved.responseLastModified,
  };
}

async function fetchWithRetry(
  fetcher: () => Promise<Response>,
  sourceId: string,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(200 * attempt);
      }
    }
  }

  throw new Error(
    `Failed to fetch live source ${sourceId} after ${attempts} attempts: ${formatError(lastError)}`,
  );
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
