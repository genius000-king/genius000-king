#!/usr/bin/env bash
# يرندر الحلقة على أجزاء متتالية ويضغط كل جزء تحت 29MB فور انتهائه
# (للتسليم السريع: الجزء الأول جاهز خلال دقائق بدل انتظار الحلقة كلها)
# الاستخدام: bash tools/render-parts.sh FakeExperts 18339 6 out/parts
set -uo pipefail
comp=$1; total=$2; n=$3; dir=$4
mkdir -p "$dir"
per=$(( (total + n - 1) / n ))
for i in $(seq 1 "$n"); do
  a=$(( (i - 1) * per )); b=$(( i * per - 1 )); [ "$b" -ge "$total" ] && b=$(( total - 1 ))
  raw="$dir/raw-$i.mp4"; final="$dir/part-$i-of-$n.mp4"
  npx remotion render src/index.ts "$comp" "$raw" --frames="$a-$b" --concurrency=4 > "$dir/log-$i.txt" 2>&1 || { echo "FAIL part $i"; continue; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$raw")
  # معدّل بت محسوب ليبقى الجزء تحت 29MB
  vb=$(python3 -c "print(int((29*8*1024*0.93/$dur - 160)))")
  ffmpeg -loglevel error -y -i "$raw" -c:v libx264 -preset medium -b:v ${vb}k -maxrate $((vb*3/2))k -bufsize $((vb*2))k -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$final"
  echo "READY $final $(du -h "$final" | cut -f1) ${dur}s"
done
echo "ALL DONE"
