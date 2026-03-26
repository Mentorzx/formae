from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


SIZES = (16, 32, 48, 128)
ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "apps" / "extension" / "assets"


def main() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
      image = render_icon(size)
      image.save(ASSETS_DIR / f"icon-{size}.png")


def render_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    for y in range(size):
        blend = y / max(size - 1, 1)
        color = lerp((11, 79, 108), (223, 122, 59), blend)
        draw.line((0, y, size, y), fill=color + (255,))

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    inset = max(1, size // 16)
    shadow_draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=max(4, size // 4),
        fill=(255, 255, 255, 28),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(1, size // 32)))
    image.alpha_composite(shadow)

    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    plate_draw = ImageDraw.Draw(plate)
    plate_draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=max(4, size // 4),
        outline=(255, 255, 255, 78),
        width=max(1, size // 18),
        fill=(9, 17, 25, 26),
    )
    image.alpha_composite(plate)

    font = ImageFont.load_default(size=max(12, int(size * 0.42)))
    label = "F"
    bbox = draw.textbbox((0, 0), label, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = (size - width) / 2 - bbox[0]
    y = (size - height) / 2 - bbox[1] - size * 0.03

    outline_width = max(1, size // 32)
    for dx, dy in ((-outline_width, 0), (outline_width, 0), (0, -outline_width), (0, outline_width)):
        draw.text((x + dx, y + dy), label, font=font, fill=(7, 14, 19, 90))

    draw.text((x, y), label, font=font, fill=(244, 239, 231, 255))

    crest = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    crest_draw = ImageDraw.Draw(crest)
    crest_draw.arc(
        (
            size * 0.2,
            size * 0.18,
            size * 0.8,
            size * 0.78,
        ),
        start=205,
        end=340,
        fill=(143, 208, 226, 140),
        width=max(1, size // 20),
    )
    image.alpha_composite(crest)

    return image


def lerp(start: tuple[int, int, int], end: tuple[int, int, int], mix: float) -> tuple[int, int, int]:
    return tuple(int(a + (b - a) * mix) for a, b in zip(start, end))


if __name__ == "__main__":
    main()
