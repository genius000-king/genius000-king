#!/usr/bin/env bash
# Usage: ./render.sh [preview|final] [--fog]
# Needs Blender 4.2+ (tested on 4.5 LTS) in PATH or $BLENDER, plus ffmpeg and Pillow (with libraqm for Arabic).
set -euo pipefail
cd "$(dirname "$0")"
BLENDER=${BLENDER:-blender}
Q=${1:-preview}; shift || true
python3 make_textures.py
"$BLENDER" -b -P build_scene.py -- --quality "$Q" "$@"
rm -rf render && "$BLENDER" -b cinematic_desk.blend -a
ffmpeg -y -loglevel error -framerate 24 -i render/frame_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 "montage_$Q.mp4"
echo "done -> montage_$Q.mp4"
