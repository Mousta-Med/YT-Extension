"""Build Chrome Web Store listing assets.

The Store requires screenshots at 1280x800 or 640x400 and rejects images with an
alpha channel, so everything is flattened to RGB before saving.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(os.path.dirname(OUT), "icon128.png")
F = r"C:\Windows\Fonts"  # Windows-only; swap for a font dir on other platforms

BG = (23, 25, 33)
PANEL = (33, 36, 47)
KEY_FILL = (61, 66, 84)
KEY_EDGE = (92, 99, 122)
TEXT = (238, 240, 246)
MUTED = (150, 156, 175)
RED = (243, 60, 60)


def font(name, size):
    return ImageFont.truetype(os.path.join(F, name), size)


def w(d, text, fnt):
    return d.textbbox((0, 0), text, font=fnt)[2]


def keycap(d, x, y, label, fnt, pad=16, h=48):
    """Draw one key chip; returns its width."""
    tw = w(d, label, fnt)
    bw = max(h, tw + pad * 2)
    d.rounded_rectangle([x, y, x + bw, y + h], radius=10, fill=KEY_FILL, outline=KEY_EDGE, width=2)
    bbox = d.textbbox((0, 0), label, font=fnt)
    d.text((x + (bw - tw) / 2 - bbox[0], y + (h - (bbox[3] - bbox[1])) / 2 - bbox[1]),
           label, font=fnt, fill=TEXT)
    return bw


def combo(d, x, y, keys, fnt):
    """Draw Key + Key + Key; returns total width."""
    plus = font("segoeui.ttf", 24)
    start = x
    for i, k in enumerate(keys):
        if i:
            d.text((x + 9, y + 12), "+", font=plus, fill=MUTED)
            x += 9 + w(d, "+", plus) + 14
        x += keycap(d, x, y, k, fnt)
    return x - start


def screenshot():
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # subtle top accent
    d.rectangle([0, 0, W, 6], fill=RED)

    icon = Image.open(ICON).convert("RGBA").resize((104, 104), Image.LANCZOS)
    img.paste(icon, (96, 84), icon)

    d.text((228, 88), "YouTube Global Controls", font=font("segoeuib.ttf", 52), fill=TEXT)
    d.text((230, 152), "Control YouTube from anywhere \u2014 even when Chrome isn't focused.",
           font=font("segoeui.ttf", 26), fill=MUTED)

    rows = [
        (["Ctrl", "Shift", "1"], "Play / pause"),
        (["Ctrl", "Shift", "2"], "Picture-in-Picture"),
        (["Ctrl", "Shift", "9"], "Back 10 seconds"),
        (["Ctrl", "Shift", "0"], "Forward 10 seconds"),
    ]

    panel_y = 258
    d.rounded_rectangle([96, panel_y, W - 96, panel_y + 386], radius=20, fill=PANEL)

    kf = font("seguisb.ttf", 24)
    lf = font("segoeui.ttf", 27)

    # Measure every combo first so the labels share one column instead of
    # stepping raggedly with each combo's width.
    scratch = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    label_x = 140 + max(combo(scratch, 0, -200, keys, kf) for keys, _ in rows) + 46

    y = panel_y + 44
    for keys, label in rows:
        combo(d, 140, y, keys, kf)
        d.text((label_x, y + 8), label, font=lf, fill=TEXT)
        y += 82

    d.text((96, 704),
           "Rebind any shortcut  \u00b7  Pins the tab while playing  \u00b7  No data collected",
           font=font("segoeui.ttf", 23), fill=MUTED)
    return img


def promo(W, H, title_size, sub, icon_px, pad):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 5], fill=RED)

    icon = Image.open(ICON).convert("RGBA").resize((icon_px, icon_px), Image.LANCZOS)
    tf = font("segoeuib.ttf", title_size)
    sf = font("segoeui.ttf", int(title_size * 0.48))

    lines = ["YouTube Global", "Controls"]
    block_h = icon_px + 26 + len(lines) * int(title_size * 1.18) + 14 + int(title_size * 0.62)
    y = (H - block_h) / 2

    img.paste(icon, (int((W - icon_px) / 2), int(y)), icon)
    y += icon_px + 26
    for ln in lines:
        d.text(((W - w(d, ln, tf)) / 2, y), ln, font=tf, fill=TEXT)
        y += int(title_size * 1.18)
    y += 14
    d.text(((W - w(d, sub, sf)) / 2, y), sub, font=sf, fill=MUTED)
    return img


assets = {
    "store-screenshot-1280x800.png": screenshot(),
    "store-promo-small-440x280.png": promo(440, 280, 32, "Global playback shortcuts", 72, 20),
    "store-promo-marquee-1400x560.png": promo(1400, 560, 74, "Global playback shortcuts for YouTube", 150, 40),
}

for name, im in assets.items():
    p = os.path.join(OUT, name)
    im.convert("RGB").save(p)  # RGB: the Store rejects alpha channels
    print(f"{name}  {im.size[0]}x{im.size[1]}  {os.path.getsize(p) // 1024} KB")
