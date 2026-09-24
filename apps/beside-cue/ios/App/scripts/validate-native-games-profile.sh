#!/bin/sh

# Keep the copied Capacitor web bundle and the selected iOS privacy plist in the
# same profile. This runs inside every Xcode build because App/public is ignored
# and can otherwise retain a games-enabled sync across a later store archive.

set -eu

fail() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

[ -n "${SRCROOT:-}" ] || fail 'SRCROOT is required'

public_dir="$SRCROOT/App/public"
marker="$public_dir/native-games-profile.json"
checksums="$public_dir/native-games-profile.sha256"
plist_setting="${INFOPLIST_FILE:-${BESIDE_CUE_INFO_PLIST_PATH:-}}"

case "$plist_setting" in
  App/Info.plist | "$SRCROOT/App/Info.plist")
    profile=store
    selected_plist="$SRCROOT/App/Info.plist"
    ;;
  build/games/Info.plist | "$SRCROOT/build/games/Info.plist")
    profile=games
    selected_plist="$SRCROOT/build/games/Info.plist"
    ;;
  *)
    fail "Unsupported BESIDE_CUE_INFO_PLIST_PATH/INFOPLIST_FILE: ${plist_setting:-<empty>}"
    ;;
esac

[ -f "$selected_plist" ] || fail "Selected Info.plist is missing: $selected_plist"
[ -d "$public_dir" ] || fail 'Capacitor public bundle is missing. Run cap sync ios before building.'

has_game_assets=false
for candidate in "$marker" "$checksums" "$public_dir/games" "$public_dir/models" "$public_dir/ort"; do
  if [ -e "$candidate" ]; then
    has_game_assets=true
    break
  fi
done

if [ "$profile" = store ]; then
  if [ "$has_game_assets" = true ]; then
    fail 'Store profile contains games assets. Rebuild with VITE_BESIDE_CUE_GAMES=0, run cap sync ios, then archive again.'
  fi
  if grep -q '<key>NSMicrophoneUsageDescription</key>' "$selected_plist"; then
    fail 'Store profile must use the canonical Info.plist without microphone access.'
  fi
  exit 0
fi

[ -f "$marker" ] || fail 'Games profile is missing native-games-profile.json. Run native:games --platform ios --build first.'
[ -f "$checksums" ] || fail 'Games profile is missing native-games-profile.sha256. Run native:games --platform ios --build first.'
grep -Eq '^[[:space:]]*"schema"[[:space:]]*:[[:space:]]*3[[:space:]]*,' "$marker" ||
  fail 'Games profile marker has an unsupported schema.'

marker_string() {
  awk -F'"' -v key="$1" '$2 == key { print $4; exit }' "$marker"
}

[ "$(marker_string profile)" = games ] || fail 'Games profile marker has the wrong profile.'
[ "$(marker_string platform)" = ios ] || fail 'Games profile marker is not for iOS.'
expected_checksum_hash="$(marker_string checksumSha256)"
[ -n "$expected_checksum_hash" ] || fail 'Games profile marker is missing its checksum manifest hash.'

if grep -q '<key>NSMicrophoneUsageDescription</key>' "$selected_plist"; then
  :
else
  fail 'Games profile must select the generated Info.plist with microphone access.'
fi

shasum_bin="${SHASUM_BIN:-}"
if [ -z "$shasum_bin" ]; then
  shasum_bin="$(command -v shasum || true)"
fi
[ -n "$shasum_bin" ] && [ -x "$shasum_bin" ] || fail 'shasum is required to validate the games profile.'

actual_checksum_hash="$("$shasum_bin" -a 256 "$checksums")"
actual_checksum_hash="${actual_checksum_hash%% *}"
[ "$actual_checksum_hash" = "$expected_checksum_hash" ] || fail 'Games profile marker and checksum manifest differ.'

if (cd "$public_dir" && "$shasum_bin" -a 256 --check --status "$(basename "$checksums")"); then
  :
else
  fail 'Games profile assets do not match the stamped checksums. Run native:games again.'
fi
