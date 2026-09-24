"""مصنع المؤثرات الصوتية السينمائية.

Kenney تعطينا أصواتاً فيزيائية حقيقية (نقرات، ضربات، ورق). لكن ما ينقصها هو
"قواعد اللغة السينمائية": الووش، الرايزر، الصب-بوم، الشيمر… هذه نصنعها هنا
رياضياً، لأن ميزتها أنّ طولها وذروتها محسوبان بالعيّنة: الرايزر ينتهي تماماً
على فريم الضربة، والووش ذروته في منتصف حركة العنصر، لا تقريباً.

كل صوت = دالة تُرجع مصفوفة ستيريو (N, 2) بتردد 48kHz.
الاستخدام: python3 tools/synth_sfx.py
"""
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48_000
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx" / "synth"
rng = np.random.default_rng(7)


# ───────────── أدوات أساسية ─────────────
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur, color="white"):
    n = rng.standard_normal(int(dur * SR))
    if color == "pink":  # 1/f: أدفأ من الأبيض، يشبه الهواء الحقيقي
        f = np.fft.rfftfreq(n.size, 1 / SR)
        spec = np.fft.rfft(n) / np.sqrt(np.maximum(f, 20))
        n = np.fft.irfft(spec, n.size)
    return n / (np.abs(n).max() + 1e-9)


def sweep_bandpass(x, f_start, f_end, q=2.0, curve=1.0, blocks=256):
    """مرشّح تمرير نطاق يتحرّك تردّده عبر الزمن — قلب أيّ ووش."""
    out = np.zeros_like(x)
    n = x.size
    edges = np.linspace(0, n, blocks + 1).astype(int)
    zi = None
    for i in range(blocks):
        p = (i / (blocks - 1)) ** curve
        fc = f_start * (f_end / f_start) ** p  # حركة لوغاريتمية = كما تسمعها الأذن
        bw = fc / q
        lo, hi = max(fc - bw / 2, 20), min(fc + bw / 2, SR / 2 - 100)
        sos = signal.butter(2, [lo, hi], btype="band", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg, zi = signal.sosfilt(sos, x[edges[i]:edges[i + 1]], zi=zi)
        out[edges[i]:edges[i + 1]] = seg
    return out


def lowpass(x, fc, order=4):
    return signal.sosfilt(signal.butter(order, fc, fs=SR, output="sos"), x)


def highpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, btype="high", fs=SR, output="sos"), x)


def env_adsr(n, a, d=0.0, s=1.0, r=0.0):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sus = max(n - a - d - r, 0)
    e = np.concatenate([
        np.linspace(0, 1, a) ** 2,
        np.linspace(1, s, d),
        np.full(sus, s),
        np.linspace(s, 0, r) ** 1.5,
    ])
    return np.pad(e, (0, max(n - e.size, 0)))[:n]


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def pan(mono, positions):
    """positions: مصفوفة بطول الصوت من -1 (يسار) إلى 1 (يمين) — تحريك مكاني حقيقي."""
    theta = (positions + 1) * np.pi / 4
    return np.stack([mono * np.cos(theta), mono * np.sin(theta)], axis=1)


def stereo(mono, width=0.0):
    if width == 0:
        return np.stack([mono, mono], axis=1)
    d = int(0.012 * SR * width)  # تأخير هاس صغير يعطي عرضاً دون تشويه
    right = np.concatenate([np.zeros(d), mono[:-d]]) if d else mono
    return np.stack([mono, right], axis=1)


def reverb(st, decay=1.2, mix=0.25):
    """ريفيرب التفافي من استجابة نبضية مصنوعة (ضجيج يخمد) — يعطي الفضاء."""
    n = int(decay * SR)
    ir_l = rng.standard_normal(n) * exp_decay(n, decay / 5)
    ir_r = rng.standard_normal(n) * exp_decay(n, decay / 5)
    ir_l, ir_r = lowpass(ir_l, 7000), lowpass(ir_r, 7000)
    wet = np.stack([
        signal.fftconvolve(st[:, 0], ir_l)[: st.shape[0] + n],
        signal.fftconvolve(st[:, 1], ir_r)[: st.shape[0] + n],
    ], axis=1)
    wet /= np.abs(wet).max() + 1e-9
    dry = np.pad(st, ((0, n), (0, 0)))
    m = min(dry.shape[0], wet.shape[0])
    dry, wet = dry[:m], wet[:m]
    return dry * (1 - mix) + wet * mix * np.abs(st).max()


def reverse_tail(st):
    """ذيل الريفيرب معكوساً — "السحب" الشهير قبل الكلمة."""
    return st[::-1].copy()


def finish(st, peak_db=-1.0, fade_ms=4):
    st = np.nan_to_num(st)
    f = int(fade_ms * SR / 1000)
    st[:f] *= np.linspace(0, 1, f)[:, None]
    st[-f:] *= np.linspace(1, 0, f)[:, None]
    st = np.tanh(st * 1.2) / np.tanh(1.2)  # تشبّع ناعم: يلصق الطبقات ببعض
    return st / (np.abs(st).max() + 1e-9) * 10 ** (peak_db / 20)


# ───────────── المؤثرات ─────────────
def whoosh(dur=0.6, f0=250, f1=3500, direction=1):
    """ووش: ضجيج وردي بمرشّح يصعد + تحريك من جهة إلى أخرى. الذروة في المنتصف."""
    n = int(dur * SR)
    x = sweep_bandpass(noise(dur, "pink"), f0, f1, q=1.6)
    t = np.linspace(0, 1, n)
    e = np.sin(np.pi * t ** 0.8) ** 2
    return finish(pan(x * e, direction * np.linspace(-0.8, 0.8, n)), -3)


def swish_fast():
    """سويش خاطف لظهور كلمة: 180ms."""
    return whoosh(0.18, 900, 7000)


def riser(dur=2.0):
    """رايزر: ضجيج يصعد + نغمة Shepard تصعد + ارتفاع حجم أُسّي. ينتهي عند الذروة."""
    n = int(dur * SR)
    t = t_axis(dur)
    air = sweep_bandpass(noise(dur, "pink"), 200, 9000, q=1.2, curve=2.2)
    f = 110 * 2 ** (t / dur * 2)  # يصعد أوكتافين
    phase = 2 * np.pi * np.cumsum(f) / SR
    tone = sum(np.sin(phase * h) / h for h in (1, 2, 3, 5))
    tremolo = 1 + 0.35 * np.sin(2 * np.pi * np.cumsum(4 + 18 * (t / dur) ** 2) / SR)
    e = (t / dur) ** 3
    mono = (air * 0.7 + tone * 0.3 * tremolo) * e
    st = stereo(mono, 0.8)
    st[-int(0.004 * SR):] = 0  # قطع حادّ: الصمت اللحظي قبل الضربة هو ما يصنع الضربة
    return finish(st, -2, fade_ms=1)


def sub_boom(dur=2.2):
    """صب-بوم: جيب 55→28Hz مع ترانزينت. تحسّه في الصدر أكثر مما تسمعه."""
    n = int(dur * SR)
    t = t_axis(dur)
    f = 28 + 40 * np.exp(-t * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_decay(n, 0.55)
    click = lowpass(noise(dur), 2500) * exp_decay(n, 0.012)
    return finish(stereo(body + click * 0.5), -1)


def impact_cinematic():
    """ضربة عنوان: صب + جسم متوسّط + ضجيج مقصوص + ريفيرب قاعة."""
    dur = 1.8
    n = int(dur * SR)
    t = t_axis(dur)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t * 14)) / SR) * exp_decay(n, 0.5)
    mid = lowpass(noise(dur), 1800) * exp_decay(n, 0.08)
    crack = highpass(noise(dur), 3000) * exp_decay(n, 0.015)
    st = stereo(sub * 1.0 + mid * 0.6 + crack * 0.35, 0.5)
    return finish(reverb(st, 2.4, 0.3), -0.5)


def reverse_swell(dur=1.2):
    """سحب معكوس: ذيل ريفيرب لضربة، مقلوب. يوضع قبل الكلمة فينتهي عندها."""
    n = int(0.25 * SR)
    hit = lowpass(noise(0.25), 5000) * exp_decay(n, 0.05)
    tail = reverb(stereo(hit, 0.6), dur, 0.9)
    return finish(reverse_tail(tail), -3, fade_ms=2)


def shimmer(dur=1.6):
    """بريق: جزيئات جيبية عالية عشوائية تخمد — للّمعان والكشف الأنيق."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for _ in range(38):
        start = int(rng.uniform(0, 0.6) * SR)
        f = rng.choice([1760, 2093, 2349, 2637, 3136, 3520, 4186]) * rng.uniform(0.995, 1.005)
        ln = n - start
        tone = np.sin(2 * np.pi * f * np.arange(ln) / SR) * exp_decay(ln, rng.uniform(0.08, 0.4))
        p = rng.uniform(-1, 1)
        out[start:] += pan(tone * rng.uniform(0.2, 0.6), np.full(ln, p))
    return finish(reverb(out, 1.4, 0.35), -6)


def pen_scribble(dur=0.9):
    """خربشة قلم على ورق مربّعات: ضجيج نطاقي بنبضات غير منتظمة (ضربات القلم)."""
    n = int(dur * SR)
    x = signal.sosfilt(signal.butter(2, [1800, 6500], btype="band", fs=SR, output="sos"), noise(dur))
    strokes = np.zeros(n)
    pos = 0
    while pos < n:
        ln = int(rng.uniform(0.05, 0.14) * SR)
        seg = np.sin(np.linspace(0, np.pi, min(ln, n - pos))) * rng.uniform(0.5, 1)
        strokes[pos:pos + seg.size] = seg
        pos += ln + int(rng.uniform(0.005, 0.03) * SR)
    grain = 1 + 0.6 * lowpass(noise(dur), 60)  # خشونة الورق
    return finish(stereo(x * strokes * grain, 0.2), -8)


def type_key(i):
    """ضغطة مفتاح آلة كاتبة: ترانزينت + رنّين معدني قصير. نولّد نسخاً مختلفة لتجنّب التكرار الآلي."""
    dur = 0.09
    n = int(dur * SR)
    click = highpass(noise(dur), 2000) * exp_decay(n, 0.004)
    body = np.sin(2 * np.pi * rng.uniform(180, 260) * t_axis(dur)) * exp_decay(n, 0.015)
    ping = np.sin(2 * np.pi * rng.uniform(2400, 3200) * t_axis(dur)) * exp_decay(n, 0.02) * 0.15
    return finish(stereo(click + body * 0.6 + ping), -6 - rng.uniform(0, 3), fade_ms=1)


def bubble(f0=350, f1=1400, dur=0.12):
    """فقاعة/قطرة: جيب يصعد بسرعة (هذا فعلاً صوت فقاعة رنّانة في الماء — رنين مينارت)."""
    n = int(dur * SR)
    t = t_axis(dur)
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_decay(n, dur / 3)
    return finish(stereo(s, 0.3), -4, fade_ms=1)


def water_drop():
    return finish(reverb(bubble(500, 1900, 0.09), 0.8, 0.3), -4)


def fluid_flow(dur=2.5):
    """جريان مائع: فقاعات كثيرة عشوائية فوق ضجيج منخفض — لموضوع الموائع."""
    n = int(dur * SR)
    bed = lowpass(noise(dur, "pink"), 900) * 0.25
    out = stereo(bed * env_adsr(n, 0.4, 0, 1, 0.8), 0.6)
    for _ in range(60):
        b = bubble(rng.uniform(200, 700), rng.uniform(800, 2500), rng.uniform(0.04, 0.12)) * rng.uniform(0.1, 0.45)
        s = int(rng.uniform(0, dur - 0.15) * SR)
        p = rng.uniform(-0.9, 0.9)
        out[s:s + b.shape[0]] += b * np.array([np.cos((p + 1) * np.pi / 4), np.sin((p + 1) * np.pi / 4)])
    return finish(out, -4)


def pop():
    """بوب: نقطة ظهور لطيفة — جيب ينزل بسرعة."""
    dur = 0.1
    n = int(dur * SR)
    t = t_axis(dur)
    s = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 40) + 180) / SR) * exp_decay(n, 0.025)
    return finish(stereo(s), -4, fade_ms=1)


def glitch(dur=0.35):
    """غلتش: ضجيج مكسور البِت + قطع عشوائية + نغمة رقمية."""
    n = int(dur * SR)
    x = noise(dur)
    x = np.round(x * 4) / 4  # bitcrush
    hold = int(SR / 3000)
    x = np.repeat(x[::hold], hold)[:n]  # sample-rate reduction
    gate = np.repeat(rng.random(n // 800 + 1) > 0.35, 800)[:n]
    tone = signal.square(2 * np.pi * rng.choice([440, 880, 1320]) * t_axis(dur)) * 0.3
    return finish(pan((x + tone) * gate, np.sign(rng.standard_normal(n // 2400 + 1)).repeat(2400)[:n] * 0.6), -6)


def tape_stop(dur=0.7):
    """توقّف الشريط: نغمة تهبط للصفر — للتوقّف الدرامي أو 'انتظر لحظة'."""
    n = int(dur * SR)
    t = t_axis(dur)
    f = 220 * (1 - t / dur) ** 2
    s = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (1 - t / dur)
    return finish(stereo(lowpass(s, 2500)), -5)


def paper_slide(dur=0.5):
    """انزلاق ورقة: ضجيج نطاقي ناعم يمرّ — للانتقال بين 'صفحات' الدفتر."""
    n = int(dur * SR)
    x = sweep_bandpass(noise(dur), 1500, 5000, q=0.8)
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return finish(pan(x * e, np.linspace(0.7, -0.7, n)), -7)


def camera_shutter():
    """غالق كاميرا: نقرتان ميكانيكيتان — للقطة الشاشة/التجميد."""
    dur = 0.25
    out = np.zeros(int(dur * SR))
    for at, amp in ((0.0, 1.0), (0.085, 0.7)):
        n = int(0.05 * SR)
        c = highpass(noise(0.05), 1200) * exp_decay(n, 0.006) * amp
        s = int(at * SR)
        out[s:s + n] += c
    return finish(stereo(out, 0.2), -4, fade_ms=1)


def ui_hum(dur=3.0):
    """همهمة واجهة: طنين إلكتروني خفيف يعطي الشاشة 'حياة' تحت التسجيل."""
    t = t_axis(dur)
    n = t.size
    s = (np.sin(2 * np.pi * 60 * t) * 0.3 + np.sin(2 * np.pi * 120 * t) * 0.15
         + lowpass(noise(dur, "pink"), 400) * 0.2)
    return finish(stereo(s * env_adsr(n, 0.5, 0, 1, 0.8), 0.5), -14)


def drone(dur=6.0, root=55):
    """بساط صوتي (Drone): طبقة جوّ تحت المشهد — تعطيه ثقلاً دون أن تُلاحظ."""
    t = t_axis(dur)
    n = t.size
    s = np.zeros(n)
    for ratio, amp in ((1, 1), (1.5, 0.5), (2, 0.35), (3, 0.12)):
        detune = 1 + 0.002 * np.sin(2 * np.pi * 0.1 * ratio * t)
        s += amp * np.sin(2 * np.pi * root * ratio * np.cumsum(detune) / SR)
    s = lowpass(s + lowpass(noise(dur, "pink"), 300) * 0.2, 1200)
    return finish(reverb(stereo(s * env_adsr(n, 1.5, 0, 1, 2.0), 0.9), 2.5, 0.3), -10)


def chalk_scrape(dur=0.7):
    """طبشور على سبورة: ضجيج خشن نطاقه أعلى من القلم مع "صرير" خفيف متقطّع."""
    n = int(dur * SR)
    x = signal.sosfilt(signal.butter(2, [900, 4200], btype="band", fs=SR, output="sos"), noise(dur))
    grit = (rng.random(n) > 0.55).astype(float)
    grit = lowpass(grit, 900)
    squeak = np.sin(2 * np.pi * np.cumsum(2600 + 300 * np.sin(np.linspace(0, 9, n))) / SR) * 0.06
    e = env_adsr(n, 0.02, 0.1, 0.8, 0.12)
    return finish(stereo((x * (0.5 + grit) + squeak) * e, 0.2), -8)


EFFECTS = {
    "chalk_scrape": chalk_scrape,
    "drone_g": lambda: drone(8.0, 49.0),
    "drone_e": lambda: drone(8.0, 41.2),
    "drone_c": lambda: drone(8.0, 65.4),
    "whoosh_short": lambda: whoosh(0.35, 400, 5000),
    "whoosh_medium": lambda: whoosh(0.7),
    "whoosh_long": lambda: whoosh(1.2, 150, 2500),
    "whoosh_reverse_dir": lambda: whoosh(0.6, 300, 4000, -1),
    "swish": swish_fast,
    "riser_1s": lambda: riser(1.0),
    "riser_2s": lambda: riser(2.0),
    "sub_boom": sub_boom,
    "impact_cinematic": impact_cinematic,
    "reverse_swell": reverse_swell,
    "shimmer": shimmer,
    "pen_scribble": pen_scribble,
    "water_drop": water_drop,
    "fluid_flow": fluid_flow,
    "pop": pop,
    "glitch": glitch,
    "tape_stop": tape_stop,
    "paper_slide": paper_slide,
    "camera_shutter": camera_shutter,
    "ui_hum": ui_hum,
    "drone": drone,
    **{f"type_key_{i}": (lambda i=i: type_key(i)) for i in range(8)},
    **{f"bubble_{i}": (lambda: bubble(rng.uniform(250, 500), rng.uniform(900, 2000), rng.uniform(0.06, 0.12))) for i in range(4)},
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in EFFECTS.items():
        audio = fn()
        sf.write(OUT / f"{name}.wav", audio.astype(np.float32), SR, subtype="PCM_16")
        print(f"✓ {name:20s} {audio.shape[0] / SR:5.2f}s")
