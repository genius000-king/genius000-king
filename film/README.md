# Identity film (30 s, motion-design showcase)

Deterministic renderer for a 30.000 s visual-identity film. Every frame is a pure function of film
time `t`: no wall-clock input, seeded randomness only.

- `index.html` + `src/film.js`: the scene. `window.renderFrame(t)` draws one film-time instant.
  A three.js (WebGL) layer holds the painterly 3D forms; a Canvas2D layer holds the mist background,
  Arabic/English typography (IBM Plex Sans Arabic, Space Grotesk, real shaped text with clip reveals),
  line and arc accents, and grain. Temporal supersampling averages `SUB` sub-frames inside the shutter.
- `render.mjs`: serves the page, drives Chromium (Playwright, `/opt/pw-browsers/chromium`) in parallel
  workers, writes PNG frames, and encodes with ffmpeg (libx264, yuv420p, CRF 16, AAC 192k).
- `audio/make_audio.py`: builds the 30.000 s mix. VO (`audio/vo_source.mp3`) is placed at 1.5 s and
  loudness-normalised; a synthesized pad bed, quiet event-synced shimmer SFX, and ducking (about -4 dB
  under speech) are added. Writes `out/audio_mix.wav`.

## Re-render

```sh
cd film
npm install                      # three, @fontsource fonts, playwright-core (no browser download)
python3 audio/make_audio.py      # -> out/audio_mix.wav
node render.mjs --w 1920 --h 1080 --fps 60 --sub 4 --workers 4 --encode   # -> out/identity_1080p60.mp4
```

Quick preview (low-res, selected times, PNG output to `out/preview/`):

```sh
node render.mjs --preview --w 640 --h 360 --fps 30 --sub 2 --times 1,3,7,12,17,22,28,29.9
```

4K (same pipeline, about four times the pixels; frames are large, so allow several GB of disk):

```sh
node render.mjs --w 3840 --h 2160 --fps 60 --sub 4 --workers 4 --encode --name identity_2160p60.mp4
```

Frames are cached in `out/frames_<W>x<H>_<FPS>/`; re-running skips frames that already exist.
Output lands in `out/` (the 1080p60 MP4 is committed; frames and WAVs are git-ignored).

## Timeline

| film s | scene |
|---|---|
| 0.0-5.0 | ivory; a soft-blue line forms and expands into a painterly 3D form; "الهوية" |
| 5.0-10.0 | the form morphs through cloud, twisted sculpture and rounded-cube forms |
| 10.0-15.0 | palette transition; five sculptural objects in Soft Blue, Dusty Blue, Powder Mist, Mist Gray, Warm Ivory |
| 15.0-20.0 | forms collapse to lines; Arabic headlines with English support and delicate ring/line accents |
| 20.0-26.0 | 3D form -> video title card ("الفن") -> website layout ("التقنية") -> motion graphic ("البساطة") |
| 26.0-30.0 | signature form beside "الهوية" in a settled, still final frame |
