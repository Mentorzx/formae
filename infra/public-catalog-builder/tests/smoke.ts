import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalogSnapshot } from "../src/builder.js";
import type { PublicCatalogSourceDefinition } from "../src/types.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "..");
const fixturesDir = path.resolve(packageRoot, "../../fixtures/public");

const sources: PublicCatalogSourceDefinition[] = [
  {
    id: "sigaa-root",
    title: "SIGAA UFBA",
    kind: "html",
    url: "https://sigaa.ufba.br/",
    fixture: "sigaa-root.html",
    notes: [],
  },
  {
    id: "sigaa-public-turmas",
    title: "SIGAA Publico - Turmas",
    kind: "html",
    url: "https://sigaa.ufba.br/sigaa/public/turmas/listar.jsf",
    fixture: "sigaa-public-turmas.html",
    notes: [],
  },
  {
    id: "ufba-sim-horarios",
    title: "UFBA SIM - Codigos de horario",
    kind: "html",
    url: "https://ufbasim.ufba.br/hor%C3%A1rios-de-aula-c%C3%B3digos-na-tabela-de-hor%C3%A1rios-do-sigaa",
    fixture: "ufba-sim-schedule-codes.html",
    notes: [],
  },
  {
    id: "ihac-faixas-de-horario",
    title: "IHAC UFBA - Faixas de horario",
    kind: "html",
    url: "https://ihac.ufba.br/pt/10212/",
    fixture: "ihac-ufba-timetable.html",
    notes: [],
  },
];

async function main() {
  const result = await buildCatalogSnapshot({
    sources,
    fixturesDir,
    builderVersion: "test-smoke",
    now: new Date("2026-03-25T00:00:00.000Z"),
  });

  assert.equal(result.snapshot.schemaVersion, 2);
  assert.equal(result.discoverySnapshot.schemaVersion, 1);
  assert.equal(result.snapshot.pages.length, 4);
  assert.equal(result.snapshot.institution, "UFBA");
  assert.ok(result.snapshot.components.some((item) => item.code === "MATA37"));
  assert.ok(result.snapshot.scheduleGuide.some((item) => item.code === "35N12"));
  assert.ok(result.snapshot.timeSlots.some((item) => item.slot === "N1"));
  assert.equal(Array.isArray(result.discoverySnapshot.entries), true);

  process.stdout.write(
    [
      `snapshot pages: ${result.snapshot.pages.length}`,
      `snapshot components: ${result.snapshot.components.length}`,
      `discovery entries: ${result.discoverySnapshot.entries.length}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
