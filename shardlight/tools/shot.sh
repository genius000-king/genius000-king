#!/bin/bash
# Usage: tools/shot.sh <out.png> <world> <x,y,z> <yaw> <pitch> [wait] [extra args...]
# Renders the game on software Vulkan (lavapipe) under Xvfb and saves a screenshot.
OUT=$(realpath -m "$1"); WORLD=$2; POS=$3; YAW=$4; PITCH=$5; WAIT=${6:-8}; shift 6 2>/dev/null
cd "$(dirname "$0")/../game"
timeout 900 xvfb-run -a -s "-screen 0 ${RES:-1600x900}x24" godot --path . --resolution ${RES:-1600x900} -- \
  --world=$WORLD --pos=$POS --yaw=$YAW --pitch=$PITCH --ground=1 --wait=$WAIT --shot=$OUT "$@" 2>&1 \
  | grep -vE "ALSA|audio driver|dummy driver|^\s*$|init_output_device|at: initialize|at: init_output" | tail -40
