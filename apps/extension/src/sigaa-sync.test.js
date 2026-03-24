import assert from "node:assert/strict";
import test from "node:test";

import { buildCombinedCaptureText } from "./sigaa-sync.js";

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
    ],
    warnings: ["Aviso: grades parciais."],
  });

  assert.match(combined, /Aluno\(a\): Alex de Lira Neto/);
  assert.match(combined, /\[Minhas Turmas\]/);
  assert.match(combined, /\[Minhas Notas\]/);
  assert.match(combined, /Aviso: grades parciais\./);
});
