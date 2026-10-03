#!/bin/bash
LAB=${LAB_DIR:-/tmp/saraat-lab}
[ -f "$LAB/engine.pid" ] && kill "$(cat "$LAB/engine.pid")" 2>/dev/null
rm -f "$LAB/engine.pid"
sleep 0.5
