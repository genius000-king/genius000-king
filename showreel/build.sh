#!/usr/bin/env bash
# Assemble frames + score into the final MP4.
#   usage: ./build.sh <frames_dir> [out.mp4]
# needs: ffmpeg (>= 5) on PATH or FFMPEG=/path/to/ffmpeg
set -euo pipefail
FRAMES=${1:?frames dir}; OUT=${2:-out/showreel.mp4}; FF=${FFMPEG:-ffmpeg}
mkdir -p "$(dirname "$OUT")"
# JPEG frames are full-range BT.601 sRGB → convert explicitly to limited-range BT.709 so every player shows the same colours
$FF -y -hide_banner -framerate 60 -i "$FRAMES/frame_%05d.jpg" -i audio.wav \
  -vf "scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -preset slow -crf 19 -maxrate 16M -bufsize 32M -profile:v high -level 4.2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 44100 -movflags +faststart -t 30 "$OUT"
