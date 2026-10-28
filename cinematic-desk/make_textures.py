"""Render the Arabic/English note texture with real text shaping (Blender can't shape Arabic).

Run with system Python (needs Pillow built with libraqm):
    python3 make_textures.py --title "فيسبوك" --lines "٢٠٠٤ — هارفارد" "فكرة بسيطة… غيّرت العالم"
"""
import argparse
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_LIGHT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def paper(w, h):
    rnd = random.Random(7)
    img = Image.new("RGB", (w, h), (232, 228, 218))
    px = img.load()
    for y in range(h):
        for x in range(0, w, 2):
            n = rnd.randint(-6, 6)
            c = (232 + n, 228 + n, 218 + n)
            px[x, y] = c
            if x + 1 < w:
                px[x + 1, y] = c
    d = ImageDraw.Draw(img)
    for y in range(int(h * 0.22), h, int(h * 0.075)):  # ruled lines
        d.line([(0, y), (w, y)], fill=(170, 190, 215), width=3)
    d.line([(w - int(w * 0.1), 0), (w - int(w * 0.1), h)], fill=(215, 120, 120), width=3)
    return img


def text(d, xy, s, size, font, fill, anchor="ra"):
    f = ImageFont.truetype(font, size, layout_engine=ImageFont.Layout.RAQM)
    d.text(xy, s, font=f, fill=fill, anchor=anchor, direction="rtl" if any("؀" <= c <= "ۿ" for c in s) else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default="فيسبوك")
    ap.add_argument("--lines", nargs="*", default=["٢٠٠٤ — غرفة سكن في هارفارد", "فكرة بسيطة…", "غيّرت العالم"])
    ap.add_argument("--circled", default="البداية")
    ap.add_argument("--screen", default="القصة", help="big title shown on the monitor")
    ap.add_argument("--out", default=os.path.join(HERE, "textures"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    w, h = 1400, 1800
    img = paper(w, h)
    d = ImageDraw.Draw(img)
    ink = (25, 35, 80)
    x = w - int(w * 0.14)
    text(d, (x, int(h * 0.08)), a.title, 170, FONT, ink)
    y = int(h * 0.3)
    for line in a.lines:
        text(d, (x, y), line, 78, FONT_LIGHT, ink)
        y += int(h * 0.15)
    # circled keyword: this is where the glowing line is born (UV ~ 0.22, 0.16)
    d.ellipse([int(w * 0.06), int(h * 0.78), int(w * 0.38), int(h * 0.9)], outline=(200, 40, 40), width=10)
    text(d, (int(w * 0.22), int(h * 0.84)), a.circled, 70, FONT, (200, 40, 40), anchor="mm")
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(os.path.join(a.out, "note.png"))

    # monitor: bright off-white card like the reference setup (the screen is a practical light)
    sw, sh = 1920, 1080
    scr = Image.new("RGB", (sw, sh), (236, 234, 228))
    sd = ImageDraw.Draw(scr)
    text(sd, (sw // 2, sh // 2 - 40), a.screen, 300, FONT, (12, 12, 14), anchor="mm")
    sd.line([(sw * 0.3, sh * 0.72), (sw * 0.7, sh * 0.72)], fill=(12, 12, 14), width=6)
    text(sd, (sw // 2, int(sh * 0.8)), a.title, 70, FONT_LIGHT, (60, 60, 64), anchor="mm")
    scr.save(os.path.join(a.out, "screen.png"))
    print("wrote note.png + screen.png to", a.out)


if __name__ == "__main__":
    main()
