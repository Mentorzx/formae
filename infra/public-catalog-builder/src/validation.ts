import type { PublicCatalogSnapshot } from "./types.js";

const COMPONENT_CODE_PATTERN = /^[A-Z]{2,5}\d{2,3}$/;
const SCHEDULE_CODE_PATTERN =
  /^[2-7]{1,2}(?:[MTN]\d{1,2})(?:\s+[2-7]{1,2}(?:[MTN]\d{1,2}))*$/;
const TIME_SLOT_PATTERN = /^[MTN]\d$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const CURRICULUM_CODE_PATTERN = /^[A-Z0-9]+[A-Z]?$/;
const CURRICULUM_ID_PATTERN = /^\d+$/;

export function validateCatalogSnapshot(snapshot: PublicCatalogSnapshot): void {
  assert(snapshot.schemaVersion === 1, "Unexpected public catalog schema version.");
  assert(snapshot.institution === "UFBA", "Unexpected institution identifier.");
  assert(snapshot.timingProfileId === "Ufba2025", "Unexpected timing profile.");
  assert(snapshot.sources.length > 0, "Public catalog needs at least one source.");
  assert(snapshot.pages.length > 0, "Public catalog needs at least one page.");

  const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  assert(
    sourceIds.size === snapshot.sources.length,
    "Public catalog sources must have unique ids.",
  );

  for (const page of snapshot.pages) {
    assert(sourceIds.has(page.sourceId), `Unknown page source: ${page.sourceId}.`);
    assert(
      DIGEST_PATTERN.test(page.contentDigest),
      `Invalid content digest for source ${page.sourceId}.`,
    );
    assert(page.contentLength > 0, `Invalid content length for source ${page.sourceId}.`);
    assert(
      page.origin === "fixture" || page.origin === "live",
      `Invalid page origin for source ${page.sourceId}.`,
    );
    assert(page.title.length > 0, `Missing page title for source ${page.sourceId}.`);

    if (page.httpStatus !== null) {
      assert(
        page.httpStatus >= 200 && page.httpStatus < 400,
        `Unexpected HTTP status for source ${page.sourceId}.`,
      );
    }

    for (const code of page.componentCodes) {
      assert(
        COMPONENT_CODE_PATTERN.test(code),
        `Malformed component code on page ${page.sourceId}: ${code}.`,
      );
    }

    for (const code of page.scheduleCodes) {
      assert(
        SCHEDULE_CODE_PATTERN.test(code),
        `Malformed schedule code on page ${page.sourceId}: ${code}.`,
      );
    }

    for (const slot of page.timeSlotCodes) {
      assert(
        TIME_SLOT_PATTERN.test(slot),
        `Malformed time slot code on page ${page.sourceId}: ${slot}.`,
      );
    }
  }

  for (const entry of snapshot.curriculumStructures) {
    assert(
      sourceIds.has(entry.sourceId),
      `Unknown curriculum source: ${entry.sourceId}.`,
    );
    assert(
      CURRICULUM_CODE_PATTERN.test(entry.code),
      `Malformed curriculum code: ${entry.code}.`,
    );
    assert(
      CURRICULUM_ID_PATTERN.test(entry.curriculumId),
      `Malformed curriculum id: ${entry.curriculumId}.`,
    );
    assert(entry.label.length > 0, "Curriculum label cannot be empty.");
    assert(entry.groupLabel.length > 0, "Curriculum group label cannot be empty.");
    assert(
      entry.status === "active" ||
        entry.status === "inactive" ||
        entry.status === "unknown",
      `Invalid curriculum status: ${entry.status}.`,
    );
    if (entry.createdYear !== null) {
      assert(
        entry.createdYear >= 1900 && entry.createdYear <= 2100,
        `Invalid curriculum year: ${entry.createdYear}.`,
      );
    }
  }

  for (const component of snapshot.components) {
    assert(
      COMPONENT_CODE_PATTERN.test(component.code),
      `Malformed component candidate: ${component.code}.`,
    );
    if (component.scheduleCode) {
      assert(
        SCHEDULE_CODE_PATTERN.test(component.scheduleCode),
        `Malformed component schedule code: ${component.scheduleCode}.`,
      );
    }
    if (component.canonicalScheduleCode) {
      assert(
        SCHEDULE_CODE_PATTERN.test(component.canonicalScheduleCode),
        `Malformed canonical schedule code: ${component.canonicalScheduleCode}.`,
      );
    }
  }

  for (const entry of snapshot.scheduleGuide) {
    assert(entry.code.length > 0, "Schedule guide entry code cannot be empty.");
    assert(entry.description.length > 0, "Schedule guide entry description cannot be empty.");
  }

  for (const slot of snapshot.timeSlots) {
    assert(
      TIME_SLOT_PATTERN.test(slot.slot),
      `Malformed time slot entry: ${slot.slot}.`,
    );
    assert(slot.startTime.length > 0, `Missing start time for slot ${slot.slot}.`);
    assert(slot.endTime.length > 0, `Missing end time for slot ${slot.slot}.`);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
