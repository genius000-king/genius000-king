#!/usr/bin/env bash
# يرندر جزءاً واحداً (i من n) ويضغطه تحت 29MB — يُشغَّل عدة نسخ منه بالتوازي
# الاستخدام: bash tools/render-one-part.sh FakeExperts 18339 6 out/parts 3 [concurrency]
set -uo pipefail
comp=$1; total=$2; n=$3; dir=$4; i=$5; conc=${6:-2}
mkdir -p "$dir"
per=$(( (total + n - 1) / n ))
a=$(( (i - 1) * per )); b=$(( i * per - 1 )); [ "$b" -ge "$total" ] && b=$(( total - 1 ))
raw="$dir/raw-$i.mp4"; final="$dir/part-$i-of-$n.mp4"
if [ ! -s "$raw" ]; then
  npx remotion render src/index.ts "$comp" "$raw" --frames="$a-$b" --concurrency="$conc" > "$dir/log-$i.txt" 2>&1 || { echo "FAIL part $i"; exit 1; }
fi
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$raw")
vb=$(python3 -c "print(int((29*8*1024*0.93/$dur - 160)))")
ffmpeg -loglevel error -y -i "$raw" -c:v libx264 -preset medium -b:v ${vb}k -maxrate $((vb*3/2))k -bufsize $((vb*2))k -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$final"
echo "READY $final $(du -h "$final" | cut -f1) ${dur}s"
