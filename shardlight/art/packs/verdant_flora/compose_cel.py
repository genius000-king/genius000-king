"""Composite cel previews: python3 compose_cel.py  (reads _raw/*_cel.png + *_nrm.png -> art/previews/verdant_flora/<id>_cel.png)"""
import os, sys, re, numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get("CEL_RAW", os.path.join(HERE, "_raw"))
OUT = os.path.join(HERE, "..", "..", "previews", "verdant_flora")


BG = np.array([0x3A, 0x33, 0x58], np.float32)
INK = np.array([10, 6, 24], np.float32)


def compose(name, outline_px=3):
    cel = Image.open(os.path.join(RAW, name + "_cel.png")).convert("RGBA")
    a = np.asarray(cel)[..., 3] > 128
    rgb = np.asarray(cel.convert("RGB")).astype(np.float32)
    nrm = np.asarray(Image.open(os.path.join(RAW, name + "_nrm.png")).convert("RGB")).astype(np.float32) / 255
    dep = np.asarray(Image.open(os.path.join(RAW, name + "_dep.png")).convert("L")).astype(np.float32) / 255
    dep = np.where(a, dep, 0.0)
    # interior ink: normal creases + depth jumps
    gx = np.abs(np.roll(nrm, -1, 1) - np.roll(nrm, 1, 1)).sum(-1)
    gy = np.abs(np.roll(nrm, -1, 0) - np.roll(nrm, 1, 0)).sum(-1)
    dx = np.abs(np.roll(dep, -1, 1) - np.roll(dep, 1, 1))
    dy = np.abs(np.roll(dep, -1, 0) - np.roll(dep, 1, 0))
    e = ((np.maximum(gx, gy) > 0.6) | (np.maximum(dx, dy) > 0.05)) & a
    em = Image.fromarray((e * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    e = np.asarray(em) > 128
    # silhouette ink: dilated alpha
    am = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(outline_px * 2 + 1))
    sil = (np.asarray(am) > 128)
    out = np.where(a[..., None], rgb, BG)
    out = np.where((sil & ~a)[..., None], INK, out)
    out = np.where(e[..., None], INK, out)
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, name + "_cel.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    pat = sys.argv[1] if len(sys.argv) > 1 else ""
    for f in sorted(os.listdir(RAW)):
        if f.endswith("_cel.png") and re.search(pat, f):
            n = f[:-8]
            if os.path.exists(os.path.join(RAW, n + "_dep.png")):
                compose(n)
