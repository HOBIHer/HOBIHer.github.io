from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "assets" / "tarot"
CARD_DIR = OUTPUT_DIR / "cards"
DEFAULT_GENERATED_DIR = (
    Path.home()
    / ".codex"
    / "generated_images"
    / "01a05bf0-c1b9-7e91-bd5a-782991581bb6"
)

CARD_WIDTH = 360
CARD_HEIGHT = 600

SOURCE_FILES = {
    "table": "exec-bea971cd-8157-4f64-9cd0-614d3079016b.png",
    "card_back": "exec-2e2226b3-59e9-4d1b-8e4d-382f5d38f1db.png",
    "paw_grab": "exec-c687af92-54b0-4cc3-bfe6-a9eb86b6a693.png",
    "paw_open": "exec-e8a9cdcd-5b80-46b3-a6d7-1fd380dfd677.png",
    "paw_place": "paw-place-v1-rgba.png",
    "magic_ring": "exec-44154618-a653-4f26-81a9-7b120d1f786c.png",
    "magic_spark": "exec-fb5595fd-6277-4f7d-abf6-1bce31b875df.png",
    "slot_frame": "exec-24d7c993-9695-4fe2-8927-a097d7cfccca.png",
    "reveal_button": "exec-3188fa7a-331e-4d5a-b970-1c5881eba9c2.png",
    "collapse_fan_button": "exec-d7b74a71-ea6a-4f5f-92ac-cfacc8a4870e.png",
    "return_all_button": "exec-db680a96-55d8-4445-a868-0d36686dd0ed.png",
    "major_a": "exec-71835cbb-d80b-421d-a42a-b623e6587ef8.png",
    "major_b": "exec-666926f0-7670-4766-bc06-bb350049f165.png",
    "wands": "exec-5b56b456-1200-431f-a325-e94b9ac36bb8.png",
    "cups": "exec-6691deb2-4538-4013-99a3-24e045105e4a.png",
    "swords": "exec-58950a25-6f59-4ddd-8d26-e205dac844e1.png",
    "pentacles": "exec-596c1f1a-3318-4d9c-a3ad-c161d2a1528a.png",
}


def parse_catalog() -> list[dict[str, str | int]]:
    source = (ROOT / "src" / "tarot" / "catalog.ts").read_text(encoding="utf-8")
    pattern = re.compile(
        r"id:\s*'(?P<id>[^']+)'[\s\S]*?"
        r"deckIndex:\s*(?P<index>\d+)[\s\S]*?"
        r"nameZh:\s*'(?P<zh>[^']+)'[\s\S]*?"
        r"nameEn:\s*'(?P<en>[^']+)'",
    )
    cards = [
        {
            "id": match.group("id"),
            "deckIndex": int(match.group("index")),
            "nameZh": match.group("zh"),
            "nameEn": match.group("en"),
        }
        for match in pattern.finditer(source)
    ]
    if len(cards) != 78:
        raise RuntimeError(f"Expected 78 cards in catalog.ts, found {len(cards)}")
    if [card["deckIndex"] for card in cards] != list(range(78)):
        raise RuntimeError("Tarot deck indexes must be continuous from 0 through 77")
    return cards


def find_font(candidates: list[str]) -> str:
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return str(path)
    raise FileNotFoundError(f"None of the required fonts exist: {candidates}")


ZH_FONT = find_font(
    [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
)
EN_FONT = find_font(
    [
        r"C:\Windows\Fonts\georgiab.ttf",
        r"C:\Windows\Fonts\georgia.ttf",
        r"C:\Windows\Fonts\timesbd.ttf",
    ]
)


def fit_font(draw: ImageDraw.ImageDraw, text: str, font_path: str, max_size: int, max_width: int):
    for size in range(max_size, 9, -1):
        font = ImageFont.truetype(font_path, size=size)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
    return ImageFont.truetype(font_path, size=10)


def crop_atlas_cell(atlas: Image.Image, index: int) -> Image.Image:
    column = index % 5
    row = index // 5
    left = round(column * atlas.width / 5)
    right = round((column + 1) * atlas.width / 5)
    top = round(row * atlas.height / 3)
    bottom = round((row + 1) * atlas.height / 3)
    cell = atlas.crop((left, top, right, bottom)).convert("RGB")
    return ImageOps.fit(
        cell,
        (CARD_WIDTH, CARD_HEIGHT),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def add_baked_title(card_art: Image.Image, name_zh: str, name_en: str) -> Image.Image:
    image = card_art.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    label_top = 470
    for y in range(label_top, CARD_HEIGHT):
        progress = (y - label_top) / (CARD_HEIGHT - label_top)
        alpha = round(28 + progress * 214)
        draw.line((10, y, CARD_WIDTH - 10, y), fill=(4, 15, 30, alpha), width=1)

    draw.rounded_rectangle(
        (17, 504, CARD_WIDTH - 17, CARD_HEIGHT - 14),
        radius=14,
        fill=(5, 16, 31, 218),
        outline=(234, 190, 91, 214),
        width=2,
    )
    draw.line((36, 555, CARD_WIDTH - 36, 555), fill=(234, 190, 91, 126), width=1)

    zh_font = fit_font(draw, name_zh, ZH_FONT, 27, CARD_WIDTH - 62)
    en_font = fit_font(draw, name_en.upper(), EN_FONT, 16, CARD_WIDTH - 54)
    draw.text(
        (CARD_WIDTH / 2, 530),
        name_zh,
        font=zh_font,
        anchor="mm",
        fill=(255, 246, 218, 255),
        stroke_width=1,
        stroke_fill=(30, 18, 8, 210),
    )
    draw.text(
        (CARD_WIDTH / 2, 572),
        name_en.upper(),
        font=en_font,
        anchor="mm",
        fill=(235, 196, 106, 255),
    )
    return Image.alpha_composite(image, overlay).convert("RGB")


def save_webp(image: Image.Image, path: Path, *, quality: int = 84, lossless: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=quality, method=6, lossless=lossless, exact=True)


def build_card_faces(generated_dir: Path, cards: list[dict[str, str | int]]) -> None:
    groups = [
        ("major_a", cards[0:11]),
        ("major_b", cards[11:22]),
        ("wands", cards[22:36]),
        ("cups", cards[36:50]),
        ("swords", cards[50:64]),
        ("pentacles", cards[64:78]),
    ]

    for source_key, group in groups:
        atlas = Image.open(generated_dir / SOURCE_FILES[source_key])
        for cell_index, card in enumerate(group):
            art = crop_atlas_cell(atlas, cell_index)
            titled = add_baked_title(art, str(card["nameZh"]), str(card["nameEn"]))
            save_webp(titled, CARD_DIR / f"{card['id']}.webp", quality=86)


def resize_asset(source: Path, destination: Path, size: tuple[int, int], *, alpha: bool = False) -> None:
    image = Image.open(source)
    mode = "RGBA" if alpha else "RGB"
    image = ImageOps.fit(
        image.convert(mode),
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    save_webp(image, destination, quality=88, lossless=False)


def build_scene_assets(generated_dir: Path) -> None:
    resize_asset(generated_dir / SOURCE_FILES["table"], OUTPUT_DIR / "table.webp", (1920, 1080))
    resize_asset(generated_dir / SOURCE_FILES["card_back"], OUTPUT_DIR / "card-back.webp", (600, 900))
    resize_asset(
        generated_dir / SOURCE_FILES["paw_open"],
        OUTPUT_DIR / "paw-open-v2.webp",
        (512, 768),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["paw_grab"],
        OUTPUT_DIR / "paw-grab-v2.webp",
        (512, 768),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["paw_place"],
        OUTPUT_DIR / "paw-place-v1.webp",
        (512, 768),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["magic_ring"],
        OUTPUT_DIR / "magic-ring.webp",
        (1024, 1024),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["magic_spark"],
        OUTPUT_DIR / "magic-spark.webp",
        (1024, 1024),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["slot_frame"],
        OUTPUT_DIR / "slot-frame.webp",
        (512, 768),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["reveal_button"],
        OUTPUT_DIR / "reveal-button-v2.webp",
        (1536, 384),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["collapse_fan_button"],
        OUTPUT_DIR / "collapse-fan-button-v1.webp",
        (768, 512),
        alpha=True,
    )
    resize_asset(
        generated_dir / SOURCE_FILES["return_all_button"],
        OUTPUT_DIR / "return-all-button-v1.webp",
        (768, 512),
        alpha=True,
    )


def build_contact_sheet(cards: list[dict[str, str | int]]) -> None:
    thumb_width, thumb_height = 90, 150
    columns, rows = 13, 6
    sheet = Image.new("RGB", (columns * thumb_width, rows * thumb_height), (4, 12, 23))
    for index, card in enumerate(cards):
        card_image = Image.open(CARD_DIR / f"{card['id']}.webp").convert("RGB")
        card_image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        x = (index % columns) * thumb_width
        y = (index // columns) * thumb_height
        sheet.paste(card_image, (x, y))
    save_webp(sheet, OUTPUT_DIR / "tarot-78-contact-sheet.webp", quality=82)


def write_manifest(cards: list[dict[str, str | int]]) -> None:
    manifest = {
        "generator": "OpenAI built-in image generation + deterministic Pillow atlas slicing",
        "cardCount": len(cards),
        "cardSize": [CARD_WIDTH, CARD_HEIGHT],
        "cards": [f"cards/{card['id']}.webp" for card in cards],
        "sceneAssets": {
            "table": "table.webp",
            "cardBack": "card-back.webp",
            "pawOpen": "paw-open-v2.webp",
            "pawGrab": "paw-grab-v2.webp",
            "pawPlace": "paw-place-v1.webp",
            "magicRing": "magic-ring.webp",
            "magicSpark": "magic-spark.webp",
            "slotFrame": "slot-frame.webp",
            "revealButton": "reveal-button-v2.webp",
            "collapseFanButton": "collapse-fan-button-v1.webp",
            "returnAllButton": "return-all-button-v1.webp",
        },
        "sourceAtlasFiles": {key: value for key, value in SOURCE_FILES.items() if key not in {
            "table", "card_back", "paw_open", "paw_grab", "paw_place", "magic_ring", "magic_spark", "slot_frame", "reveal_button", "collapse_fan_button", "return_all_button"
        }},
    }
    (OUTPUT_DIR / "asset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build project-local Snoopy tarot textures")
    parser.add_argument("--generated-dir", type=Path, default=DEFAULT_GENERATED_DIR)
    args = parser.parse_args()

    missing = [name for name in SOURCE_FILES.values() if not (args.generated_dir / name).exists()]
    if missing:
        raise FileNotFoundError(f"Missing generated source files: {', '.join(missing)}")

    cards = parse_catalog()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CARD_DIR.mkdir(parents=True, exist_ok=True)
    build_scene_assets(args.generated_dir)
    build_card_faces(args.generated_dir, cards)
    build_contact_sheet(cards)
    write_manifest(cards)
    print(f"Built {len(cards)} card faces and scene textures under {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
