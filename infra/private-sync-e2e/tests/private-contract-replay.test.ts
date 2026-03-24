import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

import {
  navigateToCaptureTarget,
  signInToSigaa,
  type SigaaCaptureTarget,
} from "../src/sigaa.js";

const LOGIN_URL = "https://sigaa.ufba.br/sigaa/mobile/touch/login.jsf";

test("selector drift alarm: offline login contract still authenticates against the SIGAA fixture", async () => {
  await withOfflineLoginFixture(async (page) => {
    const loginResult = await signInToSigaa(
      page,
      LOGIN_URL,
      "00011122233",
      "not-a-real-password",
      5_000,
    );

    assert.equal(loginResult.authenticated, true);
    assert.equal(loginResult.usedSelectors.username, "label:Usuario");
    assert.equal(loginResult.usedSelectors.password, "label:Senha");
    assert.equal(loginResult.usedSelectors.submit, "role:button/entrar");
    assert.equal(loginResult.statusText, "authenticated");
  });
});

for (const captureTarget of ["classes", "grades", "history"] as const) {
  test(`selector drift alarm: offline portal contract still opens ${captureTarget}`, async () => {
    await withOfflinePortalFixture(async (page) => {
      const captureResult = await navigateToCaptureTarget(
        page,
        captureTarget,
        5_000,
      );

      assert.equal(
        captureResult.matchedSelector,
        expectedPortalActionId(captureTarget),
      );
      assert.match(
        captureResult.pageText,
        expectedContentPattern(captureTarget),
        `offline replay for ${captureTarget} no longer exposes the expected SIGAA content; inspect selector drift or portal contract breakage`,
      );
    });
  });
}

async function withOfflineLoginFixture(
  callback: (page: import("playwright").Page) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.route("**/*", async (route) => {
    if (route.request().url() === LOGIN_URL) {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: createLoginFixtureHtml(),
      });
      return;
    }

    await route.abort();
  });

  const page = await context.newPage();

  try {
    await callback(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function withOfflinePortalFixture(
  callback: (page: import("playwright").Page) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent(createPortalFixtureHtml(), {
      waitUntil: "domcontentloaded",
    });
    await callback(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

function expectedPortalActionId(captureTarget: SigaaCaptureTarget): string {
  switch (captureTarget) {
    case "history":
      return "form-portal-discente:lnkConsultarHistorico";
    case "classes":
      return "form-portal-discente:lnkMinhasTurmas";
    case "grades":
      return "form-portal-discente:lnkMinhasNotas";
    case "portal-home":
      return "";
  }
}

function expectedContentPattern(captureTarget: SigaaCaptureTarget): RegExp {
  switch (captureTarget) {
    case "history":
      return /Hist[oó]rico Escolar|ENGC63/;
    case "classes":
      return /Turmas do Discente|ENGC41|35N34/;
    case "grades":
      return /Relat[oó]rio de Notas|ENGC50|APROVADO/;
    case "portal-home":
      return /Portal do Discente/;
  }
}

function createLoginFixtureHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>SIGAA Login Fixture</title>
  </head>
  <body>
    <main>
      <h1>SIGAA</h1>
      <form id="login-form">
        <label for="username">Usuário</label>
        <input id="username" name="user" type="text" />
        <label for="password">Senha</label>
        <input id="password" name="password" type="password" />
        <button type="submit">Entrar</button>
      </form>
    </main>
    <script>
      const portalHtml = ${JSON.stringify(createPortalFixtureHtml())};
      document
        .getElementById("login-form")
        .addEventListener("submit", (event) => {
          event.preventDefault();
          document.open();
          document.write(portalHtml);
          document.close();
        });
    </script>
  </body>
</html>`;
}

function createPortalFixtureHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Portal do Discente Fixture</title>
  </head>
  <body>
    <main>
      <h1>Portal do Discente</h1>
      <form id="form-portal-discente">
        <button id="form-portal-discente:lnkConsultarHistorico" type="button">
          Consultar Histórico
        </button>
        <button id="form-portal-discente:lnkMinhasTurmas" type="button">
          Minhas Turmas
        </button>
        <button id="form-portal-discente:lnkMinhasNotas" type="button">
          Minhas Notas
        </button>
      </form>
      <p>Consultar Histórico</p>
      <p>Minhas Turmas</p>
      <p>Minhas Notas</p>
    </main>
    <script>
      window.jsfcljs = function (_form, payload) {
        const controlId = Object.keys(payload)[0] ?? "";

        if (controlId.endsWith("lnkConsultarHistorico")) {
          document.body.innerHTML = [
            "<main>",
            "  <h1>Histórico Escolar</h1>",
            "  <p>ENGC63 PROCESSAMENTO DIGITAL DE SINAIS APROVADO</p>",
            "</main>",
          ].join("\\n");
          return;
        }

        if (controlId.endsWith("lnkMinhasTurmas")) {
          document.body.innerHTML = [
            "<main>",
            "  <h1>Turmas do Discente</h1>",
            "  <p>ENGC41 - ALGORITMOS E ESTRUTURAS DE DADOS - Horário: 35N34</p>",
            "</main>",
          ].join("\\n");
          return;
        }

        if (controlId.endsWith("lnkMinhasNotas")) {
          document.body.innerHTML = [
            "<main>",
            "  <h1>Relatório de Notas</h1>",
            "  <p>ENGC50 SISTEMAS MICROPROCESSADOS APROVADO</p>",
            "</main>",
          ].join("\\n");
        }
      };
    </script>
  </body>
</html>`;
}
