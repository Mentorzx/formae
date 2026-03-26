from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "apps" / "extension" / "store" / "screenshots"
PUBLISHED_BASE = "https://mentorzx.github.io/formae"
POPUP_FILE = ROOT / "apps" / "extension" / "src" / "popup.html"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()

        try:
            capture_pwa(browser, "#/", "chrome-store-overview.png")
            capture_pwa(browser, "#/planejador", "chrome-store-planner.png")
            capture_pwa(browser, "#/importacao", "chrome-store-importacao.png")
            capture_popup(browser, "chrome-store-popup.png")
        finally:
            browser.close()


def capture_pwa(browser, route: str, filename: str) -> None:
    page = browser.new_page(viewport={"width": 1440, "height": 1024}, device_scale_factor=1)
    page.goto(f"{PUBLISHED_BASE}/{route}", wait_until="networkidle")
    page.screenshot(path=str(OUTPUT_DIR / filename), full_page=True)
    page.close()


def capture_popup(browser, filename: str) -> None:
    page = browser.new_page(viewport={"width": 420, "height": 640}, device_scale_factor=1)
    page.add_init_script(
        """
        const response = {
          ok: true,
          credentialState: {
            hasSession: true,
            syncSessionId: "demo-session",
            usernameOrCpfMasked: "088***540",
            expiresAt: "2026-03-26T22:30:00Z",
            syncApprovalActive: false,
            syncApprovalExpiresAt: null
          }
        };

        const runtime = {
          sendMessage(message, callback) {
            if (typeof callback === "function") {
              callback(response);
              return;
            }
            return Promise.resolve(response);
          }
        };

        window.chrome = { runtime };
        window.browser = { runtime };
        """
    )
    page.goto(POPUP_FILE.resolve().as_uri(), wait_until="load")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUTPUT_DIR / filename))
    page.close()


if __name__ == "__main__":
    main()
