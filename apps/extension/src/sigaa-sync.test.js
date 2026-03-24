import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombinedCaptureText,
  buildHistoryDocumentMetadata,
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
        text:
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horario: 35N12 ENGC41 - ALGORITMOS E ESTRUTURAS DE DADOS - Horario: 35N34",
      },
      {
        id: "grades",
        label: "Minhas Notas",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/menu.jsf",
        text:
          "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO ENGC41 ALGORITMOS E ESTRUTURAS DE DADOS REPROVADO",
      },
      {
        id: "history",
        label: "Consultar Histórico",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.jsf",
        text:
          "2026.1 ENGC63 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO 2025.2 ENGC41 ALGORITMOS E ESTRUTURAS DE DADOS -- 4 REPROVADO",
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
  assert.equal(structuredCapture.views[0].extractedTurmas[1].componentCode, "ENGC41");
  assert.equal(structuredCapture.views[1].id, "grades");
  assert.equal(structuredCapture.views[1].extractedGrades.length, 2);
  assert.equal(structuredCapture.views[1].extractedGrades[1].statusText, "REPROVADO");
  assert.equal(structuredCapture.views[1].extractedGrades[0].componentName, "PROCESSAMENTO DIGITAL DE SINAIS");
  assert.equal(structuredCapture.views[2].id, "history");
  assert.equal(structuredCapture.views[2].extractedHistory.length, 2);
  assert.equal(structuredCapture.views[2].extractedHistory[0].academicPeriod, "2026.1");
  assert.equal(structuredCapture.views[2].extractedHistory[1].statusText, "REPROVADO");
});

test("buildStructuredSigaaCapture keeps multiple component records from one long line", () => {
  const structuredCapture = buildStructuredSigaaCapture({
    portalProfile: null,
    capturedViews: [
      {
        id: "classes",
        label: "Minhas Turmas",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/menu.jsf",
        text:
          "ENGC63 - PROCESSAMENTO DIGITAL DE SINAIS - Horario: 35N12 ENGC41 - ALGORITMOS E ESTRUTURAS DE DADOS - Horario: 35N34 ENGC70 - REDES DE COMPUTADORES - Horario: 24M12",
      },
      {
        id: "grades",
        label: "Minhas Notas",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/menu.jsf",
        text:
          "ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO ENGC41 ALGORITMOS E ESTRUTURAS DE DADOS REPROVADO ENGC70 REDES DE COMPUTADORES CURSANDO",
      },
    ],
  });

  assert.equal(structuredCapture.views[0].extractedTurmas.length, 3);
  assert.deepEqual(structuredCapture.views[0].extractedTurmas.map((entry) => entry.componentCode), [
    "ENGC63",
    "ENGC41",
    "ENGC70",
  ]);
  assert.deepEqual(structuredCapture.views[0].extractedTurmas[2].scheduleCodes, [
    "24M12",
  ]);
  assert.equal(structuredCapture.views[1].extractedGrades.length, 3);
  assert.deepEqual(structuredCapture.views[1].extractedGrades.map((entry) => entry.componentCode), [
    "ENGC63",
    "ENGC41",
    "ENGC70",
  ]);
  assert.equal(structuredCapture.views[1].extractedGrades[2].statusText, "CURSANDO");
});

test("buildHistoryDocumentMetadata classifies pdf and attachment-style history responses", () => {
  const pdfMetadata = buildHistoryDocumentMetadata({
    currentUrl: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.jsf?download=true",
    title: "Relatório de Notas em PDF",
    text: "",
    sourceCandidates: [
      {
        kind: "pdf",
        url: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.pdf",
        text: "Abrir histórico",
        hasDownloadHint: false,
      },
    ],
    hasPdfLikeMarker: true,
    hasAttachmentLikeMarker: false,
  });

  assert.equal(pdfMetadata.transportKind, "pdf");
  assert.equal(pdfMetadata.hasPdfLikeMarker, true);
  assert.equal(pdfMetadata.pdfCandidates.length, 1);

  const attachmentMetadata = buildHistoryDocumentMetadata({
    currentUrl: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.jsf",
    title: "Consultar Histórico",
    text: "Baixar anexo do histórico",
    sourceCandidates: [
      {
        kind: "attachment",
        url: "https://sigaa.ufba.br/sigaa/mobile/touch/download?doc=historico",
        text: "Baixar histórico",
        hasDownloadHint: true,
      },
    ],
    hasPdfLikeMarker: false,
    hasAttachmentLikeMarker: true,
  });

  assert.equal(attachmentMetadata.transportKind, "attachment");
  assert.equal(attachmentMetadata.hasAttachmentLikeMarker, true);
  assert.equal(attachmentMetadata.attachmentCandidates.length, 1);
});

test("buildStructuredSigaaCapture preserves history document metadata", () => {
  const structuredCapture = buildStructuredSigaaCapture({
    portalProfile: null,
    capturedViews: [
      {
        id: "history",
        label: "Consultar Histórico",
        routeHint: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.jsf",
        text: "2026.1 ENGC63 PROCESSAMENTO DIGITAL DE SINAIS 10,0 0 APROVADO",
        historyDocument: {
          transportKind: "pdf",
          hasVisibleHistoryText: false,
          hasPdfLikeMarker: true,
          hasAttachmentLikeMarker: false,
          textLength: 0,
          sourceCandidates: [],
          pdfCandidates: [],
          attachmentCandidates: [],
          currentUrl: "https://sigaa.ufba.br/sigaa/mobile/touch/historico.pdf",
          title: "Relatório de Notas",
        },
      },
    ],
  });

  assert.equal(structuredCapture.views[0].historyDocument.transportKind, "pdf");
  assert.equal(structuredCapture.views[0].extractedHistory.length, 1);
  assert.equal(structuredCapture.views[0].extractedHistory[0].academicPeriod, "2026.1");
});
