import { readFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type { PublicCatalogSourceDefinition } from "./types.js";

interface RawSourceEntry {
  id?: string;
  name?: string;
  title?: string;
  kind?: string;
  url?: string;
  fixture?: string;
  notes?: string[] | string;
}

interface RawSourcesFile {
  sources?: RawSourceEntry[];
}

export async function loadSourcesFile(
  sourcesFilePath: string,
): Promise<PublicCatalogSourceDefinition[]> {
  const raw = await readFile(sourcesFilePath, "utf8");
  const parsed = YAML.parse(raw) as RawSourcesFile;
  const entries = parsed.sources ?? [];

  return entries.map((entry, index) => normalizeSourceEntry(entry, index));
}

export function resolveSourceFixturePath(
  source: PublicCatalogSourceDefinition,
  fixturesDir: string | null,
): string | null {
  if (!fixturesDir || !source.fixture) {
    return null;
  }

  return path.resolve(fixturesDir, source.fixture);
}

function normalizeSourceEntry(
  entry: RawSourceEntry,
  index: number,
): PublicCatalogSourceDefinition {
  const id = sanitizeIdentifier(entry.id ?? entry.name ?? `source-${index + 1}`);
  const title = (entry.title ?? entry.name ?? id).trim();
  const kind = entry.kind === "html" ? entry.kind : "html";
  const url = entry.url?.trim();

  if (!url) {
    throw new Error(`Source entry ${id} is missing url.`);
  }

  return {
    id,
    title,
    kind,
    url,
    fixture: entry.fixture?.trim() ?? null,
    notes: normalizeNotes(entry.notes),
  };
}

function normalizeNotes(notes: RawSourceEntry["notes"]): string[] {
  if (!notes) {
    return [];
  }

  if (Array.isArray(notes)) {
    return notes.map((note) => note.trim()).filter(Boolean);
  }

  return [notes.trim()].filter(Boolean);
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
