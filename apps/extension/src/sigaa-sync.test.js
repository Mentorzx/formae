import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombinedCaptureText,
  buildStructuredSigaaCapture,
} from "./sigaa-sync.js";

test("buildCombinedCaptureText prefixes profile and captured sections", () => {
  const combined = buildCombinedCaptureText({
    portalProfile: {
      studentName: "Alex de Lira Neto",
      studentNumber: "219216387",
      courseName: "ENGENHARIA DA COMPUTACAO/EPOLI",
    },
    capturedViews: [
      {
        id: "classes",
        label: "Minhas Turmas",
        text: "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horario: 35N12",
      },
      {
        id: "grades",
        label: "Minhas Notas",
        text: "ENGC50 SISTEMAS MICROPROCESSADOS APROVADO",
      },
      {
        id: "history",
        label: "Consultar Histórico",
        text: "2026.1 ENGC50 SISTEMAS MICROPROCESSADOS 10,0 0 APROVADO",
      },
    ],
    warnings: ["Aviso: grades parciais."],
  });

  assert.match(combined, /Aluno\(a\): Alex de Lira Neto/);
  assert.match(combined, /\[Minhas Turmas\]/);
  assert.match(combined, /\[Minhas Notas\]/);
  assert.match(combined, /\[Consultar Histórico\]/);
  assert.match(combined, /Aviso: grades parciais\./);
});

test("buildStructuredSigaaCapture extracts turma, grade and history records", () => {
  const structuredCapture = buildStructuredSigaaCapture({
    portalProfile: {
      studentName: "Alex de Lira Neto",
      studentNumber: "219216387",
      courseName: "ENGENHARIA DA COMPUTACAO/EPOLI",
    },
    capturedViews: [
      {
        id: "classes",
        label: "Minhas Turmas",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/menu.jsf",
        text: [
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horario: 35N12",
          "ENGC41 - ALGORITMOS E ESTRUTURAS DE DADOS - Horario: 35N34",
        ].join("\n"),
      },
      {
        id: "grades",
        label: "Minhas Notas",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/menu.jsf",
        text: [
          "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO",
          "ENGC41 ALGORITMOS E ESTRUTURAS DE DADOS REPROVADO",
        ].join("\n"),
      },
      {
        id: "history",
        label: "Consultar Histórico",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.jsf",
        text: [
          "2026.1 ENGC63 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO",
          "2025.2 ENGC41 ALGORITMOS E ESTRUTURAS DE DADOS -- 4 REPROVADO",
        ].join("\n"),
      },
    ],
  });

  assert.equal(structuredCapture.schemaVersion, 1);
  assert.equal(structuredCapture.portalProfile?.studentName, "Alex de Lira Neto");
  assert.equal(structuredCapture.views[0].id, "classes");
  assert.equal(structuredCapture.views[0].extractedTurmas.length, 2);
  assert.equal(structuredCapture.views[0].extractedTurmas[0].componentCode, "ENGC63");
  assert.deepEqual(structuredCapture.views[0].extractedTurmas[0].scheduleCodes, [
    "35N12",
  ]);
  assert.equal(structuredCapture.views[1].id, "grades");
  assert.equal(structuredCapture.views[1].extractedGrades.length, 2);
  assert.equal(structuredCapture.views[1].extractedGrades[1].statusText, "REPROVADO");
  assert.equal(structuredCapture.views[2].id, "history");
  assert.equal(structuredCapture.views[2].extractedHistory.length, 2);
  assert.equal(structuredCapture.views[2].extractedHistory[0].academicPeriod, "2026.1");
  assert.equal(structuredCapture.views[2].extractedHistory[1].statusText, "REPROVADO");
});
