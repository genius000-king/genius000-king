"""One-off: python3 make_matcaps.py -> _matcaps/cel2.png (hard 2-tone) and _matcaps/nrm.png (view normal)."""
import os, numpy as np
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_matcaps")
os.makedirs(D, exist_ok=True)
N = 256
y, x = np.mgrid[0:N, 0:N]
u = (x + 0.5) / N * 2 - 1
v = 1 - (y + 0.5) / N * 2          # image row 0 = top
r2 = u * u + v * v
nz = np.sqrt(np.clip(1 - r2, 0, 1))
n = np.stack([u, v, nz], -1)
L = np.array([-0.45, 0.65, 0.62]); L /= np.linalg.norm(L)
t = n @ L
lit = np.array([1.0, 0.97, 0.88]); shd = np.array([0.50, 0.46, 0.80]); mid = np.array([0.74, 0.70, 0.90])
img = np.where((t > 0.12)[..., None], lit, shd)
img = np.where(((t > -0.12) & (t <= 0.12))[..., None], mid, img) * 0 + img  # keep strictly 2 tone
img = (np.clip(img, 0, 1) * 255).astype(np.uint8)
Image.fromarray(img).save(os.path.join(D, "cel2.png"))
nm = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
Image.fromarray(nm).save(os.path.join(D, "nrm.png"))
