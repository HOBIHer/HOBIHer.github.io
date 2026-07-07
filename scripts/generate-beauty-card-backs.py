from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "beauty-hall" / "card-backs"
WIDTH = 768
HEIGHT = 1072

PALETTES = [
    ((52, 21, 55), (196, 145, 63), (232, 204, 137), (18, 9, 22)),
    ((21, 56, 70), (123, 179, 154), (231, 218, 176), (7, 18, 24)),
    ((48, 38, 83), (154, 110, 190), (235, 213, 181), (13, 10, 25)),
    ((86, 32, 39), (204, 118, 67), (242, 211, 164), (22, 7, 10)),
    ((26, 52, 91), (137, 156, 208), (234, 222, 190), (6, 15, 31)),
    ((62, 45, 22), (214, 178, 85), (247, 226, 160), (16, 11, 5)),
    ((25, 70, 50), (179, 196, 105), (232, 221, 164), (6, 18, 11)),
    ((79, 25, 54), (222, 121, 153), (245, 218, 188), (21, 8, 16)),
    ((48, 50, 80), (178, 181, 211), (238, 226, 197), (13, 14, 28)),
    ((81, 44, 23), (221, 147, 90), (246, 218, 186), (20, 10, 5)),
]


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(lerp(a[i], b[i], t) for i in range(3))


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color[0], color[1], color[2], alpha


def add_layer(base: Image.Image, draw_fn) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    draw_fn(draw)
    base.alpha_composite(layer)


def draw_gradient(base: Image.Image, seed: int, palette: tuple[tuple[int, int, int], ...]) -> None:
    primary, accent, light, dark = palette
    pixels = base.load()
    cx = 0.42 + (seed % 7) * 0.028
    cy = 0.29 + (seed % 9) * 0.018
    for y in range(HEIGHT):
        y_t = y / (HEIGHT - 1)
        for x in range(WIDTH):
            x_t = x / (WIDTH - 1)
            radial = math.hypot(x_t - cx, y_t - cy)
            glow = max(0, 1 - radial * 2.25)
            base_color = mix(dark, primary, 0.42 + 0.34 * (1 - y_t))
            warm = mix(base_color, accent, glow * 0.62)
            final = mix(warm, light, max(0, glow - 0.55) * 0.42)
            pixels[x, y] = (*final, 255)


def draw_painterly_texture(base: Image.Image, rng: random.Random, palette: tuple[tuple[int, int, int], ...]) -> None:
    primary, accent, light, dark = palette

    def strokes(draw: ImageDraw.ImageDraw) -> None:
        for _ in range(860):
            x = rng.randint(-90, WIDTH + 60)
            y = rng.randint(-60, HEIGHT + 60)
            length = rng.randint(42, 190)
            width = rng.randint(5, 20)
            color = rng.choice([primary, accent, light, dark])
            color = mix(color, rng.choice([primary, accent, light]), rng.random() * 0.26)
            alpha = rng.randint(14, 54)
            angle = rng.uniform(-0.9, 0.9)
            x2 = x + math.cos(angle) * length
            y2 = y + math.sin(angle) * length
            draw.line((x, y, x2, y2), fill=rgba(color, alpha), width=width)

    add_layer(base, strokes)
    base.alpha_composite(Image.new("RGBA", base.size, rgba((255, 245, 216), 10)))
    base.alpha_composite(Image.effect_noise(base.size, 26).convert("RGBA").point(lambda p: int(p * 0.2)))


def draw_frame(base: Image.Image, rng: random.Random, palette: tuple[tuple[int, int, int], ...]) -> None:
    _, accent, light, dark = palette
    gold = mix(accent, light, 0.42)

    def frame(draw: ImageDraw.ImageDraw) -> None:
        margin = 38
        for offset, alpha in [(0, 220), (9, 110), (22, 160), (30, 75)]:
            rect = (margin + offset, margin + offset, WIDTH - margin - offset, HEIGHT - margin - offset)
            draw.rounded_rectangle(rect, radius=34, outline=rgba(gold, alpha), width=4 if offset in (0, 22) else 2)
        for corner_x in (72, WIDTH - 72):
            for corner_y in (72, HEIGHT - 72):
                sign_x = 1 if corner_x < WIDTH / 2 else -1
                sign_y = 1 if corner_y < HEIGHT / 2 else -1
                for radius in (24, 38, 55):
                    raw_bbox = (
                        corner_x - radius * sign_x,
                        corner_y - radius * sign_y,
                        corner_x + radius * sign_x,
                        corner_y + radius * sign_y,
                    )
                    bbox = (
                        min(raw_bbox[0], raw_bbox[2]),
                        min(raw_bbox[1], raw_bbox[3]),
                        max(raw_bbox[0], raw_bbox[2]),
                        max(raw_bbox[1], raw_bbox[3]),
                    )
                    start = 180 if sign_x > 0 and sign_y > 0 else 270 if sign_x < 0 and sign_y > 0 else 90 if sign_x > 0 else 0
                    draw.arc(bbox, start=start, end=start + 88, fill=rgba(gold, 120), width=3)
        for i in range(18):
            t = i / 17
            x = lerp(96, WIDTH - 96, t)
            y_top = 72 + math.sin(t * math.pi * 4) * 7
            y_bottom = HEIGHT - y_top
            draw.ellipse((x - 4, y_top - 4, x + 4, y_top + 4), fill=rgba(light, 150))
            draw.ellipse((x - 4, y_bottom - 4, x + 4, y_bottom + 4), fill=rgba(light, 130))
        draw.rounded_rectangle((22, 22, WIDTH - 22, HEIGHT - 22), radius=42, outline=rgba(dark, 135), width=18)

    add_layer(base, frame)


def draw_columns_and_halo(base: Image.Image, rng: random.Random, seed: int, palette: tuple[tuple[int, int, int], ...]) -> None:
    primary, accent, light, _ = palette
    gold = mix(accent, light, 0.55)

    def architecture(draw: ImageDraw.ImageDraw) -> None:
        for side in (0, 1):
            cx = 104 if side == 0 else WIDTH - 104
            top = 155 + (seed % 5) * 11
            bottom = HEIGHT - 190
            draw.rounded_rectangle((cx - 27, top, cx + 27, bottom), radius=15, fill=rgba(mix(primary, light, 0.25), 66))
            draw.rectangle((cx - 45, top - 20, cx + 45, top + 8), fill=rgba(gold, 86))
            draw.rectangle((cx - 48, bottom - 4, cx + 48, bottom + 24), fill=rgba(gold, 75))
            for k in range(4):
                x = cx - 18 + k * 12
                draw.line((x, top + 28, x, bottom - 18), fill=rgba(light, 38), width=3)

        halo_w = 330 + (seed % 8) * 12
        halo_box = (WIDTH / 2 - halo_w / 2, 152, WIDTH / 2 + halo_w / 2, 152 + halo_w)
        for width, alpha in [(28, 24), (16, 48), (5, 132)]:
            draw.ellipse(halo_box, outline=rgba(gold, alpha), width=width)
        for i in range(28):
            angle = (math.pi * 2 * i / 28) + seed * 0.13
            r1 = halo_w * 0.38
            r2 = halo_w * (0.48 + (i % 3) * 0.035)
            cx, cy = WIDTH / 2, 152 + halo_w / 2
            draw.line(
                (cx + math.cos(angle) * r1, cy + math.sin(angle) * r1, cx + math.cos(angle) * r2, cy + math.sin(angle) * r2),
                fill=rgba(gold, 88),
                width=2,
            )

    add_layer(base, architecture)


def draw_goddess(base: Image.Image, rng: random.Random, seed: int, palette: tuple[tuple[int, int, int], ...]) -> None:
    primary, accent, light, dark = palette
    skin = mix((246, 199, 164), light, 0.33 + (seed % 5) * 0.03)
    hair_options = [(61, 42, 27), (34, 23, 32), (136, 92, 45), (78, 52, 74), (221, 180, 108)]
    hair = hair_options[seed % len(hair_options)]
    gown = mix(primary, accent, 0.28 + (seed % 6) * 0.1)
    gold = mix(accent, light, 0.5)

    def figure(draw: ImageDraw.ImageDraw) -> None:
        cx = WIDTH // 2 + rng.randint(-18, 18)
        face_y = 396 + rng.randint(-12, 18)
        face_w = 156 + (seed % 5) * 8
        face_h = 205 + (seed % 4) * 12
        shoulder_y = face_y + 174
        bottom = HEIGHT - 86

        draw.polygon(
            [
                (cx - 245, bottom),
                (cx - 178, shoulder_y + 70),
                (cx - 65, shoulder_y + 20),
                (cx + 70, shoulder_y + 24),
                (cx + 188, shoulder_y + 72),
                (cx + 246, bottom),
            ],
            fill=rgba(gown, 235),
        )
        for i in range(14):
            x0 = cx - 210 + i * 32 + rng.randint(-9, 9)
            draw.line((x0, shoulder_y + 55, cx + rng.randint(-42, 42), bottom), fill=rgba(light, 38 + (i % 4) * 12), width=7)

        hair_shape = [
            (cx - face_w * 0.72, face_y - face_h * 0.53),
            (cx - face_w * 0.48, face_y - face_h * 0.92),
            (cx + face_w * 0.08, face_y - face_h * 1.04),
            (cx + face_w * 0.62, face_y - face_h * 0.76),
            (cx + face_w * 0.74, face_y - face_h * 0.2),
            (cx + face_w * 0.58, face_y + face_h * 0.52),
            (cx - face_w * 0.55, face_y + face_h * 0.55),
            (cx - face_w * 0.78, face_y + face_h * 0.02),
        ]
        draw.polygon(hair_shape, fill=rgba(hair, 244))
        for i in range(34):
            sx = cx - face_w * 0.58 + rng.random() * face_w * 1.16
            sy = face_y - face_h * 0.74 + rng.random() * face_h * 1.38
            ex = sx + rng.uniform(-36, 36)
            ey = sy + rng.uniform(26, 86)
            draw.line((sx, sy, ex, ey), fill=rgba(mix(hair, light, rng.random() * 0.35), rng.randint(70, 135)), width=rng.randint(3, 8))

        face_box = (cx - face_w / 2, face_y - face_h / 2, cx + face_w / 2, face_y + face_h / 2)
        draw.ellipse(face_box, fill=rgba(skin, 246))
        draw.ellipse((cx - 88, face_y + 66, cx + 88, face_y + 176), fill=rgba(skin, 235))

        eye_y = face_y - 24
        for sx in (-1, 1):
            ex = cx + sx * 38
            draw.arc((ex - 27, eye_y - 12, ex + 27, eye_y + 15), 190, 350, fill=rgba(dark, 210), width=4)
            draw.line((ex - 28, eye_y - 17, ex + 21, eye_y - 21), fill=rgba(hair, 145), width=4)
        draw.line((cx, eye_y + 6, cx - 8, eye_y + 54), fill=rgba(mix(skin, dark, 0.25), 115), width=4)
        draw.arc((cx - 38, face_y + 62, cx + 42, face_y + 94), 18, 164, fill=rgba((145, 51, 62), 170), width=5)
        draw.ellipse((cx - 68, face_y + 14, cx - 36, face_y + 44), fill=rgba((216, 83, 96), 34))
        draw.ellipse((cx + 35, face_y + 14, cx + 67, face_y + 44), fill=rgba((216, 83, 96), 34))

        crown_y = face_y - face_h * 0.68
        if seed % 3 == 0:
            points = []
            for i in range(7):
                x = cx - 84 + i * 28
                y = crown_y - (30 if i % 2 else 2)
                points.append((x, y))
            points.extend([(cx + 88, crown_y + 32), (cx - 88, crown_y + 32)])
            draw.polygon(points, fill=rgba(gold, 218))
        elif seed % 3 == 1:
            draw.arc((cx - 120, crown_y - 22, cx + 120, crown_y + 90), 200, 340, fill=rgba(gold, 218), width=10)
            for i in range(11):
                x = cx - 95 + i * 19
                draw.ellipse((x - 7, crown_y + 12, x + 7, crown_y + 26), fill=rgba(gold, 190))
        else:
            draw.line((cx - 102, crown_y + 32, cx + 102, crown_y + 32), fill=rgba(gold, 225), width=9)
            for i in range(5):
                x = cx - 68 + i * 34
                draw.polygon([(x, crown_y + 26), (x + 12, crown_y - 8), (x + 24, crown_y + 26)], fill=rgba(gold, 210))

        for i in range(22):
            x = rng.randint(cx - 240, cx + 240)
            y = rng.randint(155, bottom - 70)
            r = rng.randint(2, 6)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(light, rng.randint(72, 170)))

    add_layer(base, figure)


def finish(base: Image.Image, seed: int, palette: tuple[tuple[int, int, int], ...]) -> Image.Image:
    _, accent, light, dark = palette
    vignette = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(vignette, "RGBA")
    for i in range(95):
        alpha = round((i / 95) ** 1.7 * 145)
        draw.rounded_rectangle((i, i, WIDTH - i, HEIGHT - i), radius=46, outline=(0, 0, 0, alpha), width=3)
    base.alpha_composite(vignette)

    glaze = Image.new("RGBA", base.size, rgba(mix(accent, light, 0.45), 16 + seed % 15))
    base = Image.blend(base, glaze, 0.05)
    base = base.filter(ImageFilter.UnsharpMask(radius=1.5, percent=82, threshold=3))
    final = Image.new("RGB", base.size, dark)
    final.paste(base.convert("RGB"))
    return final


def make_card(index: int) -> Image.Image:
    rng = random.Random(8100 + index * 137)
    palette = PALETTES[(index - 1) % len(PALETTES)]
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw_gradient(image, index, palette)
    draw_painterly_texture(image, rng, palette)
    draw_columns_and_halo(image, rng, index, palette)
    draw_goddess(image, rng, index, palette)
    draw_frame(image, rng, palette)
    return finish(image, index, palette)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for index in range(1, 51):
        target = OUT_DIR / f"goddess-back-{index:02d}.webp"
        if target.exists():
            print(f"skip {target.relative_to(ROOT)}")
            continue
        image = make_card(index)
        image.save(target, "WEBP", quality=86, method=6)
        print(target.relative_to(ROOT))


if __name__ == "__main__":
    main()
