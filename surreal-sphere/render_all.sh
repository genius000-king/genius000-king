#!/bin/bash
# Renders the 30 s film in 4 segments (robust to interruption), then joins them.
set -e
cd "$(dirname "$0")"
OUT=${OUT:-out}
mkdir -p "$OUT"
SEGS=(0 150 300 450 600 750 900)
for i in 0 1 2 3 4 5; do
  f="$OUT/seg_$i.mp4"
  [ -s "$f" ] && { echo "skip $f"; continue; }
  QS="iw=1280&ih=720" node render.mjs video "$f.part.mp4" ${SEGS[$i]} ${SEGS[$((i+1))]} 14
  mv "$f.part.mp4" "$f"
done
printf "file 'seg_%d.mp4'\n" 0 1 2 3 4 5 > "$OUT/segs.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/segs.txt" -c copy "$OUT/video_noaudio.mp4"
echo DONE
