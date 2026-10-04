#!/usr/bin/env bash
# Free photos from Pexels (https://www.pexels.com/license/). name:id
set -e
mkdir -p public/img
while read -r name id; do
  [ -z "$name" ] && continue
  curl -sS -o "public/img/$name.jpg" "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?auto=compress&w=2400"
  echo "$name https://www.pexels.com/photo/$id/"
done <<'LIST'
face 30513783
soup 1907227
coffin 7317678
camera 764703
film 65128
map 6564830
factory 17057342
machine 10579290
pipes 2569844
interview 8872465
desert-boy 2456068
dune-sunset 4405248
neon 18867525
neon-alley 3109671
skate-stairs 17343606
skate-smoke 415188
skate-park 5704233
concert 1105666
concert-blue 13230484
sneakers-splash 48262
sneakers-jump 1099231
soup-color 3493579
LIST
