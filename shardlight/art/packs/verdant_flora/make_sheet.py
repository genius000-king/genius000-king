"""Contact sheets with labels (PIL, run with system python3): python3 make_sheet.py [regex] [out] [cols] [cell]"""
import os, sys, re, json
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PV = os.path.join(ROOT, "art", "previews", "verdant_flora")


def build(pattern=None, out="_sheet.png", cols=8, cell=256, label=True):
    files = sorted(f for f in os.listdir(PV) if f.endswith(".png") and not f.startswith("_"))
    if pattern:
        files = [f for f in files if re.search(pattern, f)]
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), (58, 51, 88))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", max(9, cell // 24))
    except Exception:
        font = ImageFont.load_default()
    for i, f in enumerate(files):
        im = Image.open(os.path.join(PV, f)).convert("RGB").resize((cell, cell), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * cell
        sheet.paste(im, (x, y))
        if label:
            name = f[:-4].replace("verdant_", "")
            d.text((x + 4, y + cell - cell // 20 - 6), name, fill=(240, 235, 255), font=font)
    path = out if os.path.isabs(out) else os.path.join(PV, out)
    sheet.save(path)
    return path, len(files)


if __name__ == "__main__":
    pat = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "-" else None
    out = sys.argv[2] if len(sys.argv) > 2 else "_sheet.png"
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    cell = int(sys.argv[4]) if len(sys.argv) > 4 else 256
    print(build(pat, out, cols, cell))
