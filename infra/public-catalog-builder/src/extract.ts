import * as cheerio from "cheerio";

import type {
  PublicCatalogComponentCandidate,
  PublicCatalogCurriculumStructureEntry,
  PublicCatalogPageCoreSnapshot,
  PublicCatalogPageSnapshot,
  PublicCatalogScheduleGuideEntry,
  PublicCatalogSourceDefinition,
  PublicCatalogTimeSlotEntry,
} from "./types.js";

const COMPONENT_CODE_PATTERN = /\b[A-Z]{2,5}\d{2,3}\b/g;
const SCHEDULE_CODE_PATTERN = /\b[2-7]{1,2}(?:[MTN]\d{1,2})(?:\s+[2-7]{1,2}(?:[MTN]\d{1,2}))*\b/g;
const SCHEDULE_SEGMENT_PATTERN = /[2-7]{1,2}[MTN]\d{1,2}/g;

export interface ExtractedPublicSourceData {
  page: PublicCatalogPageCoreSnapshot;
  curriculumStructures: PublicCatalogCurriculumStructureEntry[];
  components: PublicCatalogComponentCandidate[];
  scheduleGuide: PublicCatalogScheduleGuideEntry[];
  timeSlots: PublicCatalogTimeSlotEntry[];
}

export function extractPublicSourceData(
  source: PublicCatalogSourceDefinition,
  html: string,
  fetchedAt: string,
  finalUrl: string,
  origin: "fixture" | "live",
): ExtractedPublicSourceData {
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const curriculumStructures = extractCurriculumStructures($, source);
  const componentCandidates = extractComponentCandidates($, source);
  const scheduleGuide = extractScheduleGuide($, source, bodyText);
  const timeSlots = extractTimeSlots($, source);
  const title = normalizeWhitespace($("title").first().text()) || source.title;
  const headings = $("h1,h2,h3").length;
  const links = $("a").length;

  return {
    page: {
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      finalUrl,
      fetchedAt,
      origin,
      title,
      headingCount: headings,
      linkCount: links,
      textExcerpt: createExcerpt(bodyText),
      componentCodes: uniqueSorted([
        ...componentCandidates.map((candidate) => candidate.code),
      ]),
      scheduleCodes: uniqueSorted(extractScheduleCodes(bodyText)),
      timeSlotCodes: uniqueSorted(timeSlots.map((slot) => slot.slot)),
    },
    curriculumStructures,
    components: componentCandidates,
    scheduleGuide,
    timeSlots,
  };
}

function extractCurriculumStructures(
  $: cheerio.CheerioAPI,
  source: PublicCatalogSourceDefinition,
): PublicCatalogCurriculumStructureEntry[] {
  if (!source.url.includes("/curriculo.jsf")) {
    return [];
  }

  const entries: PublicCatalogCurriculumStructureEntry[] = [];
  let currentGroupLabel = "unknown";

  $("#table_lt tr").each((_index, row) => {
    const rowElement = $(row);
    const rowClass = normalizeWhitespace(rowElement.attr("class") ?? "");
    const cells = rowElement
      .find("td")
      .map((_cellIndex, cell) => normalizeWhitespace($(cell).text()))
      .get()
      .filter(Boolean);

    if (rowClass === "campos") {
      currentGroupLabel = cells[0] ?? currentGroupLabel;
      return;
    }

    if (cells.length < 2) {
      return;
    }

    const label = cells[0] ?? "";
    const statusLabel = cells[1] ?? "";
    const codeMatch = label.match(/Estrutura Curricular\s+(.+?),\s*Criado em\s+(\d{4})/i);
    const code = sanitizeToken(codeMatch?.[1] ?? "");
    const createdYear = codeMatch ? Number.parseInt(codeMatch[2] ?? "", 10) : null;
    const status = normalizeCurriculumStatus(statusLabel);
    const detailActionId = extractCurriculumActionId(
      rowElement.find('a[title="Visualizar Estrutura Curricular"]').first().attr("onclick") ?? "",
    );

    if (!code || !detailActionId) {
      return;
    }

    entries.push({
      curriculumId: detailActionId,
      code,
      label,
      groupLabel: currentGroupLabel,
      status,
      createdYear: Number.isFinite(createdYear) ? createdYear : null,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      evidence: compactEvidence([
        currentGroupLabel,
        label,
        statusLabel,
        detailActionId,
      ]),
    });
  });

  return dedupeCurriculumStructures(entries);
}

function extractComponentCandidates(
  $: cheerio.CheerioAPI,
  source: PublicCatalogSourceDefinition,
): PublicCatalogComponentCandidate[] {
  const candidates: PublicCatalogComponentCandidate[] = [];

  $("article[data-component-code]").each((_index, element) => {
    const article = $(element);
    const rawCode = article.attr("data-component-code");
    if (!rawCode) {
      return;
    }

    const code = sanitizeToken(rawCode);
    const title =
      normalizeWhitespace(article.find("h2").first().text()) ||
      normalizeWhitespace(article.text());
    const scheduleCode = normalizeScheduleCode(
      article.find(".schedule-code").first().text(),
    );

    if (!code) {
      return;
    }

    candidates.push({
      code,
      title: title || code,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      scheduleCode,
      canonicalScheduleCode: scheduleCode,
      evidence: compactEvidence([title, scheduleCode, normalizeWhitespace(article.text())]),
    });
  });

  return dedupeCandidates(candidates);
}

function extractScheduleGuide(
  $: cheerio.CheerioAPI,
  source: PublicCatalogSourceDefinition,
  bodyText: string,
): PublicCatalogScheduleGuideEntry[] {
  if (source.id !== "ufba-sim-horarios") {
    return [];
  }

  const guideEntries: PublicCatalogScheduleGuideEntry[] = [];

  $("table tr").each((_index, row) => {
    const cells = $(row)
      .find("td")
      .map((_cellIndex, cell) => normalizeWhitespace($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length < 2) {
      return;
    }

    const code = sanitizeToken(cells.at(-1) ?? "");
    const description = cells.slice(0, -1).join(" - ");

    if (!/^\d$/.test(code)) {
      return;
    }

    guideEntries.push({
      code,
      description,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      evidence: [description, code],
    });
  });

  for (const code of extractScheduleCodes(bodyText)) {
    guideEntries.push({
      code,
      description: "Exemplo de codigo de horario extraido do texto da pagina.",
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      evidence: [code],
    });
  }

  return dedupeScheduleGuide(guideEntries);
}

function extractTimeSlots(
  $: cheerio.CheerioAPI,
  source: PublicCatalogSourceDefinition,
): PublicCatalogTimeSlotEntry[] {
  if (source.id !== "ihac-faixas-de-horario") {
    return [];
  }

  const entries: PublicCatalogTimeSlotEntry[] = [];

  $("table tr").each((_index, row) => {
    const cells = $(row)
      .find("td")
      .map((_cellIndex, cell) => normalizeWhitespace($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length < 3) {
      return;
    }

    const slot = sanitizeToken(cells[1] ?? "");
    const timeRange = cells[2] ?? "";
    const [startTime, endTime] = timeRange.split("-").map((part) => part.trim());

    if (!/^[MTN]\d$/.test(slot) || !startTime || !endTime) {
      return;
    }

    entries.push({
      slot,
      turn: slot.startsWith("M")
        ? "morning"
        : slot.startsWith("T")
          ? "afternoon"
          : "night",
      label: cells[0] ?? slot,
      startTime,
      endTime,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
    });
  });

  return entries;
}

function extractScheduleCodes(text: string): string[] {
  return Array.from(text.matchAll(SCHEDULE_CODE_PATTERN), (match) =>
    normalizeScheduleCode(match[0]),
  ).filter((code): code is string => Boolean(code));
}

function createExcerpt(text: string, maxLength = 280): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeScheduleCode(value: string): string | null {
  const compact = value.replace(/\s+/g, "").trim().toUpperCase();
  const segments = compact.match(SCHEDULE_SEGMENT_PATTERN);

  if (!segments || segments.join("") !== compact) {
    return null;
  }

  return segments.join(" ");
}

function sanitizeToken(value: string): string {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeCurriculumStatus(value: string): "active" | "inactive" | "unknown" {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (normalized === "ativa" || normalized === "active") {
    return "active";
  }

  if (normalized === "inativa" || normalized === "inactive") {
    return "inactive";
  }

  return "unknown";
}

function extractCurriculumActionId(onclick: string): string | null {
  const match = onclick.match(/'id':'([^']+)'/);
  return match ? sanitizeToken(match[1] ?? "") || null : null;
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

  return Array.from(byKey.values()).sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function dedupeCandidates(
  candidates: PublicCatalogComponentCandidate[],
): PublicCatalogComponentCandidate[] {
  const byCode = new Map<string, PublicCatalogComponentCandidate>();

  for (const candidate of candidates) {
    if (!byCode.has(candidate.code)) {
      byCode.set(candidate.code, candidate);
    }
  }

  return Array.from(byCode.values()).sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function dedupeScheduleGuide(
  entries: PublicCatalogScheduleGuideEntry[],
): PublicCatalogScheduleGuideEntry[] {
  const seen = new Set<string>();
  const deduped: PublicCatalogScheduleGuideEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.code}:${entry.description}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped.sort((left, right) => left.code.localeCompare(right.code));
}

function compactEvidence(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => (value ? normalizeWhitespace(value) : ""))
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    .slice(0, 4);
}
