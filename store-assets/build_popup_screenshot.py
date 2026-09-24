"""Render a Web Store screenshot depicting the toolbar popup.

The popup is redrawn from the same metrics as popup.html rather than eyeballed:
every colour, padding, radius and font size below mirrors that file, so the
mockup stays truthful. Drawn at 6x and LANCZOS-downsampled.

If popup.html changes, update the constants here to match.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(os.path.dirname(HERE), "icon48.png")
F = r"C:\Windows\Fonts"

# --- values mirrored from popup.html -----------------------------------------
BG = (23, 25, 33)          # --bg      #171921
PANEL = (33, 36, 48)       # --panel   #212430
TEXT = (238, 240, 246)     # --text    #eef0f6
MUTED = (150, 156, 175)    # --muted   #969caf
KEY_FILL = (61, 66, 84)    # --key-fill #3d4254
KEY_EDGE = (92, 99, 122)   # --key-edge #5c637a
ACCENT = (243, 60, 60)     # --accent  #f33c3c

POPUP_W = 310              # body width
PAD = 16                   # body padding
ROW_PAD_X, ROW_PAD_Y = 11, 6
ROW_GAP = 4
LIST_GAP = 14              # ul margin-bottom
HEADING_H = 16             # h2: 11px at the body's 1.45 line height
HEADING_GAP = 6            # h2 margin-bottom
KBD_MIN_W, KBD_PAD_X = 22, 6

# What a fresh install shows: the four commands Chrome lets us give default
# keys, then the extras, which start unassigned (None renders "Not set").
CORE_ROWS = [
    ("Play / pause", ["Ctrl", "Shift", "1"]),
    ("Picture-in-Picture", ["Ctrl", "Shift", "2"]),
    ("Back 10 seconds", ["Ctrl", "Shift", "9"]),
    ("Forward 10 seconds", ["Ctrl", "Shift", "0"]),
]
EXTRA_ROWS = [
    ("Next video", None),
    ("Previous video", None),
    ("Mute / unmute", None),
    ("Volume up", None),
    ("Volume down", None),
    ("Speed up", None),
    ("Slow down", None),
]
HEADING = "More controls"
NOTE = 'Give extras a key and set them to "Global".'


def fnt(name, px, S):
    return ImageFont.truetype(os.path.join(F, name), int(px * S))


from PIL import ImageFont  # noqa: E402  (kept next to fnt for clarity)


def tw(d, text, f):
    b = d.textbbox((0, 0), text, font=f)
    return b[2] - b[0]


def vtext(d, x, cy, text, f, fill):
    """Draw text left-aligned at x, optically centred on cy."""
    b = d.textbbox((0, 0), text, font=f)
    d.text((x - b[0], cy - (b[3] + b[1]) / 2), text, font=f, fill=fill)


def popup(S):
    label_f = fnt("segoeui.ttf", 13, S)
    title_f = fnt("seguisb.ttf", 14, S)
    kbd_f = fnt("seguisb.ttf", 11, S)
    sep_f = fnt("segoeui.ttf", 10, S)
    btn_f = fnt("seguisb.ttf", 12, S)
    note_f = fnt("segoeui.ttf", 11, S)
    heading_f = fnt("seguisb.ttf", 11, S)
    unset_f = fnt("segoeui.ttf", 11, S)

    kbd_h = 19 * S
    row_h = kbd_h + ROW_PAD_Y * 2 * S
    btn_h = 34 * S

    def list_h(rows):
        return len(rows) * row_h + (len(rows) - 1) * ROW_GAP * S + LIST_GAP * S

    H = int(PAD * S + 28 * S + 14 * S
            + list_h(CORE_ROWS)
            + (HEADING_H + HEADING_GAP) * S + list_h(EXTRA_ROWS)
            + btn_h + 10 * S + 16 * S + PAD * S)
    W = int(POPUP_W * S)

    img = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(img)

    # header
    y = PAD * S
    icon = Image.open(ICON).convert("RGBA").resize((int(28 * S), int(28 * S)), Image.LANCZOS)
    img.paste(icon, (int(PAD * S), int(y)), icon)
    vtext(d, PAD * S + 28 * S + 10 * S, y + 14 * S,
          "YouTube Global Controls", title_f, TEXT)
    y += 28 * S + 14 * S

    def draw_rows(y, rows):
        right = (POPUP_W - PAD - ROW_PAD_X) * S
        for label, keys in rows:
            d.rounded_rectangle([PAD * S, y, (POPUP_W - PAD) * S, y + row_h],
                                radius=8 * S, fill=PANEL)
            cy = y + row_h / 2
            vtext(d, PAD * S + ROW_PAD_X * S, cy, label, label_f, TEXT)

            if keys is None:
                # .unset.optional: muted, regular weight
                vtext(d, right - tw(d, "Not set", unset_f), cy, "Not set", unset_f, MUTED)
                y += row_h + ROW_GAP * S
                continue

            # keys, laid out right-to-left from the row's right padding
            widths = [max(KBD_MIN_W * S, tw(d, k, kbd_f) + KBD_PAD_X * 2 * S) for k in keys]
            sep_w = tw(d, "+", sep_f) + 8 * S
            total = sum(widths) + sep_w * (len(keys) - 1)
            kx = right - total

            for i, (k, bw) in enumerate(zip(keys, widths)):
                if i:
                    vtext(d, kx + 4 * S, cy, "+", sep_f, MUTED)
                    kx += sep_w
                d.rounded_rectangle([kx, cy - kbd_h / 2, kx + bw, cy + kbd_h / 2],
                                    radius=5 * S, fill=KEY_FILL, outline=KEY_EDGE,
                                    width=max(1, int(S)))
                b = d.textbbox((0, 0), k, font=kbd_f)
                d.text((kx + (bw - (b[2] - b[0])) / 2 - b[0], cy - (b[3] + b[1]) / 2),
                       k, font=kbd_f, fill=TEXT)
                kx += bw
            y += row_h + ROW_GAP * S
        return y + (LIST_GAP - ROW_GAP) * S

    y = draw_rows(y, CORE_ROWS)

    # h2, indented 2px
    vtext(d, (PAD + 2) * S, y + HEADING_H / 2 * S, HEADING, heading_f, MUTED)
    y += (HEADING_H + HEADING_GAP) * S

    y = draw_rows(y, EXTRA_ROWS)

    # button
    d.rounded_rectangle([PAD * S, y, (POPUP_W - PAD) * S, y + btn_h],
                        radius=8 * S, fill=KEY_FILL, outline=KEY_EDGE, width=max(1, int(S)))
    label = "Change shortcuts"
    vtext(d, (POPUP_W * S - tw(d, label, btn_f)) / 2, y + btn_h / 2, label, btn_f, TEXT)
    y += btn_h + 10 * S

    vtext(d, (POPUP_W * S - tw(d, NOTE, note_f)) / 2, y + 8 * S, NOTE, note_f, MUTED)
    return img


def screenshot():
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 6], fill=ACCENT)

    # popup, drawn at 6x then reduced to the largest display scale (up to 1.85x)
    # that still leaves a margin above and below
    raw = popup(6)
    scale = min(1.85, (H - 100) / (raw.height / 6))
    pw, ph = int(POPUP_W * scale), int(raw.height / 6 * scale)
    card = raw.resize((pw, ph), Image.LANCZOS)

    px, py = W - pw - 118, int((H - ph) / 2) + 10

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [px + 10, py + 16, px + pw + 10, py + ph + 16], radius=18, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    img.paste(Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB"), (0, 0))

    rounded = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=14, fill=255)
    rounded.paste(card, (0, 0))
    img.paste(rounded, (px, py), mask)

    d = ImageDraw.Draw(img)
    d.text((110, 214), "Every shortcut", font=fnt("segoeuib.ttf", 54, 1), fill=TEXT)
    d.text((110, 278), "at a glance", font=fnt("segoeuib.ttf", 54, 1), fill=TEXT)

    body = fnt("segoeui.ttf", 24, 1)
    for i, line in enumerate([
        "Click the toolbar icon to see every",
        "shortcut and the key it is bound to.",
    ]):
        d.text((112, 372 + i * 34), line, font=body, fill=MUTED)

    for i, line in enumerate([
        "Next, previous, mute, volume and speed",
        "are one click away in Chrome's editor.",
    ]):
        d.text((112, 470 + i * 34), line, font=body, fill=MUTED)

    return img


out = os.path.join(HERE, "store-screenshot-popup-1280x800.png")
screenshot().save(out)
print(f"{os.path.basename(out)}  1280x800  {os.path.getsize(out) // 1024} KB")
