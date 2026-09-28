#!/usr/bin/env bash
# Downloads the Google Fonts used by the scenes into public/fonts (latin + arabic subsets only)
# and writes public/fonts/fonts.css with local URLs, so rendering works fully offline.
set -euo pipefail
cd "$(dirname "$0")/../public/fonts"
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
FAMILIES=(
  'Amiri:wght@400;700'
  'Archivo+Black'
  'Cairo:wght@400;700;900'
  'Cormorant+Garamond:ital,wght@0,300;0,500;1,300'
  'Inter:wght@300;500;800'
  'JetBrains+Mono:wght@400;700'
  'Lalezar'
  'Mr+Dafoe'
  'Orbitron:wght@900'
  'Press+Start+2P'
  'Reem+Kufi:wght@700'
  'Space+Grotesk:wght@400;700'
  'VT323'
)
: > fonts.css
for fam in "${FAMILIES[@]}"; do
  css=$(curl -sSf -A "$UA" "https://fonts.googleapis.com/css2?family=${fam}&display=block")
  # keep only the latin and arabic @font-face blocks
  echo "$css" | awk 'BEGIN{RS="/\\* "; ORS=""} NR>1 && ($1=="latin" || $1=="arabic") {print "/* " $0}' >> fonts.css
done
grep -o 'https://fonts.gstatic.com/[^)]*' fonts.css | sort -u | while read -r url; do
  f=$(echo "$url" | sed 's#https://fonts.gstatic.com/s/##; s#/#_#g')
  [ -f "$f" ] || curl -sSf -o "$f" "$url"
done
sed -i -E 's#https://fonts.gstatic.com/s/([^)]*)#\1#; s#url\(([^/)]*)/([^/)]*)/([^)]*)\)#url(\1_\2_\3)#' fonts.css
echo "fonts: $(grep -c '@font-face' fonts.css) faces, $(ls *.woff2 | wc -l) files, $(du -sh . | cut -f1)"
