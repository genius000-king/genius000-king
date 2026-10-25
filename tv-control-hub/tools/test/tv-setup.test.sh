#!/usr/bin/env bash
# Runs tv-setup.sh against a fake adb that records every call, and checks the essentials.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf -- "${work:?}"' EXIT

cat > "$work/adb" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$ADB_LOG"
case "$*" in
  *"settings get secure enabled_accessibility_services"*) echo "com.other/.Svc" ;;
esac
exit 0
FAKE
chmod +x "$work/adb"
export ADB_LOG="$work/log" PATH="$work:$PATH"

"$here/../tv-setup.sh" 192.168.1.20 app.apk > /dev/null

expect() { grep -qF -- "$1" "$ADB_LOG" || { echo "missing: $1"; cat "$ADB_LOG"; exit 1; }; }
expect "connect 192.168.1.20:5555"
expect "install -r -g app.apk"
expect "enabled_accessibility_services com.other/.Svc:com.genius.tvhub/com.genius.tvhub.engine.input.service.HubAccessibilityService"
expect "appops set com.genius.tvhub REQUEST_INSTALL_PACKAGES allow"
expect "appops set com.genius.tvhub MANAGE_EXTERNAL_STORAGE allow"
expect "set-home-activity com.genius.tvhub/.TvHome"
echo "tv-setup.sh: all expected adb calls made"
