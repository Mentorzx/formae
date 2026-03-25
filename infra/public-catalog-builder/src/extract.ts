import * as cheerio from "cheerio";

import type {
  PublicCatalogComponentCandidate,
  PublicCatalogDiscoveryEntry,
  PublicCatalogCurriculumDetailComponentEntry,
  PublicCatalogCurriculumDetailEntry,
  PublicCatalogCurriculumDetailSectionEntry,
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

export interface PublicCatalogCurriculumDetailRequest {
  curriculumId: string;
  actionControlName: string;
  actionUrl: string;
  viewState: string;
}

export function extractPublicCatalogDiscovery(
  source: PublicCatalogSourceDefinition,
  html: string,
  fetchedAt: string,
  finalUrl: string,
  origin: "fixture" | "live",
): PublicCatalogDiscoveryEntry[] {
  const $ = cheerio.load(html);
  const discoveryEntries: PublicCatalogDiscoveryEntry[] = [];

  $("a[href]").each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");

    if (!href) {
      return;
    }

    const resolvedUrl = resolveDiscoveryUrl(source.url, finalUrl, href);

    if (!resolvedUrl) {
      return;
    }

    const kind = classifyDiscoveryUrl(resolvedUrl);

    if (!kind) {
      return;
    }

    const title =
      normalizeWhitespace(anchor.text()) ||
      normalizeWhitespace(anchor.attr("title") ?? "") ||
      resolvedUrl;

    discoveryEntries.push({
      kind,
      url: resolvedUrl,
      title,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceUrl: source.url,
      sourcePageOrigin: origin,
      sourcePageFinalUrl: finalUrl,
      sourcePageFetchedAt: fetchedAt,
      evidence: compactEvidence([title, href]),
    });
  });

  return dedupeDiscoveryEntries(discoveryEntries);
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

export function extractCurriculumDetailRequests(
  source: PublicCatalogSourceDefinition,
  html: string,
): PublicCatalogCurriculumDetailRequest[] {
  if (!source.url.includes("/curriculo.jsf")) {
    return [];
  }

  const $ = cheerio.load(html);
  const form = $("#formCurriculosCurso").first();
  const action = form.attr("action");
  const viewState =
    form.find('input[name="javax.faces.ViewState"]').first().attr("value") ??
    null;

  if (!action || !viewState) {
    return [];
  }

  const requests: PublicCatalogCurriculumDetailRequest[] = [];

  $("#table_lt tr").each((_index, row) => {
    const rowElement = $(row);
    const detailLink = rowElement
      .find('a[title="Visualizar Estrutura Curricular"]')
      .first();
    const onclick = detailLink.attr("onclick") ?? "";
    const curriculumId = extractCurriculumActionId(onclick);
    const actionControlName = extractCurriculumActionControlName(onclick);

    if (!curriculumId || !actionControlName) {
      return;
    }

    requests.push({
      curriculumId,
      actionControlName,
      actionUrl: action,
      viewState,
    });
  });

  return dedupeCurriculumDetailRequests(requests);
}

export function extractCurriculumDetailPage(input: {
  source: PublicCatalogSourceDefinition;
  html: string;
  fetchedAt: string;
  finalUrl: string;
  origin: "fixture" | "live";
  detailRequest: PublicCatalogCurriculumDetailRequest;
}): {
  detail: PublicCatalogCurriculumDetailEntry;
  components: PublicCatalogComponentCandidate[];
} {
  const $ = cheerio.load(input.html);
  const curriculumCode =
    sanitizeToken(readDefinitionValue($, /^C[óo]digo:/i) ?? "") ||
    sanitizeToken(readDefinitionValue($, /^C[óo]digo/i) ?? "") ||
    input.detailRequest.curriculumId;
  const matrixName =
    readDefinitionValue($, /^Matriz Curricular:/i) ??
    readDefinitionValue($, /^Matriz Curricular/i);
  const entryPeriodLabel =
    readDefinitionValue($, /^Per[ií]odo Letivo de Entrada em Vigor:/i) ??
    null;
  const totalMinimumHours = parseHourQuantity(
    readDefinitionValue($, /^Total M[ií]nima:/i),
  );
  const minimumOptionalHours = parseHourQuantity(
    readDefinitionValue($, /^Carga Hor[aá]ria Optativa M[ií]nima:/i),
  );
  const minimumComplementaryHours = parseHourQuantity(
    readDefinitionValue($, /^Carga Hor[aá]ria Complementar M[ií]nima:/i),
  );
  const maximumTermHours = parseHourQuantity(
    readDefinitionValue($, /^Carga Hor[aá]ria M[aá]xima por Per[ií]odo Letivo:/i),
  );
  const sectionLabels = new Map<string, string>();

  $("#tabs-semestres .yui-nav a[href^='#']").each((_index, element) => {
    const anchor = $(element);
    const sectionId = (anchor.attr("href") ?? "").replace(/^#/u, "");
    const label = normalizeWhitespace(anchor.text());

    if (sectionId && label) {
      sectionLabels.set(sectionId, label);
    }
  });

  const sections: PublicCatalogCurriculumDetailSectionEntry[] = [];
  const componentCandidates: PublicCatalogComponentCandidate[] = [];

  $("#tabs-semestres .yui-content > div[id]").each((_index, element) => {
    const sectionElement = $(element);
    const sectionId = normalizeWhitespace(sectionElement.attr("id") ?? "");

    if (!sectionId) {
      return;
    }

    const label =
      normalizeWhitespace(sectionElement.find("caption").first().text()) ||
      sectionLabels.get(sectionId) ||
      sectionId;
    const components: PublicCatalogCurriculumDetailComponentEntry[] = [];

    sectionElement
      .find("tr.linhaPar, tr.linhaImpar")
      .each((_rowIndex, row) => {
        const rowElement = $(row);
        const cells = rowElement.find("td");
        const summaryText = normalizeWhitespace(cells.eq(0).text());
        const categoryLabel = normalizeWhitespace(cells.eq(1).text()) || null;
        const componentId = extractComponentActionId(
          rowElement
            .find('a[title="Visualizar Detalhes do Componente"]')
            .first()
            .attr("onclick") ?? "",
        );
        const parsedComponent = parseCurriculumComponentText(summaryText);

        if (!parsedComponent) {
          return;
        }

        const evidence = compactEvidence([label, summaryText, categoryLabel]);
        const componentEntry: PublicCatalogCurriculumDetailComponentEntry = {
          code: parsedComponent.code,
          title: parsedComponent.title,
          workloadHours: parsedComponent.workloadHours,
          categoryLabel,
          componentId,
          evidence,
        };

        components.push(componentEntry);
        componentCandidates.push({
          code: componentEntry.code,
          title: componentEntry.title,
          sourceId: input.source.id,
          sourceTitle: input.source.title,
          sourceUrl: input.source.url,
          scheduleCode: null,
          canonicalScheduleCode: null,
          evidence,
        });
      });

    if (components.length === 0) {
      return;
    }

    sections.push({
      sectionId,
      label,
      kind: resolveCurriculumSectionKind(sectionId, label),
      periodOrdinal: resolveCurriculumSectionOrdinal(sectionId, label),
      components: dedupeCurriculumDetailComponents(components),
    });
  });

  const dedupedSections = dedupeCurriculumDetailSections(sections);
  const componentCount = dedupedSections.reduce(
    (total, section) => total + section.components.length,
    0,
  );
  const title =
    normalizeWhitespace($("h2.title").first().text()) ||
    normalizeWhitespace($("title").first().text()) ||
    "Detalhes da Estrutura Curricular";

  return {
    detail: {
      curriculumId: input.detailRequest.curriculumId,
      curriculumCode,
      curriculumLabel: title,
      matrixName,
      entryPeriodLabel,
      totalMinimumHours,
      minimumOptionalHours,
      minimumComplementaryHours,
      maximumTermHours,
      sourceId: input.source.id,
      sourceTitle: input.source.title,
      sourceUrl: input.source.url,
      detailPageOrigin: input.origin,
      detailPageFinalUrl: input.finalUrl,
      detailPageFetchedAt: input.fetchedAt,
      detailPageContentDigest: "",
      sectionCount: dedupedSections.length,
      componentCount,
      sections: dedupedSections,
      evidence: compactEvidence([
        title,
        curriculumCode,
        matrixName,
        entryPeriodLabel,
      ]),
    },
    components: dedupeCandidates(componentCandidates),
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

function classifyDiscoveryUrl(
  value: string,
): PublicCatalogDiscoveryEntry["kind"] | null {
  if (value.includes("/sigaa/public/curso/portal.jsf")) {
    return "course-portal";
  }

  if (value.includes("/sigaa/public/curso/curriculo.jsf")) {
    return "course-curriculum";
  }

  return null;
}

function resolveDiscoveryUrl(
  sourceUrl: string,
  finalUrl: string,
  href: string,
): string | null {
  try {
    const baseUrl = finalUrl || sourceUrl;
    const resolved = new URL(href, baseUrl);

    if (!/^https?:$/u.test(resolved.protocol)) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
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

function extractCurriculumActionControlName(onclick: string): string | null {
  const match = onclick.match(/\{'([^']+)':'[^']+'/);
  return match ? normalizeWhitespace(match[1] ?? "") || null : null;
}

function extractComponentActionId(onclick: string): string | null {
  const match = onclick.match(/'id':'([^']+)'/);
  return match ? normalizeWhitespace(match[1] ?? "") || null : null;
}

function readDefinitionValue(
  $: cheerio.CheerioAPI,
  labelPattern: RegExp,
): string | null {
  let value: string | null = null;

  $("table.formulario tr").each((_index, row) => {
    if (value) {
      return;
    }

    const rowElement = $(row);
    const label = normalizeWhitespace(rowElement.find("th").first().text());

    if (!labelPattern.test(label)) {
      return;
    }

    const cellValue = normalizeWhitespace(rowElement.find("td").first().text());
    value = cellValue || null;
  });

  return value;
}

function parseHourQuantity(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)\s*h/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCurriculumComponentText(
  value: string,
): { code: string; title: string; workloadHours: number | null } | null {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/^([A-Z]{2,5}\d{2,3})\s*-\s*(.+?)(?:\s*-\s*(\d+)\s*h)?$/u);

  if (!match) {
    return null;
  }

  const code = sanitizeToken(match[1] ?? "");
  const title = normalizeWhitespace(match[2] ?? "");
  const workloadHours = match[3]
    ? Number.parseInt(match[3], 10)
    : null;

  if (!code || !title) {
    return null;
  }

  return {
    code,
    title,
    workloadHours: Number.isFinite(workloadHours) ? workloadHours : null,
  };
}

function resolveCurriculumSectionKind(
  sectionId: string,
  label: string,
): "term" | "elective" | "complementary" | "unknown" {
  const normalizedLabel = normalizeWhitespace(label).toLowerCase();
  const normalizedId = normalizeWhitespace(sectionId).toLowerCase();

  if (normalizedId.startsWith("semestre")) {
    return "term";
  }

  if (
    normalizedId.includes("optativa") ||
    normalizedLabel.includes("optativa")
  ) {
    return "elective";
  }

  if (
    normalizedId.includes("complement") ||
    normalizedLabel.includes("complement")
  ) {
    return "complementary";
  }

  return "unknown";
}

function resolveCurriculumSectionOrdinal(
  sectionId: string,
  label: string,
): number | null {
  const identifierMatch = sectionId.match(/semestre(\d+)/i);

  if (identifierMatch) {
    const parsed = Number.parseInt(identifierMatch[1] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const labelMatch = label.match(/(\d+)\s*(?:º|o)?\s*(?:n[ií]vel|semestre)/i);

  if (!labelMatch) {
    return null;
  }

  const parsed = Number.parseInt(labelMatch[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function dedupeCurriculumDetailRequests(
  requests: PublicCatalogCurriculumDetailRequest[],
): PublicCatalogCurriculumDetailRequest[] {
  const byCurriculumId = new Map<string, PublicCatalogCurriculumDetailRequest>();

  for (const request of requests) {
    if (!byCurriculumId.has(request.curriculumId)) {
      byCurriculumId.set(request.curriculumId, request);
    }
  }

  return Array.from(byCurriculumId.values()).sort((left, right) =>
    left.curriculumId.localeCompare(right.curriculumId),
  );
}

function dedupeCurriculumDetailSections(
  sections: PublicCatalogCurriculumDetailSectionEntry[],
): PublicCatalogCurriculumDetailSectionEntry[] {
  const bySectionId = new Map<string, PublicCatalogCurriculumDetailSectionEntry>();

  for (const section of sections) {
    if (!bySectionId.has(section.sectionId)) {
      bySectionId.set(section.sectionId, section);
    }
  }

  return Array.from(bySectionId.values()).sort((left, right) => {
    const leftOrdinal = left.periodOrdinal ?? Number.MAX_SAFE_INTEGER;
    const rightOrdinal = right.periodOrdinal ?? Number.MAX_SAFE_INTEGER;

    return leftOrdinal !== rightOrdinal
      ? leftOrdinal - rightOrdinal
      : left.label.localeCompare(right.label);
  });
}

function dedupeCurriculumDetailComponents(
  components: PublicCatalogCurriculumDetailComponentEntry[],
): PublicCatalogCurriculumDetailComponentEntry[] {
  const byCode = new Map<string, PublicCatalogCurriculumDetailComponentEntry>();

  for (const component of components) {
    if (!byCode.has(component.code)) {
      byCode.set(component.code, component);
    }
  }

  return Array.from(byCode.values()).sort((left, right) =>
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
