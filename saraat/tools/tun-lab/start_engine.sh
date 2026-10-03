#!/bin/bash
# start_engine.sh <down_kbps> <up_kbps> [seconds] [block_quic] -> prints PID; log in $LAB_DIR/engine.log
LAB=${LAB_DIR:-/tmp/saraat-lab}
mkdir -p "$LAB"
java  -cp "$(cat "${LABCP_FILE:-/tmp/labcp.txt}")" com.genius.saraat.engine.lab.LabMainKt \
    --down "$1" --up "$2" --seconds "${3:-120}" --quic "${4:-true}" > "$LAB/engine.log" 2>&1 &
echo $! > "$LAB/engine.pid"
for _ in $(seq 1 50); do grep -q "engine running" "$LAB/engine.log" 2>/dev/null && break; sleep 0.2; done
sleep 0.3
