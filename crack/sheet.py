# usage: sheet.py out.png cols thumbw img1 img2 ...   (labels = filenames)
import sys
from PIL import Image, ImageDraw
out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * th), (30, 30, 30))
d = ImageDraw.Draw(S)
for i, im in enumerate(ims):
    x, y = (i % cols) * tw, (i // cols) * th
    S.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    lab = files[i].split('t_')[-1].replace('.jpg', '')
    d.rectangle([x, y, x + 64, y + 16], fill=(0, 0, 0)); d.text((x + 3, y + 2), lab + 's', fill=(255, 220, 120))
S.save(out)
