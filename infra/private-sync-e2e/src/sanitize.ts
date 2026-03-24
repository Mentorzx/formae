import type { Locator, Page } from "playwright";

export interface SanitizedNetworkEvent {
  kind: "request" | "response";
  url: string;
  method?: string;
  status?: number;
  resourceType?: string;
}

export interface SanitizedPageSnapshot {
  title: string;
  url: string;
  html: string;
  text: string;
  forms: Array<{
    action: string;
    method: string;
    fieldCount: number;
    fieldNames: string[];
  }>;
  links: Array<{
    text: string;
    href: string;
  }>;
}

export function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeText(value: string): string {
  return normalizeWhitespace(value);
}

export async function captureSanitizedPage(page: Page): Promise<SanitizedPageSnapshot> {
  return page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    const pending: Element[] = [clone];

    while (pending.length > 0) {
      const node = pending.pop();

      if (!node) {
        continue;
      }

      const tagName = node.tagName.toUpperCase();

      if (["SCRIPT", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED"].includes(tagName)) {
        node.remove();
        continue;
      }

      for (const attribute of Array.from(node.attributes)) {
        const attributeName = attribute.name.toLowerCase();

        if (
          attributeName.startsWith("on") ||
          attributeName === "srcdoc" ||
          attributeName === "value" ||
          /token|secret|password|csrf|auth|session|cookie/i.test(attributeName)
        ) {
          node.removeAttribute(attribute.name);
        }
      }

      if (node instanceof HTMLInputElement) {
        if (node.type === "password" || node.type === "hidden") {
          node.value = "";
        }
        node.removeAttribute("value");
      }

      if (node instanceof HTMLTextAreaElement) {
        node.value = "";
        node.textContent = "";
      }

      if (node instanceof HTMLSelectElement) {
        for (const option of Array.from(node.options)) {
          option.removeAttribute("selected");
        }
      }

      pending.push(...Array.from(node.children));
    }

    const forms = Array.from(document.forms).map((form) => ({
      action: form.getAttribute("action") ?? "",
      method: (form.getAttribute("method") ?? "get").toLowerCase(),
      fieldCount: form.querySelectorAll("input, select, textarea, button").length,
      fieldNames: Array.from(form.querySelectorAll("input, select, textarea"))
        .map((field) => field.getAttribute("name") ?? field.getAttribute("id") ?? "")
        .filter(Boolean),
    }));

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).map((anchor) => ({
      text: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
      href: anchor.href,
    }));

    return {
      title: document.title ?? "",
      url: document.location.href,
      html: `<!doctype html>\n${clone.outerHTML}`,
      text: (document.body?.innerText ?? document.documentElement.innerText ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      forms,
      links,
    } satisfies SanitizedPageSnapshot;
  });
}

export function sanitizeNetworkEvent(event: SanitizedNetworkEvent): SanitizedNetworkEvent {
  return {
    ...event,
    url: sanitizeUrl(event.url),
  };
}

export async function locatorText(locator: Locator): Promise<string> {
  const text = await locator.textContent().catch(() => null);
  return normalizeWhitespace(text ?? "");
}
