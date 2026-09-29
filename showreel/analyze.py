import numpy as np, sys
from scipy.io import wavfile
import scipy.signal as sg
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
sr, x = wavfile.read('audio.wav'); x = x.astype(np.float32) / 32768
m = x.mean(1)
print('samples', len(x), 'dur', len(x)/sr, 'peak', np.abs(x).max().round(3), 'NaN', np.isnan(x).any(), 'DC', m.mean().round(5))
print('clipped samples (>0.99):', int((np.abs(x) > 0.99).sum()))
hop = sr // 2
rows = []
for i in range(0, len(m) - hop + 1, hop):
    seg = m[i:i+hop]; rms = np.sqrt((seg**2).mean()) + 1e-9
    f, P = sg.welch(seg, sr, nperseg=2048)
    cen = (f * P).sum() / (P.sum() + 1e-12)
    lo = P[f < 150].sum() / (P.sum() + 1e-12)
    rows.append((i / sr, 20 * np.log10(rms), cen, lo))
print(' t(s)   RMS dB  centroid(Hz)  sub<150Hz%')
for t, r, c, lo in rows: print(f'{t:5.1f}  {r:7.1f}  {c:8.0f}   {lo*100:5.1f}')
f, t, S = sg.spectrogram(m, sr, nperseg=2048, noverlap=1536)
fig, ax = plt.subplots(2, 1, figsize=(16, 8), gridspec_kw={'height_ratios': [3, 1]})
ax[0].pcolormesh(t, f, 10 * np.log10(S + 1e-12), shading='auto', vmin=-110, vmax=-30, cmap='magma'); ax[0].set_yscale('symlog', linthresh=200); ax[0].set_ylim(30, 16000)
for tb in np.arange(0, 30.01, 3.75): ax[0].axvline(tb, color='cyan', lw=.6, alpha=.6)
ax[1].plot(np.arange(len(m)) / sr, m, lw=.3); ax[1].set_xlim(0, 30); ax[0].set_xlim(0, 30)
for tb in np.arange(0, 30.01, 3.75): ax[1].axvline(tb, color='r', lw=.6)
plt.tight_layout(); plt.savefig('/tmp/claude-0/-home-user-genius000-king/345c14e9-0a3f-5cb2-8d3b-3ce91d57b8a7/scratchpad/preview/audio_spec.png', dpi=70)
