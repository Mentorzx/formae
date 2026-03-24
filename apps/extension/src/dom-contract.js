import { SIGAA_SELECTOR_VERSION, sigaaPageKinds } from "./constants.js";

export function identifySigaaPage(url) {
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();

  if (path.includes("login")) {
    return "login";
  }

  if (path.includes("historico")) {
    return "history";
  }

  if (path.includes("turma")) {
    return "turmas";
  }

  if (path.includes("document")) {
    return "document";
  }

  return "unknown";
}

export function createSigaaDomContract(pageKind) {
  if (!sigaaPageKinds.includes(pageKind)) {
    throw new Error(`Unsupported SIGAA page kind: ${pageKind}`);
  }

  switch (pageKind) {
    case "login":
      return {
        selectorVersion: SIGAA_SELECTOR_VERSION,
        pageKind,
        selectors: {
          usernameInput: 'input[name="user"]',
          passwordInput: 'input[type="password"]',
          submitButton: 'button[type="submit"]',
          errorBanner: ".alert-danger",
        },
      };
    case "history":
      return {
        selectorVersion: SIGAA_SELECTOR_VERSION,
        pageKind,
        selectors: {
          componentRows: "table tbody tr",
          componentCodeCells: "td:nth-child(1)",
          componentStatusCells: "td:nth-child(2)",
          scheduleCells: "td:nth-child(3)",
        },
      };
    case "turmas":
      return {
        selectorVersion: SIGAA_SELECTOR_VERSION,
        pageKind,
        selectors: {
          offeringCards: ".listagem tbody tr",
          offeringCodeCells: "td:nth-child(1)",
          offeringScheduleCells: "td:nth-child(5)",
        },
      };
    case "document":
      return {
        selectorVersion: SIGAA_SELECTOR_VERSION,
        pageKind,
        selectors: {
          authenticityCodeField: "[data-authenticity-code]",
          documentNameField: "[data-document-name]",
        },
      };
    default:
      return {
        selectorVersion: SIGAA_SELECTOR_VERSION,
        pageKind: "unknown",
        selectors: {},
      };
  }
}

export function normalizeSigaaText(value) {
  return value.trim().replace(/\s+/g, " ");
}
