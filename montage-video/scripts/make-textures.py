"""Procedural textures: film grain tiles, white paper, kraft board."""
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(7)

def save(a, path, mode="RGB"):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), mode).save(path)

# Film grain: grey noise with alpha, 6 frames to cycle through
for i in range(6):
    n = rng.normal(128, 50, (512, 512))
    n = np.array(Image.fromarray(np.clip(n, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), float)
    a = np.stack([n, n, n, np.full_like(n, 255)], -1)
    save(a, f"public/tex/grain-{i}.png", "RGBA")

def fibers(h, w, base, amp, blur, streak):
    n = rng.normal(0, 1, (h, w))
    img = Image.fromarray(np.clip(n * 40 + 128, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(blur))
    s = np.array(img, float) - 128
    # long fibers: stretched noise
    f = Image.fromarray(np.clip(rng.normal(128, 60, (h // streak, w)), 0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    s += (np.array(f, float) - 128) * 0.35
    out = np.stack([base[0] + s * amp, base[1] + s * amp, base[2] + s * amp], -1)
    return out

save(fibers(1080, 1920, (246, 242, 233), 0.35, 1.2, 40), "public/tex/paper.jpg")
save(fibers(1080, 1920, (196, 160, 118), 0.55, 1.5, 30), "public/tex/kraft.jpg")
save(fibers(1080, 1920, (233, 223, 201), 0.45, 1.0, 60), "public/tex/archive.jpg")
print("ok")
