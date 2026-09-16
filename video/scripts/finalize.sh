#!/bin/bash
# Concatenates the rendered chunks. Uses Remotion's own bundled ffmpeg — the
# Playwright build on this machine ships with its demuxers disabled and cannot
# even open an mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
: > out/parts/list.txt
for p in p1 p2 p3 p4; do
  [ -s "out/parts/$p.mp4" ] || { echo "missing out/parts/$p.mp4"; exit 1; }
  echo "file '$p.mp4'" >> out/parts/list.txt
done
npx remotion ffmpeg -y -f concat -safe 0 -i out/parts/list.txt -c copy out/storage-film.mp4
npx remotion ffprobe out/storage-film.mp4 2>&1 | grep -E "Duration|Stream #0:0"
ls -lh out/storage-film.mp4
