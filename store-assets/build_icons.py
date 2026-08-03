"""Build the final keycap icon set. Rendered at 8x and LANCZOS-downsampled for clean AA.

Small sizes get their own tuning: at 16px the keycap bevel is sub-pixel noise, so
that render drops the top-face contrast and enlarges the glyph to stay legible.
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)  # icons live in the repo root, next to manifest.json
PREVIEW = HERE

# Mid-slate, deliberately lighter than Chrome's dark toolbar (#202124) so the
# keycap silhouette survives there, while staying dark enough to read on light.
BASE = (61, 66, 84, 255)    # keycap body
FACE = (82, 88, 110, 255)   # lifted top face
GLYPH = (243, 60, 60, 255)  # play triangle


def render(size, *, bevel, glyph_scale, margin):
    S = size * 8
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    m = S * margin
    d.rounded_rectangle([m, m, S - m, S - m], radius=S * 0.22, fill=BASE)

    if bevel:
        i = S * 0.13
        d.rounded_rectangle([i, i * 0.92, S - i, S - i * 1.16],
                            radius=S * 0.16, fill=FACE)

    # Optically centered: a play triangle's visual mass sits left of its bbox center.
    h = S * glyph_scale
    w = h * 0.87
    cx, cy = S / 2, S * (0.49 if bevel else 0.5)
    d.polygon([(cx - w / 2 + w * 0.08, cy - h / 2),
               (cx - w / 2 + w * 0.08, cy + h / 2),
               (cx + w / 2 + w * 0.08, cy)], fill=GLYPH)

    return img.resize((size, size), Image.LANCZOS)


SPECS = {
    16:  dict(bevel=False, glyph_scale=0.46, margin=0.030),
    48:  dict(bevel=True,  glyph_scale=0.42, margin=0.050),
    128: dict(bevel=True,  glyph_scale=0.40, margin=0.055),
}

for size, spec in SPECS.items():
    icon = render(size, **spec)
    path = os.path.join(PROJECT, f"icon{size}.png")
    icon.save(path)
    print(f"wrote {path}  ({os.path.getsize(path)} bytes)")

# Preview sheet: true-size renders on both light and dark toolbar backgrounds,
# each also magnified 8x.
rows = [("light", (248, 249, 250)), ("dark", (32, 33, 36))]
CELL, PAD = 128, 24
sheet = Image.new("RGB", (PAD + len(SPECS) * 2 * (CELL + PAD),
                          PAD + len(rows) * (CELL + PAD)))
for r, (_, bg) in enumerate(rows):
    y = PAD + r * (CELL + PAD)
    x = PAD
    for size in SPECS:
        icon = Image.open(os.path.join(PROJECT, f"icon{size}.png"))
        for mode in ("actual", "zoom"):
            tile = Image.new("RGB", (CELL, CELL), bg)
            if mode == "actual":
                tile.paste(icon, ((CELL - size) // 2, (CELL - size) // 2), icon)
            else:
                z = icon.resize((CELL, CELL), Image.NEAREST)
                tile.paste(z, (0, 0), z)
            sheet.paste(tile, (x, y))
            x += CELL + PAD

sheet.save(os.path.join(PREVIEW, "final-preview.png"))
print("preview: per size -> actual size, then magnified; row 1 light bg, row 2 dark bg")
