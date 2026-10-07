#!/usr/bin/env python3
# Usage: python3 scripts/make-icon.py art/icon-source.png app/src/main/res /tmp/icon-preview.png  (needs Pillow + numpy)
"""Turns the supplied app icon into Android adaptive-icon layers.

foreground  = the glyph (bubble, eyes, blue glow), luminance-keyed off the dark square
background  = the dark square's own gradient, full bleed
monochrome  = the glyph silhouette, for Android 13+ themed icons
brand       = the original dark square with its rounded corners, for use inside the app
"""
import sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w, _ = im.shape

# 1. the dark square: everything clearly darker than the white margin
lum = im.mean(axis=2)
dark = lum < 200
ys, xs = np.where(dark)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
sq = im[y0:y1 + 1, x0:x1 + 1]
print("dark square", (x0, y0, x1, y1), sq.shape)

# 2. background estimate: the square's colour with the glyph painted out (median of a big blur
#    over pixels that are dark), then a smooth radial model of it
S = sq.shape[0]
bg_px = sq[(sq.max(axis=2) < 60)]
bg_center = np.median(sq[S//2-40:S//2+40, S//2-40:S//2+40][sq[S//2-40:S//2+40, S//2-40:S//2+40].max(axis=2) < 60], axis=0)
bg_edge = np.median(bg_px, axis=0)
print("bg centre", bg_center, "edge", bg_edge)

# outside the rounded square: the white corners, flood-filled from each corner, then grown a few
# pixels to swallow the anti-aliased rim
marker = Image.fromarray(sq.mean(axis=2).astype(np.uint8), "L").copy()  # writable copy: floodfill edits in place
for corner in [(0, 0), (marker.width - 1, 0), (0, marker.height - 1), (marker.width - 1, marker.height - 1)]:
    if marker.getpixel(corner) > 150:
        ImageDraw.floodfill(marker, corner, 0, thresh=110)
outside = np.asarray(marker.point(lambda v: 255 if v == 0 else 0).filter(ImageFilter.MaxFilter(15))) > 0

# 3. key the glyph: alpha from how far a pixel rises above the dark ground
ground = 52.0  # just above the brightest point of the dark square itself
peak = sq.max(axis=2)
alpha = np.clip((peak - ground) / (255.0 - ground), 0, 1) ** 0.85
alpha[outside] = 0
# the square's own anti-aliased rim runs along the image edges; the glyph never comes near them
rim = 12
alpha[:rim, :] = 0; alpha[-rim:, :] = 0; alpha[:, :rim] = 0; alpha[:, -rim:] = 0
a3 = np.maximum(alpha[..., None], 1e-4)
ref = np.array(bg_edge, dtype=np.float32)
color = np.clip((sq - ref * (1 - a3)) / a3, 0, 255)
fg = np.dstack([color, alpha * 255]).astype(np.uint8)
fg_img = Image.fromarray(fg, "RGBA")

# glyph bounds (glow included)
ay, ax = np.where(alpha > 0.04)
pad = 36  # keep the glow's faint tail instead of cutting it at the threshold
gb = (max(ax.min() - pad, 0), max(ay.min() - pad, 0), min(ax.max() + pad, S - 1), min(ay.max() + pad, S - 1))
print("glyph bbox", gb, "in square of", S)

def radial(size, inner, outer):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (size * 0.72)
    d = np.clip(d, 0, 1)[..., None]
    return (np.array(inner) * (1 - d) + np.array(outer) * d).astype(np.uint8)

GLYPH = 0.545  # of the 108-unit canvas, measured on the glow-padded bounds
densities = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
glyph = fg_img.crop(gb)
gw, gh = glyph.size
for name, px in densities.items():
    # small enough that a circular mask (the strictest shape) never cuts the bubble or its tail
    target = px * GLYPH
    s = target / max(gw, gh)
    g = glyph.resize((max(1, round(gw * s)), max(1, round(gh * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    # place the glyph where it sat in the original: its centre offset relative to the square
    cx = ((gb[0] + gb[2]) / 2 - S / 2) / S * px * (GLYPH * S / max(gw, gh))
    cy = ((gb[1] + gb[3]) / 2 - S / 2) / S * px * (GLYPH * S / max(gw, gh))
    canvas.alpha_composite(g, (round(px / 2 + cx - g.width / 2), round(px / 2 + cy - g.height / 2)))
    d = f"{out}/mipmap-{name}"
    import os; os.makedirs(d, exist_ok=True)
    canvas.save(f"{d}/ic_launcher_foreground.png", optimize=True)
    Image.fromarray(radial(px, bg_center, bg_edge), "RGB").save(f"{d}/ic_launcher_background.png", optimize=True)
    mono = Image.new("RGBA", (px, px), (255, 255, 255, 0))
    mono.putalpha(canvas.getchannel("A"))
    mono.save(f"{d}/ic_launcher_monochrome.png", optimize=True)

# 4. brand mark for inside the app: the dark square, corners transparent like the original
brand = Image.fromarray(sq.astype(np.uint8), "RGB").convert("RGBA").resize((192, 192), Image.LANCZOS)
mask = Image.new("L", (192 * 4, 192 * 4), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 192 * 4 - 1, 192 * 4 - 1), radius=int(192 * 4 * 0.225), fill=255)
brand.putalpha(mask.resize((192, 192), Image.LANCZOS))
import os; os.makedirs(f"{out}/drawable-nodpi", exist_ok=True)
brand.save(f"{out}/drawable-nodpi/brand_mark.png", optimize=True)

# 5. a preview of what launchers will show (circle and squircle masks)
px = 432
fgp = Image.open(f"{out}/mipmap-xxxhdpi/ic_launcher_foreground.png")
bgp = Image.open(f"{out}/mipmap-xxxhdpi/ic_launcher_background.png").convert("RGBA")
full = bgp.copy(); full.alpha_composite(fgp)
prev = Image.new("RGBA", (px * 2 + 40, px), (240, 240, 240, 255))
for i, shape in enumerate(["circle", "squircle"]):
    m = Image.new("L", (px, px), 0)
    dr = ImageDraw.Draw(m)
    # launchers show the middle 72/108 of the layers
    inset = px * 18 / 108
    box = (inset, inset, px - inset, px - inset)
    if shape == "circle": dr.ellipse(box, fill=255)
    else: dr.rounded_rectangle(box, radius=px * 0.2, fill=255)
    tile = Image.new("RGBA", (px, px), (240, 240, 240, 255)); tile.paste(full, (0, 0), m)
    prev.paste(tile, (i * (px + 40), 0))
prev.save(sys.argv[3])
print("ok")
