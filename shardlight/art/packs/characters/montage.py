import sys
from PIL import Image
aid = sys.argv[1]
tags = sys.argv[2:] or ["front", "", "face", "pose_wave"]
d = "art/previews/characters/"
ims = []
for t in tags:
    n = aid if t == "" else f"_{aid}_{t}"
    ims.append(Image.open(d + n + ".png").convert("RGB"))
w, h = ims[0].size
cols = 2 if len(ims) <= 4 else 3
rows = (len(ims) + cols - 1) // cols
out = Image.new("RGB", (w * cols, h * rows))
for i, im in enumerate(ims):
    out.paste(im, ((i % cols) * w, (i // cols) * h))
out.save(f"/tmp/claude-0/-home-user-genius000-king/ba35e3c7-d110-5354-97e6-2aaba7be708d/scratchpad/m_{aid}.png")
