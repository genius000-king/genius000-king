# Genius Motion — 10 Remotion pieces

Ten short motion-graphics videos (1920×1080, 30 fps). Each has its own visual identity, and each one is about a real idea from maths, physics or computing.

| # | Composition | Length | Style | Idea |
|---|---|---|---|---|
| 01 | `01-Euler` | 15 s | Swiss / Bauhaus poster | e^{iπ} + 1 = 0: a point walks half the unit circle |
| 02 | `02-Fourier` | 20 s | Deep-space neon | 80 rotating circles (a DFT) draw the symbol π |
| 03 | `03-Terminal` | 15 s | Green-phosphor CRT + glitch | Boot log for a tracking-free machine → "OWN YOUR STACK" |
| 04 | `04-Neural` | 12 s | Editorial minimalism | A network assembles and signals propagate. "Don't just use it. Understand it." |
| 05 | `05-Lorenz` | 15 s | Dark scientific | Two Lorenz trajectories 0.00001 apart diverge (real RK4 integration) |
| 06 | `06-Manifesto` | 10 s | Arabic brutalist kinetic type | لا تكن مستهلكاً للمعرفة — كن صانعاً للأنظمة |
| 07 | `07-Pendulums` | 20 s | Soft Scandinavian pastel | 15-pendulum wave that realigns exactly at t = 20 s |
| 08 | `08-Synthwave` | 12 s | 1986 synthwave / VHS | Neon grid, striped sun, chrome title |
| 09 | `09-Life` | 15 s | 8-bit pixel | Conway's Game of Life: glider gun + R-pentomino + acorn |
| 10 | `10-Golden` | 15 s | Black & gold luxury | Sunflower phyllotaxis: nudge 137.508° and order breaks |

## Run

```bash
npm install
npm run studio        # live preview / scrub in the browser
npm run render:all    # renders every piece to out/<id>.mp4
node render-all.mjs 06 10          # render only some
node scripts/stills.mjs 01-Euler:200,340   # quick QA stills
```

The fonts are self-hosted in `public/fonts`, so renders work offline. To re-download them, run `scripts/fetch-fonts.sh`.

## Why everything is a pure function of `frame`

Remotion renders frames in parallel and in any order. So nothing depends on the previous frame. Randomness uses `random(seed)`. Simulations (Lorenz, Game of Life, Fourier) are precomputed in `useMemo`, and each frame just indexes into the result.
