#!/bin/bash
# Cuts the finished film into transferable parts. Remotion's ffmpeg is built
# with --disable-muxers and has no segment muxer, and a stream copy would snap
# every cut to the nearest keyframe — so each part is re-encoded with an exact
# frame boundary. The parts rejoin losslessly with no drift.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/deliver
SEG=107
TOTAL=956
i=0
for start in $(seq 0 $SEG $((TOTAL - 1))); do
  i=$((i + 1))
  out=$(printf "out/deliver/part-%02d.mp4" "$i")
  echo "[part $i] ${start}s +${SEG}s"
  npx remotion ffmpeg -y -ss "$start" -i out/storage-film.mp4 -t "$SEG" \
    -an -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
    -movflags +faststart "$out" 2>&1 | tail -1
done
ls -lh out/deliver/
