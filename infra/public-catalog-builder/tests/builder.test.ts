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

  assert.equal(result.snapshot.schemaVersion, 2);
  assert.equal(result.snapshot.institution, "UFBA");
  assert.equal(result.snapshot.pages.length, 4);
  assert.equal(result.snapshot.curriculumDetails.length, 0);
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

test("buildCatalogSnapshot extracts curriculum structures and detail pages from public course pages", async () => {
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
    fetchImpl: async (requestInput, init) => {
      const requestUrl = String(requestInput);
      const method = init?.method ?? "GET";
      const requestBody = String(init?.body ?? "");

      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requestUrl,
          headers: {
            get(name: string) {
              if (name === "content-type") {
                return "text/html; charset=utf-8";
              }

              return null;
            },
            getSetCookie() {
              return ["JSESSIONID=test-session; Path=/; HttpOnly"];
            },
          },
          async text() {
            return [
              "<!doctype html>",
              '<html lang="pt-BR">',
              "<head><meta charset=\"utf-8\"><title>CURSO DE ENGENHARIA CIVIL / EPOLI - Curriculos</title></head>",
              "<body>",
              '<form id="formCurriculosCurso" action="/sigaa/public/curso/curriculo.jsf;jsessionid=test-session" method="post">',
              '<input type="hidden" name="formCurriculosCurso" value="formCurriculosCurso" />',
              '<input type="hidden" name="javax.faces.ViewState" value="j_id1" />',
              '<table id="table_lt"><tbody>',
              '<tr class="campos"><td colspan="3">Matutino e Vespertino</td></tr>',
              '<tr class="linha_par">',
              '<td width="50%">Detalhes da Estrutura Curricular G20251, Criado em 2025</td>',
              '<td width="45%">Ativa</td>',
              '<td width="55px"><a title="Visualizar Estrutura Curricular" onclick="var b=function(){if(typeof jsfcljs == \'function\'){jsfcljs(document.getElementById(\'formCurriculosCurso\'),{\'formCurriculosCurso:j_id_jsp_1561883746_32\':\'formCurriculosCurso:j_id_jsp_1561883746_32\',\'id\':\'2477782\'},\'\');}return false};return b();"></a></td>',
              "</tr>",
              '<tr class="linha_impar">',
              '<td width="50%">Detalhes da Estrutura Curricular T20252, Criado em 2025</td>',
              '<td width="45%">Inativa</td>',
              '<td width="55px"><a title="Visualizar Estrutura Curricular" onclick="var b=function(){if(typeof jsfcljs == \'function\'){jsfcljs(document.getElementById(\'formCurriculosCurso\'),{\'formCurriculosCurso:j_id_jsp_1561883746_33\':\'formCurriculosCurso:j_id_jsp_1561883746_33\',\'id\':\'4718371\'},\'\');}return false};return b();"></a></td>',
              "</tr>",
              "</tbody></table>",
              "</form>",
              "</body></html>",
            ].join("");
          },
        } as unknown as Response;
      }

      const isActiveCurriculum = requestBody.includes("id=2477782");

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://sigaa.ufba.br/sigaa/public/curso/resumo_curriculo.jsf",
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
            "<head><meta charset=\"utf-8\"><title>Detalhes da Estrutura Curricular</title></head>",
            "<body>",
            '<h2 class="title">Detalhes da Estrutura Curricular</h2>',
            '<form id="formulario" action="/sigaa/public/curso/resumo_curriculo.jsf" method="post">',
            '<table class="formulario">',
            `<tr><th>Código:</th><td>${isActiveCurriculum ? "G20251" : "T20252"}</td></tr>`,
            `<tr><th>Matriz Curricular:</th><td>${isActiveCurriculum ? "ENGENHARIA CIVIL - SALVADOR - BACHARELADO - Presencial - MT" : "ENGENHARIA CIVIL - SALVADOR - BACHARELADO - Presencial - NT"}</td></tr>`,
            `<tr><th>Período Letivo de Entrada em Vigor:</th><td>${isActiveCurriculum ? "2025.2" : "2025.1"}</td></tr>`,
            `<tr><th>Total Mínima:</th><td>${isActiveCurriculum ? "3691h" : "3600h"}</td></tr>`,
            `<tr><th>Carga Horária Optativa Mínima:</th><td>${isActiveCurriculum ? "240h" : "180h"}</td></tr>`,
            `<tr><th>Carga Horária Complementar Mínima:</th><td>${isActiveCurriculum ? "90h" : "60h"}</td></tr>`,
            `<tr><th>Carga Horária Máxima por Período Letivo:</th><td>${isActiveCurriculum ? "540h" : "510h"}</td></tr>`,
            "</table>",
            '<div id="tabs-semestres" class="yui-navset">',
            '<ul class="yui-nav">',
            '<li><a href="#semestre1"><em>1º Nível</em></a></li>',
            ...(isActiveCurriculum
              ? [
                  '<li><a href="#optativas"><em>Optativas</em></a></li>',
                  '<li><a href="#complementares"><em>Complementares</em></a></li>',
                ]
              : []),
            "</ul>",
            '<div class="yui-content">',
            '<div id="semestre1">',
            '<table class="subFormulario"><caption>1º Nível</caption>',
            ...(isActiveCurriculum
              ? [
                  '<tr class="linhaPar"><td>MATA01 - CÁLCULO I - 90h</td><td><i>Obrigatória</i></td><td><a title="Visualizar Detalhes do Componente" onclick="jsfcljs(document.getElementById(\'formulario\'),{\'formulario:j_id_46j_id_2\':\'formulario:j_id_46j_id_2\',\'id\':\'23562\',\'publico\':\'public\'},\'\');"></a></td></tr>',
                  '<tr class="linhaImpar"><td>FIS101 - FÍSICA I - 60h</td><td><i>Obrigatória</i></td><td><a title="Visualizar Detalhes do Componente" onclick="jsfcljs(document.getElementById(\'formulario\'),{\'formulario:j_id_46j_id_3\':\'formulario:j_id_46j_id_3\',\'id\':\'23563\',\'publico\':\'public\'},\'\');"></a></td></tr>',
                ]
              : [
                  '<tr class="linhaPar"><td>MATA02 - CÁLCULO II - 90h</td><td><i>Obrigatória</i></td><td><a title="Visualizar Detalhes do Componente" onclick="jsfcljs(document.getElementById(\'formulario\'),{\'formulario:j_id_46j_id_4\':\'formulario:j_id_46j_id_4\',\'id\':\'23564\',\'publico\':\'public\'},\'\');"></a></td></tr>',
                ]),
            "</table>",
            "</div>",
            ...(isActiveCurriculum
              ? [
                  '<div id="optativas">',
                  '<table class="subFormulario"><caption>Optativas</caption>',
                  '<tr class="linhaPar"><td>ENG006 - ENGENHARIA E SEGURANÇA DE TRÁFEGO - 60h</td><td><i>Optativa</i></td><td><a title="Visualizar Detalhes do Componente" onclick="jsfcljs(document.getElementById(\'formulario\'),{\'formulario:j_id_46\':\'formulario:j_id_46\',\'id\':\'29990\',\'publico\':\'public\'},\'\');"></a></td></tr>',
                  "</table>",
                  "</div>",
                  '<div id="complementares">',
                  '<table class="subFormulario"><caption>Complementares</caption>',
                  '<tr class="linhaPar"><td>ENGC90 - ATIVIDADES COMPLEMENTARES - 90h</td><td><i>Complementar</i></td><td><a title="Visualizar Detalhes do Componente" onclick="jsfcljs(document.getElementById(\'formulario\'),{\'formulario:j_id_46j_id_1\':\'formulario:j_id_46j_id_1\',\'id\':\'50123\',\'publico\':\'public\'},\'\');"></a></td></tr>',
                  "</table>",
                  "</div>",
                ]
              : []),
            "</div>",
            "</div>",
            "</form>",
            "</body></html>",
          ].join("");
        },
      } as unknown as Response;
    },
  });

  assert.equal(result.snapshot.curriculumStructures.length, 2);
  assert.deepEqual(result.snapshot.curriculumStructures.map((item) => item.code), [
    "G20251",
    "T20252",
  ]);
  assert.equal(result.snapshot.curriculumStructures[0]?.status, "active");
  assert.equal(result.snapshot.curriculumStructures[1]?.status, "inactive");
  assert.equal(result.snapshot.curriculumStructures[0]?.curriculumId, "2477782");
  assert.match(
    result.snapshot.curriculumStructures[0]?.sourcePageContentDigest ?? "",
    /^[a-f0-9]{64}$/,
  );
  assert.equal(
    result.snapshot.curriculumStructures[0]?.sourcePageOrigin,
    "live",
  );
  assert.equal(
    result.snapshot.curriculumStructures[0]?.sourcePageFinalUrl,
    "https://sigaa.ufba.br/sigaa/public/curso/curriculo.jsf?id=1876833&lc=pt_BR",
  );
  assert.equal(result.snapshot.curriculumDetails.length, 2);
  assert.equal(result.snapshot.curriculumDetails[0]?.curriculumId, "2477782");
  assert.equal(result.snapshot.curriculumDetails[0]?.curriculumCode, "G20251");
  assert.equal(
    result.snapshot.curriculumDetails[0]?.matrixName,
    "ENGENHARIA CIVIL - SALVADOR - BACHARELADO - Presencial - MT",
  );
  assert.equal(result.snapshot.curriculumDetails[0]?.sectionCount, 3);
  assert.equal(result.snapshot.curriculumDetails[0]?.componentCount, 4);
  assert.equal(
    result.snapshot.curriculumDetails[0]?.sections[0]?.label,
    "1º Nível",
  );
  assert.deepEqual(
    result.snapshot.curriculumDetails[0]?.sections[0]?.components.map(
      (component) => component.code,
    ),
    ["FIS101", "MATA01"],
  );
  assert.equal(result.snapshot.curriculumDetails[1]?.curriculumId, "4718371");
  assert.equal(result.snapshot.curriculumDetails[1]?.curriculumCode, "T20252");
  assert.ok(result.snapshot.components.some((item) => item.code === "ENG006"));
  assert.ok(result.snapshot.components.some((item) => item.code === "MATA01"));
  assert.ok(result.snapshot.components.some((item) => item.code === "MATA02"));
});
