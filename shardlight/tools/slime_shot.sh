#!/bin/bash
# tools/slime_shot.sh <state> <out.png> [at_seconds] [extra args]
cd "$(dirname "$0")/../game"
ST=$1; OUT=$(realpath -m "$2"); AT=${3:-3.5}; shift 3 2>/dev/null
timeout 600 xvfb-run -a -s "-screen 0 ${RES:-960x540}x24" godot --path . --resolution ${RES:-960x540} res://scenes/dev/slime_lab.tscn -- --state=$ST --out=$OUT --at=$AT "$@" 2>&1 | grep -E "SHOT|SCRIPT ERROR|ERROR:|at: res" | grep -v -E "ALSA|status < 0" | head -20
