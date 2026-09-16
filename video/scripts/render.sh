#!/bin/bash
# Renders the film in four chunks so a failure late in the job costs one
# chunk, not an hour. Chunks are concatenated losslessly at the end.
set -uo pipefail
cd "$(dirname "$0")/.."
FFMPEG=/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux
mkdir -p out/parts

render_chunk () {
  local name=$1 range=$2
  if [ -s "out/parts/$name.mp4" ]; then
    echo "[skip] $name already rendered"
    return 0
  fi
  echo "[start] $name  frames $range  $(date +%T)"
  npx remotion render StorageFilm "out/parts/$name.mp4" \
    --frames="$range" --concurrency=4 2>&1 | grep -E "Encoded (.*0|.*00)/|error|Error" | tail -3
  if [ ! -s "out/parts/$name.mp4" ]; then
    echo "[FAIL] $name produced no output"
    return 1
  fi
  echo "[done] $name  $(date +%T)  $(du -h "out/parts/$name.mp4" | cut -f1)"
}

render_chunk p1 0-6869      || exit 1
render_chunk p2 6870-12449  || exit 1
render_chunk p3 12450-18839 || exit 1
render_chunk p4 18840-28649 || exit 1

: > out/parts/list.txt
for p in p1 p2 p3 p4; do echo "file '$p.mp4'" >> out/parts/list.txt; done

echo "[concat] $(date +%T)"
"$FFMPEG" -y -f concat -safe 0 -i out/parts/list.txt -c copy out/storage-film.mp4 2>&1 | tail -2
echo "[complete] $(date +%T)"
"$FFMPEG" -i out/storage-film.mp4 2>&1 | grep -E "Duration|Stream #0:0"
ls -la out/storage-film.mp4
