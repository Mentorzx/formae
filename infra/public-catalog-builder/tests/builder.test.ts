import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
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

test("buildCatalogSnapshot extracts public component and schedule fixtures", async () => {
  const result = await buildCatalogSnapshot({
    sources,
    fixturesDir,
    builderVersion: "test",
    now: new Date("2026-03-24T00:00:00.000Z"),
  });

  assert.equal(result.snapshot.schemaVersion, 1);
  assert.equal(result.snapshot.institution, "UFBA");
  assert.equal(result.snapshot.pages.length, 4);
  assert.ok(result.snapshot.components.some((item) => item.code === "MATA37"));
  assert.ok(result.snapshot.components.some((item) => item.code === "BIOD01"));
  assert.ok(result.snapshot.scheduleGuide.some((item) => item.code === "2"));
  assert.ok(result.snapshot.scheduleGuide.some((item) => item.code === "35N12"));
  assert.ok(result.snapshot.timeSlots.some((item) => item.slot === "N1"));
  assert.ok(
    result.snapshot.components.some(
      (item) => item.canonicalScheduleCode === "3M23 5T23",
    ),
  );
  assert.ok(
    result.snapshot.pages.find((page) => page.sourceId === "sigaa-public-turmas")
      ?.scheduleCodes.includes("3M23 5T23"),
  );
});

test("buildCatalogSnapshot records provenance for a live public source", async () => {
  const result = await buildCatalogSnapshot({
    sources: [
      {
        id: "eng-civil-portal",
        title: "CURSO DE ENGENHARIA CIVIL / EPOLI",
        kind: "html",
        url: "https://sigaa.ufba.br/sigaa/public/curso/portal.jsf?id=1876833&lc=pt_BR",
        fixture: null,
        notes: [],
      },
    ],
    fixturesDir: null,
    builderVersion: "test",
    now: new Date("2026-03-24T00:00:00.000Z"),
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://sigaa.ufba.br/sigaa/public/curso/portal.jsf?id=1876833&lc=pt_BR",
        headers: {
          get(name: string) {
            if (name === "content-type") {
              return "text/html; charset=utf-8";
            }

            if (name === "etag") {
              return '"abc123"';
            }

            if (name === "last-modified") {
              return "Tue, 24 Mar 2026 00:00:00 GMT";
            }

            return null;
          },
        },
        async text() {
          return [
            "<!doctype html>",
            "<html lang=\"pt-BR\">",
            "<head><meta charset=\"utf-8\"><title>CURSO DE ENGENHARIA CIVIL / EPOLI</title></head>",
            "<body><main><h1>CURSO DE ENGENHARIA CIVIL / EPOLI</h1><p>Apresentacao</p></main></body>",
            "</html>",
          ].join("");
        },
      }) as unknown as Response,
  });

  const page = result.snapshot.pages[0];
  if (!page) {
    throw new Error("Expected live page snapshot.");
  }

  assert.equal(page.origin, "live");
  assert.match(page.contentDigest, /^[a-f0-9]{64}$/);
  assert.equal(page.httpStatus, 200);
  const sourceStatus = result.sourceStatuses[0];
  if (!sourceStatus) {
    throw new Error("Expected live source status.");
  }

  assert.equal(sourceStatus.responseEtag, '"abc123"');
  const source = result.snapshot.sources[0];
  if (!source) {
    throw new Error("Expected live source definition.");
  }

  assert.equal(source.id, "eng-civil-portal");
});

test("buildCatalogSnapshot extracts curriculum structures from public course pages", async () => {
  const result = await buildCatalogSnapshot({
    sources: [
      {
        id: "eng-civil-curriculo",
        title: "CURSO DE ENGENHARIA CIVIL / EPOLI - Curriculos",
        kind: "html",
        url: "https://sigaa.ufba.br/sigaa/public/curso/curriculo.jsf?id=1876833&lc=pt_BR",
        fixture: null,
        notes: [],
      },
    ],
    fixturesDir: null,
    builderVersion: "test",
    now: new Date("2026-03-24T00:00:00.000Z"),
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://sigaa.ufba.br/sigaa/public/curso/curriculo.jsf?id=1876833&lc=pt_BR",
        headers: {
          get(name: string) {
            if (name === "content-type") {
              return "text/html; charset=utf-8";
            }

            return null;
          },
        },
        async text() {
          return [
            "<!doctype html>",
            '<html lang="pt-BR">',
            "<head><meta charset=\"utf-8\"><title>CURSO DE ENGENHARIA CIVIL / EPOLI - Curriculos</title></head>",
            "<body>",
            '<table id="table_lt"><tbody>',
            '<tr class="campos"><td colspan="3">Matutino e Vespertino</td></tr>',
            '<tr class="linha_par">',
            '<td width="50%">Detalhes da Estrutura Curricular G20251, Criado em 2025</td>',
            '<td width="45%">Ativa</td>',
            '<td width="55px"><a title="Visualizar Estrutura Curricular" onclick="jsfcljs(document.getElementById(\'formCurriculosCurso\'),{\'id\':\'2477782\'},\'\');"></a></td>',
            "</tr>",
            '<tr class="linha_impar">',
            '<td width="50%">Detalhes da Estrutura Curricular T20252, Criado em 2025</td>',
            '<td width="45%">Inativa</td>',
            '<td width="55px"><a title="Visualizar Estrutura Curricular" onclick="jsfcljs(document.getElementById(\'formCurriculosCurso\'),{\'id\':\'4718371\'},\'\');"></a></td>',
            "</tr>",
            "</tbody></table>",
            "</body></html>",
          ].join("");
        },
      }) as unknown as Response,
  });

  assert.equal(result.snapshot.curriculumStructures.length, 2);
  assert.deepEqual(result.snapshot.curriculumStructures.map((item) => item.code), [
    "G20251",
    "T20252",
  ]);
  assert.equal(result.snapshot.curriculumStructures[0]?.status, "active");
  assert.equal(result.snapshot.curriculumStructures[1]?.status, "inactive");
  assert.equal(result.snapshot.curriculumStructures[0]?.curriculumId, "2477782");
});
