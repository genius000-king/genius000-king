"""Tile rendered stills into one labelled contact sheet: sheet.py out.jpg a.jpg b.jpg ..."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W, H, cols = 640, 360, 3
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + 22)), "white")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y))
    d.text((x + 6, y + H + 4), f.split("/")[-1], fill="black")
sheet.save(out, quality=88)
