"""Contact sheets for terrain_features (plain python3 + Pillow; run by terrain_features.py after the merge).

Writes art/previews/terrain_features/_sheet.png (all assets, labelled), per-family _sheet_<family>.png and
_sheet_caves_inside.png (inside views of the cave kit).
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PREV = os.path.join(ROOT, "art", "previews", "terrain_features")
MAN = os.path.join(ROOT, "game", "assets", "models", "terrain_features", "manifest.json")
BG = (0x2A, 0x24, 0x40)


def make(files, out, cols, cell, label=True):
    files = [f for f in files if os.path.exists(os.path.join(PREV, f + ".png"))]
    if not files:
        return
    cols = min(cols, len(files))
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), BG)
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", max(9, cell // 22))
    except Exception:
        font = ImageFont.load_default()
    for i, f in enumerate(files):
        im = Image.open(os.path.join(PREV, f + ".png")).convert("RGB").resize((cell, cell), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * cell
        sheet.paste(im, (x, y))
        if label:
            t = f.replace("_inside", " (in)")
            d.rectangle((x, y + cell - cell // 9, x + cell, y + cell), fill=(20, 16, 32))
            d.text((x + 3, y + cell - cell // 9 + 2), t[:34], fill=(235, 230, 255), font=font)
    sheet.save(os.path.join(PREV, out))
    print("sheet", out, sheet.size, len(files))


def main():
    with open(MAN) as f:
        assets = json.load(f)["assets"]
    ids = [a["id"] for a in assets]
    make(ids, "_sheet.png", 10, 256)
    fams = {}
    for a in assets:
        fams.setdefault(a.get("family", a["category"]), []).append(a["id"])
    for fam, lst in fams.items():
        make(lst, "_sheet_%s.png" % fam, 6, 340)
    inside = [i + "_inside" for i in ids if os.path.exists(os.path.join(PREV, i + "_inside.png"))]
    make(inside, "_sheet_caves_inside.png", 4, 400)


if __name__ == "__main__":
    main()
