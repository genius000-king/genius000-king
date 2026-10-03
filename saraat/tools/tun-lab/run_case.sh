#!/bin/bash
# Runs the engine at a given limit against the real kernel TUN and measures what curl actually gets.
#
#   run_case.sh <down_kbps> <up_kbps> <download_bytes|0> <upload_bytes|0> [block_quic=true]
#
# Prerequisites (see README.md): tun_bridge.py running, lab_servers.py running, classpath in $LABCP_FILE.
D=$1; U=$2; DB=$3; UB=$4; Q=${5:-true}
LAB=${LAB_DIR:-/tmp/saraat-lab}
LABCP_FILE=${LABCP_FILE:-/tmp/labcp.txt}
SRC=${SRC_IP:-10.1.10.1}
DST=${DST_IP:-203.0.113.9}

HERE=$(dirname "$0")
export LAB_DIR="$LAB" LABCP_FILE
"$HERE/stop_engine.sh"
"$HERE/start_engine.sh" "$D" "$U" 120 "$Q"

report() { # kind limit bytes seconds http
python3 - "$@" <<'PY'
import sys
kind, limit, size, t, code = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
rate = size * 8 / 1000 / t
print(f"{kind:8s} limit={limit:>7.0f} kbps | {size:>9d} B in {t:6.2f}s => {rate:8.0f} kbps | accuracy {rate/limit*100:5.1f}% | http {code}")
PY
}

if [ "$DB" != "0" ]; then
    r=$(curl -s -m 150 --interface "$SRC" -o /dev/null -w "%{http_code} %{size_download} %{time_total}" "http://$DST:8080/big.bin?n=$DB")
    set -- $r
    report DOWNLOAD "$D" "$2" "$3" "$1"
fi
if [ "$UB" != "0" ]; then
    head -c "$UB" /dev/zero > "$LAB/up.bin"
    r=$(curl -s -m 150 --interface "$SRC" -X POST --data-binary @"$LAB/up.bin" -o /dev/null -w "%{http_code} %{size_upload} %{time_total}" "http://$DST:8080/upload")
    set -- $r
    report UPLOAD "$U" "$2" "$3" "$1"
fi
"$HERE/stop_engine.sh"
