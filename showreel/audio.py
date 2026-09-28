"""موسيقى الريل — مولَّدة بالكود، 120 نبضة/د، متزامنة مع قصّات الفيديو.
تشغيل:  python3 audio.py  ->  reel_audio.wav
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR, DUR, BPM = 44100, 15.0, 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)
dry = np.zeros((N, 2)); wet = np.zeros((N, 2))          # ناقل جاف + ناقل صدى


def t_(d): return np.arange(int(SR * d)) / SR
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, b], 'band', fs=SR, output='sos'), x)


def put(sig, at, gain=1.0, pan=0.0, send=0.0):
    i = int(at * SR)
    if i >= N or i < 0: return
    s = sig[:N - i]
    l, r = gain * np.cos((pan + 1) * np.pi / 4), gain * np.sin((pan + 1) * np.pi / 4)
    dry[i:i + len(s), 0] += s * l; dry[i:i + len(s), 1] += s * r
    if send: wet[i:i + len(s), 0] += s * l * send; wet[i:i + len(s), 1] += s * r * send


# ---------- أصوات ----------
def kick(d=.5):
    t = t_(d); f = 46 + 120 * np.exp(-t * 32); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(1.6 * np.sin(ph) * np.exp(-t * 7.5)) + .25 * rng.standard_normal(len(t)) * np.exp(-t * 400)

def clap():
    out = np.zeros(int(SR * .35))
    for k, off in enumerate([0, .011, .023, .037]):
        n = bp(rng.standard_normal(len(out)), 900, 6500); i = int(off * SR); e = np.exp(-t_(.35) * (60 if k < 3 else 16))
        out[i:] += (n * e)[:len(out) - i] * (.5 if k < 3 else 1)
    return out * .9

def hat(open_=False):
    d = .28 if open_ else .06; t = t_(d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (16 if open_ else 70)) * .5

def bass(f, d):
    t = t_(d); s = signal.sawtooth(2 * np.pi * f * t) * .6 + np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2 * t)
    e = np.minimum(1, t * 80) * np.minimum(1, (d - t) * 30)
    return np.tanh(1.8 * lp(s, 420)) * e

def pluck(f, d=.9, bright=1.0):
    t = t_(d); s = sum(a * np.sin(2 * np.pi * f * k * t + .3 * k) * np.exp(-t * (5 + 7 * k)) for k, a in enumerate([1, .5 * bright, .3 * bright, .18 * bright, .1 * bright], 1))
    return s * np.minimum(1, t * 400)

def bell(f, d=2.6):
    t = t_(d); s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + .3 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return s * np.minimum(1, t * 300)

def whoosh(d, up=True, lo=300, hi=9000):
    t = t_(d); n = rng.standard_normal(len(t)); out = np.zeros_like(n); nb = 24
    edges = np.geomspace(lo, hi, nb + 1)
    for k in range(nb):
        a, b = edges[k], edges[k + 1]; band = bp(n, a, min(b * 1.4, SR / 2 - 100), 1)
        c = (k + .5) / nb; center = (t / d) if up else (1 - t / d)
        out += band * np.exp(-((center - c) ** 2) / .035)
    env = (t / d) ** 1.6 if up else (1 - t / d) ** 1.6
    return out * env * 1.6

def boom(d=1.6, f0=42):
    t = t_(d); f = f0 + 90 * np.exp(-t * 9); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(2 * np.sin(ph)) * np.exp(-t * 2.4) + lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 7) * .6

def crash(d=2.2):
    t = t_(d); return hp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 2.4) * .6

def tick(f=2200, d=.05):
    t = t_(d); return np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * .6

def saw_riser(d, f0, f1):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return lp(signal.sawtooth(ph), 6000) * (t / d) ** 2 * .35


# ---------- بناء الأغنية ----------
bar_notes = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [60, 64, 67]), (43, [55, 59, 62])]   # Am F C G

# افتتاح: تصاعد ثم ضربة العنوان عند 0.5
put(whoosh(.5, True, 400, 12000), 0, .55, send=.3)
put(saw_riser(.5, 80, 900), 0, .5)
put(boom(2.2), .5, 1.0, send=.25); put(crash(2.0), .5, .5, send=.5)

# الطبل
k = 1
while k * BEAT < 12.5 - 1e-6:
    at = k * BEAT
    put(kick(), at, .95)
    if 4.5 <= at < 12.5 and k % 2 == 1: put(clap(), at, .55, send=.35)
    k += 1
for h in np.arange(2.25, 12.5, BEAT):   # هاي-هات على الأنصاف
    put(hat(), h, .55, pan=.25)
for h in np.arange(7.5, 12.5, BEAT / 2):   # 16ثيّات من مشهد الواجهة
    put(hat(), h + BEAT / 4, .32, pan=-.3)
for h in np.arange(4.5, 12.5, BEAT * 4):  # هاي-هات مفتوح
    put(hat(True), h + BEAT * 1.5, .5, pan=.2)

# باص + باد (دعم من 2.0) مع "سايدتشين" على النبضة
t_all = np.arange(N) / SR
duck = np.ones(N)
m = t_all >= .5
ph = (t_all[m] - .5) % BEAT
duck[m] = 1 - .85 * np.exp(-ph * 11)
bassbus = np.zeros(N); padbus = np.zeros(N)
for bar in range(int(DUR // 2)):
    st = bar * 2.0
    if st < 2.0 - 1e-6 or st >= 12.5: continue
    root, chord = bar_notes[bar % 4]
    for q in range(8):
        at = st + q * BEAT / 2
        if q in (0, 3, 4, 6, 7):
            f = midi(root) * (2 if q in (3, 7) else 1)
            s = bass(f, BEAT * .48); i = int(at * SR); bassbus[i:i + len(s)] += s[:N - i] * .55
    for n in chord:
        for det in (-.07, 0, .07):
            f = midi(n) * 2 ** (det / 12); d = 2.0; t = t_(d)
            s = signal.sawtooth(2 * np.pi * f * t) * .12 * np.minimum(1, t * 3) * np.minimum(1, (d - t) * 6)
            i = int(st * SR); padbus[i:i + len(s)] += lp(s, 1800)[:N - i]
dry[:, 0] += bassbus * duck + padbus * duck * .5; dry[:, 1] += bassbus * duck + padbus * duck * .5
wet[:, 0] += padbus * duck * .3; wet[:, 1] += padbus * duck * .3

# مشهد الطباعة الحركية: كل كلمة + وترة
for k_, n in enumerate([69, 72, 76, 79, 81]):
    at = 2.0 + k_ * .5
    put(pluck(midi(n), .8, 1.3), at, .55, pan=(k_ - 2) * .25, send=.3); put(pluck(midi(n - 12), .8), at, .4)
    put(tick(900, .09), at, .5)

# مشهد الرياضيات: أربيجيو 16ثيّات مع صدى منقّط
pent = [69, 72, 76, 79, 81, 76, 72, 79]
step = BEAT / 2
for k_, at in enumerate(np.arange(4.5, 7.5, step)):
    n = pent[k_ % 8] + (12 if (k_ // 8) % 2 else 0)
    put(pluck(midi(n), .5), at, .32, pan=np.sin(k_ * .8) * .6, send=.35)
    put(pluck(midi(n), .5), at + step * 1.5, .12, pan=-np.sin(k_ * .8) * .6, send=.3)

# مشهد الواجهة: أصوات UI
for k_ in range(10): put(tick(1500 + k_ * 180), 7.5 + .7 + k_ * .045, .5, pan=.4 - k_ * .08)
put(tick(2800, .1), 7.5 + 1.0, .5)
put(pluck(midi(84), .5), 7.5 + 1.95, .6, send=.4); put(clap(), 7.5 + 1.95, .5, send=.4)      # نقرة الزر
for k_ in range(14): put(tick(2200 + rng.integers(0, 2600), .04), 7.5 + 1.97 + k_ * .022, .25, pan=rng.uniform(-.8, .8))   # كونفيتي
put(whoosh(.4, True, 600, 9000), 7.5 + 1.1, .22, send=.2)

# مشهد ثلاثي الأبعاد: شبكة صوتية عميقة
d3 = t_(2.5); f3 = 55 * (1 + .5 * np.sin(2 * np.pi * .8 * d3)); drone = np.sin(2 * np.pi * np.cumsum(f3) / SR) * np.minimum(1, d3 * 3) * .28
put(drone, 10, 1.0)
for k_, n in enumerate([57, 64, 69, 72, 76]): put(bell(midi(n + 12), 2.0), 10.05 + k_ * .32, .22, pan=(k_ - 2) * .35, send=.6)

# انتقالات: whoosh قبل + ضربة عند القصّ
for T0, kind in [(2.0, 'up'), (4.5, 'up'), (7.5, 'up'), (10.0, 'glitch'), (12.5, 'up')]:
    put(whoosh(.28, True, 500, 11000), T0 - .28, .6, send=.25)
    put(boom(1.0, 48), T0, .7, send=.15); put(crash(1.2), T0, .32, send=.35)
    if kind == 'glitch':
        for k_ in range(12):
            g = np.round(hp(rng.standard_normal(int(SR * .02)), 1200) * 4) / 4
            put(g, T0 - .07 + k_ * .012, .35, pan=rng.uniform(-1, 1))

# ختام: تجمّع الجسيمات → ضربة العنوان → أجراس
d = 1.0
put(whoosh(d, True, 200, 14000), 12.5, .5, send=.3); put(saw_riser(d, 90, 1400), 12.5, .6)
# طبلة سنير متسارعة
for at in np.arange(12.5, 13.0, BEAT / 4): put(clap(), at, .32 * (1 + (at - 12.5)), send=.15)
for at in np.arange(13.0, 13.5, BEAT / 8): put(clap(), at, .5 * (1 + (at - 13)), send=.15)
put(boom(3.0, 38), 13.5, 1.15, send=.3); put(kick(), 13.5, 1.0); put(crash(2.5), 13.5, .8, send=.6)
for k_, n in enumerate([57, 64, 69, 72, 76, 81, 76, 72]):
    put(bell(midi(n + 12), 2.4), 13.55 + k_ * .11, .28, pan=np.sin(k_) * .7, send=.7)
put(bell(midi(93), 3.0), 14.3, .3, send=.8)

# ---------- صدى + ماستر ----------
irn = int(SR * 2.4); tt = np.arange(irn) / SR
ir = np.stack([rng.standard_normal(irn) * np.exp(-tt * 2.3) for _ in range(2)], 1)
ir = lp(ir.T, 7000).T
rev = np.stack([signal.fftconvolve(wet[:, c], ir[:, c])[:N] for c in range(2)], 1) * .07
mix = dry + rev
mix = np.tanh(mix * .9)
fade = np.ones(N); fi = int(.05 * SR); fo = int(.5 * SR); fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade[:, None]
mix = hp(mix.T, 28, 1).T
mix *= .89 / np.abs(mix).max()
wavfile.write('reel_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok', mix.shape, 'peak', np.abs(mix).max())
