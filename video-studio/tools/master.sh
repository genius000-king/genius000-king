#!/usr/bin/env bash
# ماستر الصوت: يوتيوب يطبّع كل شيء إلى -14 LUFS. إن سلّمته أخفض، يبدو فيديوك
# "ضعيفاً" بجانب غيره. هنا تطبيع بمرورين (قياس ثم تصحيح) مع سقف ذروة -1dBTP.
# الاستخدام: bash tools/master.sh out/showcase.mp4  → out/showcase.master.mp4
set -euo pipefail
in="$1"; out="${in%.mp4}.master.mp4"
stats=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
ffmpeg -loglevel error -y -i "$in" -c:v copy -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" -ar 48000 -c:a aac -b:a 320k "$out"
echo "✓ $out"
