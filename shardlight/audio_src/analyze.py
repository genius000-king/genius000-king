#!/usr/bin/env python3
"""Analyse the generated audio library.

Prints a table: event, #variants, duration, peak dBFS, RMS dB, LUFS, spectral
centroid, DC offset, loop-seam error.  Renders spectrogram PNGs (numpy + pillow)
for a representative subset into audio_src/reports/.

usage: python3 audio_src/analyze.py [--spec event1 event2 ...] [--all-spec]
"""
import csv
import json
import os
import sys

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import toolkit as T  # noqa: E402

ROOT = os.environ.get("AUDIO_ROOT") or os.path.normpath(os.path.join(HERE, "..", "game", "assets", "audio"))
REPORTS = os.environ.get("REPORTS_DIR") or os.path.join(HERE, "reports")

DEFAULT_SPECS = ["plasma_charge_loop", "plasma_fire", "plasma_impact", "step_grass_walk",
                 "step_stone_run", "mus_verdant", "amb_verdant", "plasma_charge_start",
                 "keystone_pickup", "ability_unlock", "mus_menu", "mus_tension", "stasis_loop",
                 "step_water_walk", "step_metal_run", "talk_blip_mid", "wisp_idle_loop", "bird"]


def load(path):
    x, sr = sf.read(path, dtype="float64", always_2d=False)
    return x, sr


def centroid(x, sr):
    m = x.mean(axis=1) if x.ndim == 2 else x
    n = len(m)
    if n < 64:
        return 0.0
    w = np.hanning(n)
    sp = np.abs(np.fft.rfft(m * w)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    return float((sp * f).sum() / (sp.sum() + 1e-18))


def seam_metrics(x, sr):
    """(step_ratio, level_diff_dB, wrap_jump_ratio) for a loop file.
    step_ratio  = |x[0]-x[-1]| / rms(diff) ; level_diff = |rms(last 50ms)-rms(first 50ms)|
    wrap_jump   = max |dx| within +-3 ms of the seam / 99.9th pct |dx| elsewhere."""
    m = x.mean(axis=1) if x.ndim == 2 else x
    k = int(0.05 * sr)
    first, last = m[:k], m[-k:]
    d = np.diff(m)
    step = abs(m[0] - m[-1]) / (np.sqrt(np.mean(d ** 2)) + 1e-12)
    ld = abs(T.rms_db(first) - T.rms_db(last))
    w = np.concatenate([m[-int(0.003 * sr):], m[:int(0.003 * sr)]])
    near = np.max(np.abs(np.diff(w)))
    ref = np.percentile(np.abs(d), 99.9) + 1e-12
    return float(step), float(ld), float(near / ref)


# ------------------------------------------------------------ spectrogram
_CM = np.array([[0, 0, 4], [30, 12, 70], [90, 20, 110], [160, 40, 100], [215, 80, 60],
                [245, 140, 20], [250, 205, 60], [252, 255, 190]], dtype=float)


def cmap(v):
    v = np.clip(v, 0, 1) * (len(_CM) - 1)
    i = np.clip(np.floor(v).astype(int), 0, len(_CM) - 2)
    f = (v - i)[..., None]
    return (_CM[i] * (1 - f) + _CM[i + 1] * f).astype(np.uint8)


def spectrogram_png(path, out, width=1300, height=420, fmin=40.0, db_range=78.0, t0=0.0, t1=None):
    x, sr = load(path)
    m = x.mean(axis=1) if x.ndim == 2 else x
    if t1 is not None:
        m = m[int(t0 * sr):int(t1 * sr)]
    dur = len(m) / sr
    n_fft = 512 if dur < 0.6 else 1024 if dur < 3 else 2048 if dur < 10 else 4096
    n_frames = min(width, max(8, int(dur * sr / 128)))
    hop = max(64, (len(m) - n_fft) // max(1, n_frames - 1)) if len(m) > n_fft else 64
    mp = np.pad(m, (0, max(0, n_fft + hop * (n_frames - 1) - len(m))))
    win = np.hanning(n_fft)
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n_frames)[:, None]
    S = np.abs(np.fft.rfft(mp[idx] * win, axis=1)) / (n_fft / 4)
    f = np.fft.rfftfreq(n_fft, 1 / sr)
    fmax = sr / 2 * 0.99
    rows = np.exp(np.linspace(np.log(fmax), np.log(fmin), height))     # top = high
    Sdb = 20 * np.log10(np.maximum(S, 1e-9))
    img = np.empty((height, n_frames))
    for r in range(height):
        k = np.searchsorted(f, rows[r])
        k = min(max(k, 1), len(f) - 1)
        img[r] = Sdb[:, k - 1:k + 1].max(axis=1)
    top = Sdb.max()
    v = (img - (top - db_range)) / db_range
    rgb = cmap(v)
    im = Image.fromarray(rgb).resize((width, height), Image.BILINEAR)
    pad_l, pad_b, pad_t = 46, 22, 16
    canvas = Image.new("RGB", (width + pad_l, height + pad_b + pad_t), (14, 14, 18))
    canvas.paste(im, (pad_l, pad_t))
    dr = ImageDraw.Draw(canvas)
    for fr in (100, 300, 1000, 3000, 10000):
        y = pad_t + int((np.log(fmax) - np.log(fr)) / (np.log(fmax) - np.log(fmin)) * (height - 1))
        dr.line([(pad_l, y), (pad_l + width, y)], fill=(70, 70, 90))
        dr.text((2, y - 5), f"{fr // 1000}k" if fr >= 1000 else str(fr), fill=(200, 200, 210))
    nt = 10 if dur > 4 else 5
    for i in range(nt + 1):
        xx = pad_l + int(i / nt * (width - 1))
        dr.line([(xx, pad_t + height), (xx, pad_t + height + 4)], fill=(200, 200, 210))
        dr.text((xx - 10, pad_t + height + 6), f"{dur * i / nt:.1f}s", fill=(200, 200, 210))
    dr.text((pad_l + 4, 2), f"{os.path.basename(path)}  {dur:.2f}s  peak {T.peak_db(x):.1f} dBFS",
            fill=(255, 255, 255))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.save(out)


# ------------------------------------------------------------------ main
def main():
    args = sys.argv[1:]
    man = json.load(open(os.path.join(ROOT, "manifest.json")))
    spec_events = DEFAULT_SPECS
    if "--spec" in args:
        spec_events = args[args.index("--spec") + 1:]
    quiet = "--quiet" in args
    zoom = None
    if "--zoom" in args:
        zi = args.index("--zoom")
        zoom = (float(args[zi + 1]), float(args[zi + 2]))
        spec_events = args[zi + 3:]
    if "--all-spec" in args:
        spec_events = list(man)
    rows = []
    total = 0
    problems = []
    for ev, m in man.items():
        peaks, rmss, durs, cents, dcs, lufss, seams = [], [], [], [], [], [], []
        for rel in m["files"]:
            p = os.path.join(ROOT, rel)
            total += os.path.getsize(p)
            x, sr = load(p)
            assert sr == 48000, (rel, sr)
            peaks.append(T.peak_db(x)); rmss.append(T.rms_db(x)); durs.append(len(x) / sr)
            cents.append(centroid(x, sr)); dcs.append(float(np.mean(x)))
            lufss.append(T.lufs(x) if len(x) > 0.4 * sr else float("nan"))
            if m["loop"]:
                seams.append(seam_metrics(x, sr))
            if np.max(np.abs(x)) >= 0.891:   # -1 dBFS
                problems.append(f"{rel}: peak {T.peak_db(x):.2f} dBFS > -1")
            if abs(np.mean(x)) > 0.002:
                problems.append(f"{rel}: DC offset {np.mean(x):.4f}")
        ch = "st" if x.ndim == 2 else "mono"
        row = dict(event=ev, cat=m["category"], n=len(m["files"]), ch=ch,
                   dur=float(np.mean(durs)), peak=max(peaks), rms=float(np.mean(rmss)),
                   lufs=float(np.nanmean(lufss)) if not np.all(np.isnan(lufss)) else float("nan"),
                   cent=float(np.mean(cents)), dc=float(np.mean(np.abs(dcs))),
                   loop=m["loop"],
                   seam_step=max(s[0] for s in seams) if seams else float("nan"),
                   seam_db=max(s[1] for s in seams) if seams else float("nan"),
                   seam_jump=max(s[2] for s in seams) if seams else float("nan"))
        if m["loop"] and (row["seam_jump"] > 1.5 or row["seam_db"] > 6.0):
            problems.append(f"{ev}: weak loop seam (jump {row['seam_jump']:.2f}, level diff {row['seam_db']:.1f} dB)")
        rows.append(row)
    hdr = f"{'event':26s} {'cat':9s} {'n':>2s} {'ch':>4s} {'dur_s':>6s} {'peak':>6s} {'rms':>6s} {'LUFS':>6s} {'centHz':>7s} {'dc':>7s} {'seamJump':>8s} {'seamdB':>6s}"
    lines = [hdr, "-" * len(hdr)]
    for r in rows:
        lines.append(f"{r['event']:26s} {r['cat']:9s} {r['n']:2d} {r['ch']:>4s} {r['dur']:6.2f} {r['peak']:6.1f} "
                     f"{r['rms']:6.1f} {r['lufs']:6.1f} {r['cent']:7.0f} {r['dc']:7.4f} "
                     f"{'' if not r['loop'] else format(r['seam_jump'], '8.2f'):>8s} "
                     f"{'' if not r['loop'] else format(r['seam_db'], '6.1f'):>6s}")
    if not quiet:
        print("\n".join(lines))
    print(f"\nevents: {len(rows)}   files: {sum(r['n'] for r in rows)}   total size: {total / 1e6:.1f} MB")
    print("peak ceiling check: max peak = %.2f dBFS" % max(r["peak"] for r in rows))
    if problems:
        print("\nPROBLEMS:")
        print("\n".join(problems))
    else:
        print("\nno problems flagged (peaks <= -1 dBFS, DC ok, loop seams ok)")
    os.makedirs(REPORTS, exist_ok=True)
    with open(os.path.join(REPORTS, "analysis.txt"), "w") as f:
        f.write("\n".join(lines) + f"\n\nevents: {len(rows)} total size: {total / 1e6:.1f} MB\n")
        f.write("\n".join(problems) + "\n")
    with open(os.path.join(REPORTS, "analysis.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    for ev in spec_events:
        if ev not in man:
            continue
        if zoom:
            spectrogram_png(os.path.join(ROOT, man[ev]["files"][0]), os.path.join(REPORTS, f"zoom_{ev}.png"), t0=zoom[0], t1=zoom[1])
        else:
            spectrogram_png(os.path.join(ROOT, man[ev]["files"][0]), os.path.join(REPORTS, f"spec_{ev}.png"))
    print(f"spectrograms for {len([e for e in spec_events if e in man])} events in {REPORTS}")


if __name__ == "__main__":
    main()
