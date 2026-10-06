#!/bin/bash
# Full pipeline: render video (≈1.5–2.5 h on CPU), synthesise the soundtrack, mux to a YouTube-ready 720p MP4.
set -e
cd "$(dirname "$0")"
OUT=${OUT:-out}
[ -d node_modules/three ] || npm install --no-audit --no-fund
OUT=$OUT ./render_all.sh
python3 music.py "$OUT/music.wav"
ffmpeg -y -loglevel error -i "$OUT/video_noaudio.mp4" -i "$OUT/music.wav" -c:v copy -c:a aac -b:a 256k -ar 48000 \
  -shortest -movflags +faststart "$OUT/surreal-sphere-720p.mp4"
echo "→ $OUT/surreal-sphere-720p.mp4"
