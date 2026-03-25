import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicCatalogComponentCandidate,
  PublicCatalogDiscoveryEntry,
  PublicCatalogDiscoverySnapshot,
  PublicCatalogCurriculumDetailEntry,
  PublicCatalogCurriculumStructureEntry,
  PublicCatalogPageSnapshot,
  PublicCatalogScheduleGuideEntry,
  PublicCatalogSnapshot,
  PublicCatalogSourceStatus,
  PublicCatalogSourceDefinition,
  PublicCatalogTimeSlotEntry,
} from "./types.js";
import {
  extractCurriculumDetailPage,
  extractCurriculumDetailRequests,
  extractPublicCatalogDiscovery,
  extractPublicSourceData,
} from "./extract.js";
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
  discoverySnapshot: PublicCatalogDiscoverySnapshot;
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
  const curriculumStructures: PublicCatalogCurriculumStructureEntry[] = [];
  const curriculumDetails: PublicCatalogCurriculumDetailEntry[] = [];
  const components: PublicCatalogComponentCandidate[] = [];
  const discoveryEntries: PublicCatalogDiscoveryEntry[] = [];
  const scheduleGuide: PublicCatalogScheduleGuideEntry[] = [];
  const timeSlots: PublicCatalogTimeSlotEntry[] = [];
  const sourceStatuses: BuildCatalogSnapshotResult["sourceStatuses"] = [];
  const notes = [
    "First-pass public catalog snapshot built from official public pages.",
    "This artifact is intentionally separate from the private student snapshot pipeline.",
  ];

  for (const source of sources) {
    const resolved = await loadSourceHtml({
      source,
      fixturesDir: input.fixturesDir,
      fetchImpl,
      builderVersion: input.builderVersion,
    });
    const extracted = extractPublicSourceData(
      source,
      resolved.html,
      fetchedAt,
      resolved.finalUrl,
      resolved.origin,
    );
    const provenance = createContentProvenance(resolved.html, resolved);
    discoveryEntries.push(
      ...extractPublicCatalogDiscovery(
        source,
        resolved.html,
        fetchedAt,
        resolved.finalUrl,
        resolved.origin,
      ),
    );

    pages.push({
      ...extracted.page,
      ...provenance,
    });
    curriculumStructures.push(
      ...extracted.curriculumStructures.map((entry) => ({
        ...entry,
        sourcePageOrigin: resolved.origin,
        sourcePageFinalUrl: resolved.finalUrl,
        sourcePageFetchedAt: fetchedAt,
        sourcePageContentDigest: provenance.contentDigest,
      })),
    );
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

    if (source.url.includes("/curriculo.jsf") && resolved.origin === "live") {
      const detailRequests = extractCurriculumDetailRequests(source, resolved.html);
      const detailResult = await loadCurriculumDetails({
        source,
        fetchedAt,
        sourceResolution: resolved,
        detailRequests,
        fetchImpl,
        builderVersion: input.builderVersion,
      });

      curriculumDetails.push(...detailResult.details);
      components.push(...detailResult.components);
      notes.push(...detailResult.notes);
    }
  }

  const snapshot = {
    schemaVersion: 2,
    builderVersion: input.builderVersion,
    generatedAt: fetchedAt,
    institution: "UFBA",
    timingProfileId: "Ufba2025",
    sources,
    pages,
    curriculumStructures: dedupeCurriculumStructures(curriculumStructures),
    curriculumDetails: dedupeCurriculumDetails(curriculumDetails),
    components: dedupeComponents(components),
    scheduleGuide: dedupeScheduleGuide(scheduleGuide),
    timeSlots: dedupeTimeSlots(timeSlots),
    notes: Array.from(new Set(notes)),
  } satisfies PublicCatalogSnapshot;

  validateCatalogSnapshot(snapshot);
  const discoverySnapshot = {
    schemaVersion: 1,
    builderVersion: input.builderVersion,
    generatedAt: fetchedAt,
    institution: "UFBA",
    entries: dedupeDiscoveryEntries(discoveryEntries),
    notes: [
      "Deterministic discovery artifact built from official public roots.",
      "This index is additive and does not replace the public catalog snapshot.",
    ],
  } satisfies PublicCatalogDiscoverySnapshot;

  return {
    snapshot,
    discoverySnapshot,
    sourceStatuses,
  };
}

async function loadSourceHtml(input: {
  source: PublicCatalogSourceDefinition;
  fixturesDir: string | null;
  fetchImpl: typeof fetch;
  builderVersion: string;
}): Promise<{
  html: string;
  finalUrl: string;
  origin: "fixture" | "live";
  contentType: string | null;
  httpStatus: number | null;
  responseEtag: string | null;
  responseLastModified: string | null;
  responseCookies: string[];
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
      responseCookies: [],
    };
  }

  const response = await fetchWithRetry(
    () =>
      input.fetchImpl(input.source.url, {
        headers: {
          "user-agent": `Formae public-catalog-builder/${input.builderVersion}`,
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
    responseCookies: extractResponseCookies(response.headers),
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

function dedupeCurriculumStructures(
  entries: PublicCatalogCurriculumStructureEntry[],
): PublicCatalogCurriculumStructureEntry[] {
  const byKey = new Map<string, PublicCatalogCurriculumStructureEntry>();

  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.code}:${entry.curriculumId}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourceCompare = left.sourceId.localeCompare(right.sourceId);
    return sourceCompare !== 0 ? sourceCompare : left.code.localeCompare(right.code);
  });
}

function dedupeCurriculumDetails(
  entries: PublicCatalogCurriculumDetailEntry[],
): PublicCatalogCurriculumDetailEntry[] {
  const byKey = new Map<string, PublicCatalogCurriculumDetailEntry>();

  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.curriculumId}:${entry.curriculumCode}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const sourceCompare = left.sourceId.localeCompare(right.sourceId);
    return sourceCompare !== 0
      ? sourceCompare
      : left.curriculumCode.localeCompare(right.curriculumCode);
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

function dedupeDiscoveryEntries(
  entries: PublicCatalogDiscoveryEntry[],
): PublicCatalogDiscoveryEntry[] {
  const byKey = new Map<string, PublicCatalogDiscoveryEntry>();

  for (const entry of entries) {
    const key = `${entry.kind}:${entry.url}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values()).sort((left, right) =>
    `${left.kind}:${left.url}`.localeCompare(`${right.kind}:${right.url}`),
  );
}

async function loadCurriculumDetails(input: {
  source: PublicCatalogSourceDefinition;
  fetchedAt: string;
  sourceResolution: {
    finalUrl: string;
    origin: "fixture" | "live";
    responseCookies: string[];
  };
  detailRequests: Array<{
    curriculumId: string;
    actionControlName: string;
    actionUrl: string;
    viewState: string;
  }>;
  fetchImpl: typeof fetch;
  builderVersion: string;
}): Promise<{
  details: PublicCatalogCurriculumDetailEntry[];
  components: PublicCatalogComponentCandidate[];
  notes: string[];
}> {
  const details: PublicCatalogCurriculumDetailEntry[] = [];
  const components: PublicCatalogComponentCandidate[] = [];
  const notes: string[] = [];
  const cookieHeader = buildCookieHeader(input.sourceResolution.responseCookies);

  for (const detailRequest of input.detailRequests) {
    try {
      const actionUrl = resolveDetailActionUrl(
        input.sourceResolution.finalUrl,
        detailRequest.actionUrl,
      );
      const payload = new URLSearchParams({
        formCurriculosCurso: "formCurriculosCurso",
        [detailRequest.actionControlName]: detailRequest.actionControlName,
        id: detailRequest.curriculumId,
        "javax.faces.ViewState": detailRequest.viewState,
      });
      const response = await fetchWithRetry(
        () =>
          input.fetchImpl(actionUrl, {
            method: "POST",
            headers: {
              "user-agent": `Formae public-catalog-builder/${input.builderVersion}`,
              accept: "text/html,application/xhtml+xml",
              "content-type": "application/x-www-form-urlencoded",
              ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            body: payload.toString(),
          }),
        `${input.source.id}:${detailRequest.curriculumId}`,
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const provenance = createContentProvenance(html, {
        contentType: response.headers.get("content-type"),
        httpStatus: response.status,
        responseEtag: response.headers.get("etag"),
        responseLastModified: response.headers.get("last-modified"),
      });
      const extracted = extractCurriculumDetailPage({
        source: input.source,
        html,
        fetchedAt: input.fetchedAt,
        finalUrl: response.url || actionUrl,
        origin: "live",
        detailRequest,
      });

      details.push({
        ...extracted.detail,
        detailPageContentDigest: provenance.contentDigest,
      });
      components.push(...extracted.components);
    } catch (error) {
      notes.push(
        `Curriculum detail ${detailRequest.curriculumId} from ${input.source.id} could not be fetched: ${formatError(error)}`,
      );
    }
  }

  return {
    details,
    components,
    notes,
  };
}

function extractResponseCookies(headers: Headers): string[] {
  const maybeNodeHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeNodeHeaders.getSetCookie === "function") {
    return maybeNodeHeaders.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function buildCookieHeader(cookies: string[]): string | null {
  const serialized = cookies
    .map((cookie) => cookie.split(";", 1)[0]?.trim() ?? "")
    .filter((cookie) => cookie.length > 0);

  return serialized.length > 0 ? serialized.join("; ") : null;
}

function resolveDetailActionUrl(baseUrl: string, actionUrl: string): string {
  return new URL(actionUrl, baseUrl).toString();
}
