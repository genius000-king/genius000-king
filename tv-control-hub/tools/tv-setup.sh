#!/usr/bin/env bash
# One-time setup of TV Hub on a Google TV box, from a computer, over Wi-Fi ADB.
#
#   tools/tv-setup.sh <TV_IP[:PORT]> [path/to/app.apk]
#
# Before: on the TV, Settings → System → About → press "Android TV OS build" 7 times, then
# Settings → System → Developer options → turn on "USB debugging" / "Wireless debugging".
# Google TV 12+ with "Wireless debugging": run `adb pair <IP>:<PAIR_PORT>` with the shown code
# first, then pass the connect port shown on that screen.
#
# Grants in one go what Android 13+ hides behind "restricted settings" on sideloaded apps:
# accessibility (control from the phone), installing apps, all-files access, screen capture
# without the prompt where the build allows it, and TV Hub as the home screen.
set -euo pipefail

TARGET="${1:?usage: tv-setup.sh <TV_IP[:PORT]> [app.apk]}"
APK="${2:-}"
PKG=com.genius.tvhub
SERVICE="$PKG/$PKG.engine.input.service.HubAccessibilityService"
[[ "$TARGET" == *:* ]] || TARGET="$TARGET:5555"

say() { printf '\033[1m›\033[0m %s\n' "$*"; }

say "Connecting to $TARGET"
adb connect "$TARGET" >/dev/null
A=(adb -s "$TARGET")
"${A[@]}" wait-for-device

if [[ -n "$APK" ]]; then
  say "Installing $APK"
  "${A[@]}" install -r -g "$APK"
fi

say "Opening TV Hub once (it registers itself as a TV home)"
"${A[@]}" shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 3

say "Accessibility: control from the phone"
"${A[@]}" shell appops set "$PKG" ACCESS_RESTRICTED_SETTINGS allow || true
current=$("${A[@]}" shell settings get secure enabled_accessibility_services | tr -d '\r')
if [[ "$current" != *"$SERVICE"* ]]; then
  if [[ -z "$current" || "$current" == "null" ]]; then next="$SERVICE"; else next="$current:$SERVICE"; fi
  "${A[@]}" shell settings put secure enabled_accessibility_services "$next"
fi
"${A[@]}" shell settings put secure accessibility_enabled 1

say "Install apps, all files, screen capture, notifications"
"${A[@]}" shell appops set "$PKG" REQUEST_INSTALL_PACKAGES allow || true
"${A[@]}" shell appops set "$PKG" MANAGE_EXTERNAL_STORAGE allow || true
"${A[@]}" shell appops set "$PKG" PROJECT_MEDIA allow || true
"${A[@]}" shell appops set "$PKG" SYSTEM_ALERT_WINDOW allow || true
"${A[@]}" shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true

say "Keep TV Hub running (no battery optimisation)"
"${A[@]}" shell dumpsys deviceidle whitelist "+$PKG" >/dev/null || true

say "TV Hub as the home screen"
if "${A[@]}" shell cmd package set-home-activity "$PKG/.TvHome" >/dev/null 2>&1; then
  echo "  done — the Home button and boot now open TV Hub"
else
  echo "  this build refuses it; turn on Settings → System → \"Home button opens TV Hub\" inside TV Hub instead"
fi

say "Finished. Open TV Hub on your phone: the TV appears by itself; press OK on the TV once."
