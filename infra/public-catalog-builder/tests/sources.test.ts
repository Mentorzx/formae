import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadSourcesFile, resolveSourceFixturePath } from "../src/sources.js";

test("loadSourcesFile normalizes ids, titles and fixtures", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "formae-pcb-"));
  const sourcesPath = path.join(tempDir, "sources.yaml");

  await writeFile(
    sourcesPath,
    [
      "sources:",
      "  - name: sigaa-root",
      "    kind: html",
      "    url: https://sigaa.ufba.br/",
      "    fixture: sigaa-root.html",
      "  - id: ufba-sim-horarios",
      "    title: UFBA SIM - Horarios",
      "    kind: html",
      "    url: https://example.test/",
      "",
    ].join("\n"),
    "utf8",
  );

  const sources = await loadSourcesFile(sourcesPath);
  const firstSource = sources[0];
  const secondSource = sources[1];

  assert.equal(sources.length, 2);
  assert.deepEqual(firstSource, {
    id: "sigaa-root",
    title: "sigaa-root",
    kind: "html",
    url: "https://sigaa.ufba.br/",
    fixture: "sigaa-root.html",
    notes: [],
  });
  assert.ok(secondSource);
  assert.equal(secondSource.id, "ufba-sim-horarios");
  assert.equal(secondSource.title, "UFBA SIM - Horarios");
  assert.equal(secondSource.fixture, null);
});

test("resolveSourceFixturePath respects explicit fixture names", async () => {
  const fixturePath = resolveSourceFixturePath(
    {
      id: "sigaa-root",
      title: "SIGAA UFBA",
      kind: "html",
      url: "https://sigaa.ufba.br/",
      fixture: "sigaa-root.html",
      notes: [],
    },
    "/tmp/fixtures",
  );

  assert.equal(fixturePath, path.resolve("/tmp/fixtures/sigaa-root.html"));
});
