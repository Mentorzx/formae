from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "apps" / "extension" / "store" / "screenshots"
PUBLISHED_BASE = "https://mentorzx.github.io/formae"
POPUP_FILE = ROOT / "apps" / "extension" / "src" / "popup.html"
SCREENSHOT_SIZE = (1280, 800)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()

        try:
            capture_pwa(browser, "#/", "chrome-store-overview.png")
            capture_pwa(browser, "#/planejador", "chrome-store-planner.png")
            capture_pwa(browser, "#/importacao", "chrome-store-importacao.png")
            capture_popup_card(browser, "chrome-store-popup.png")
        finally:
            browser.close()


def capture_pwa(browser, route: str, filename: str) -> None:
    page = browser.new_page(
        viewport={"width": SCREENSHOT_SIZE[0], "height": SCREENSHOT_SIZE[1]},
        device_scale_factor=1,
    )
    page.goto(f"{PUBLISHED_BASE}/{route}", wait_until="networkidle")
    page.screenshot(path=str(OUTPUT_DIR / filename))
    page.close()


def capture_popup_card(browser, filename: str) -> None:
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
    popup_path = OUTPUT_DIR / "_popup-temp.png"
    page.screenshot(path=str(popup_path))
    page.close()

    popup_image = Image.open(popup_path).convert("RGB")
    popup_path.unlink(missing_ok=True)

    canvas = Image.new("RGB", SCREENSHOT_SIZE, "#e8eff6")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (40, 40, SCREENSHOT_SIZE[0] - 40, SCREENSHOT_SIZE[1] - 40),
        radius=36,
        fill="#f7fafc",
        outline="#d8e1ea",
        width=2,
    )
    draw.text((80, 86), "Formaê SIGAA Sync", fill="#17324a")
    draw.text(
        (80, 124),
        "Popup da extensao com credenciais efemeras e sync local.",
        fill="#4f6576",
    )

    popup_x = 760
    popup_y = 90
    canvas.paste(popup_image, (popup_x, popup_y))

    card_top = 220
    card_height = 420
    column_left = 84
    column_width = 560
    draw.rounded_rectangle(
        (column_left, card_top, column_left + column_width, card_top + card_height),
        radius=28,
        fill="#ffffff",
        outline="#d8e1ea",
        width=2,
    )
    draw.text((column_left + 32, card_top + 36), "Por que essa tela importa", fill="#17324a")
    bullet_lines = [
        "Credenciais do SIGAA ficam apenas em memoria.",
        "A popup arma a aprovacao curta do sync local.",
        "A PWA nao precisa guardar senha nem backend proprio.",
        "O fluxo alimenta o vault local e o planner academico.",
    ]
    offset_y = card_top + 92
    for line in bullet_lines:
        draw.rounded_rectangle(
            (column_left + 32, offset_y + 8, column_left + 44, offset_y + 20),
            radius=6,
            fill="#5e8aa3",
        )
        draw.text((column_left + 60, offset_y), line, fill="#2b3a4a")
        offset_y += 70

    draw.text(
        (column_left + 32, card_top + card_height - 72),
        "Local-first, sem credenciais persistidas no servidor.",
        fill="#5e8aa3",
    )

    canvas.save(OUTPUT_DIR / filename, format="PNG")


if __name__ == "__main__":
    main()
