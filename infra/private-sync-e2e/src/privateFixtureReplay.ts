import { readFile } from "node:fs/promises";
import path from "node:path";

import { JSDOM } from "jsdom";

import {
  SIGAA_CLASSES_SELECTOR_CONTRACT,
  SIGAA_PORTAL_SELECTOR_CONTRACT,
} from "./sigaa.js";
import { normalizeWhitespace } from "./sanitize.js";

export interface PrivateFixtureManifest {
  version: number;
  redaction: {
    forbiddenText: string[];
    forbiddenPatterns: string[];
  };
  fixtures: PrivateFixtureSpec[];
}

export interface PrivateFixtureSpec {
  id: string;
  file: string;
  requiredSelectors: string[];
  requiredText: string[];
  forbiddenText: string[];
}

export interface PrivateFixtureReplayResult {
  fixtureCount: number;
  selectorCount: number;
  forbiddenPatternCount: number;
}

const DEFAULT_MANIFEST_FILE = "manifest.json";

export async function runPrivateFixtureReplay(
  fixtureRoot: string,
): Promise<PrivateFixtureReplayResult> {
  const manifest = await loadManifest(fixtureRoot);
  const forbiddenPatterns = manifest.redaction.forbiddenPatterns.map(
    (pattern) => new RegExp(pattern, "i"),
  );

  let selectorCount = 0;
  for (const fixture of manifest.fixtures) {
    const html = await readFile(path.join(fixtureRoot, fixture.file), "utf8");
    const document = new JSDOM(html).window.document;
    const text = normalizeWhitespace(document.body?.textContent ?? "");

    for (const selector of fixture.requiredSelectors) {
      selectorCount += 1;
      const count = document.querySelectorAll(selector).length;
      if (count === 0) {
        throw new Error(
          `Fixture ${fixture.id} is missing required selector ${selector}.`,
        );
      }
    }

    for (const requiredText of fixture.requiredText) {
      if (!text.includes(normalizeWhitespace(requiredText))) {
        throw new Error(
          `Fixture ${fixture.id} is missing required text ${requiredText}.`,
        );
      }
    }

    for (const forbidden of fixture.forbiddenText) {
      if (text.includes(normalizeWhitespace(forbidden))) {
        throw new Error(
          `Fixture ${fixture.id} still contains forbidden text ${forbidden}.`,
        );
      }
    }

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        throw new Error(
          `Fixture ${fixture.id} matched forbidden redaction pattern ${pattern}.`,
        );
      }
    }
  }

  return {
    fixtureCount: manifest.fixtures.length,
    selectorCount,
    forbiddenPatternCount: manifest.redaction.forbiddenPatterns.length,
  };
}

async function loadManifest(fixtureRoot: string): Promise<PrivateFixtureManifest> {
  const manifestPath = path.join(fixtureRoot, DEFAULT_MANIFEST_FILE);
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as PrivateFixtureManifest;

  if (manifest.version !== 1) {
    throw new Error(`Unsupported private fixture manifest version: ${manifest.version}`);
  }

  return manifest;
}

export const PRIVATE_SIGAA_FIXTURE_CONTRACT = {
  login: {
    id: "login",
    file: "login.html",
    requiredSelectors: [
      "form#form-login",
      "input[type=\"text\"]",
      "input[type=\"password\"]",
      "#form-login\\:entrar",
      "#form-acesso-publico\\:btnPortalPublico",
    ],
    requiredText: ["Usuário:", "Senha:", "Entrar", "Acessar Área Pública"],
    forbiddenText: ["219216387", "ALEX DE LIRA NETO"],
  },
  portal: {
    id: "portal-home",
    file: "portal-home.html",
    requiredSelectors: [
      "#form-portal-discente",
      SIGAA_PORTAL_SELECTOR_CONTRACT.classesLink,
      SIGAA_PORTAL_SELECTOR_CONTRACT.notesLink,
      SIGAA_PORTAL_SELECTOR_CONTRACT.historyLink,
      SIGAA_PORTAL_SELECTOR_CONTRACT.logoutLink,
    ],
    requiredText: [
      "Minhas Turmas",
      "Minhas Notas",
      "Atestado de Matrícula",
      "Consultar Histórico",
      "Sair",
    ],
    forbiddenText: ["219216387", "ALEX DE LIRA NETO", "ENGENHARIA DA COMPUTAÇÃO/EPOLI"],
  },
  classes: {
    id: "classes",
    file: "classes.html",
    requiredSelectors: [
      "#form-turmas-discente",
      SIGAA_CLASSES_SELECTOR_CONTRACT.homeLink,
      SIGAA_CLASSES_SELECTOR_CONTRACT.logoutLink,
      SIGAA_CLASSES_SELECTOR_CONTRACT.openAllLink,
      SIGAA_CLASSES_SELECTOR_CONTRACT.openClassLink,
    ],
    requiredText: ["Turmas do Discente", "Ver Todas", "Horário:"],
    forbiddenText: [
      "ENGC25",
      "ENGC41",
      "ECOB40",
      "ENGG62",
      "ENGC63",
      "ALEX DE LIRA NETO",
    ],
  },
  grades: {
    id: "grades",
    file: "grades.html",
    requiredSelectors: [
      "#form-relatorio-notas",
      "#identificacao",
      "#relatorio",
      "#relatorio\\:voltar",
      "#relatorio\\:imprimir",
    ],
    requiredText: [
      "Relatório de Notas do Aluno(a)",
      "Aluno(a):",
      "Curso:",
      "APROVADO",
      "REPROVADO",
    ],
    forbiddenText: [
      "219216387",
      "ALEX DE LIRA NETO",
      "ENGENHARIA DA COMPUTAÇÃO/EPOLI",
    ],
  },
} satisfies Record<string, PrivateFixtureSpec>;

export const PRIVATE_SIGAA_REDACTION_RULES = {
  forbiddenText: [
    "ALEX DE LIRA NETO",
    "219216387",
    "ENGENHARIA DA COMPUTAÇÃO/EPOLI",
    "ENGC25",
    "ENGC41",
    "ECOB40",
    "ENGG62",
    "ENGC63",
  ],
  forbiddenPatterns: [
    "\\b\\d{9}\\b",
    "jsessionid=",
  ],
};
