#!/bin/sh
# usage: ./run.sh [regex]   -> regenerates matching assets (glb + previews + cel previews); no arg = whole pack + manifest
cd "$(dirname "$0")"
ONLY="$1" blender -b --factory-startup --python verdant_flora.py 2>&1 | grep -iE "error|Traceback|warn.*budget|^\s+File|\[" | tail -${TAILN:-15}
python3 compose_cel.py "$1" >/dev/null
