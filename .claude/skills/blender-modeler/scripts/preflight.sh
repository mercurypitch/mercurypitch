#!/usr/bin/env bash
# preflight.sh — find or fetch Blender 5.2.2 LTS, make headless rendering work, smoke-render.
#
# Prints `BLENDER=<path>` on success; export it for the other scripts:
#   eval "$(bash .claude/skills/blender-modeler/scripts/preflight.sh | grep '^BLENDER=')"
#
# Search order: $BLENDER, `blender` on PATH, macOS app bundle, the cache
# ($BLENDER_CACHE, default ~/.cache/blender-modeler). On Linux it downloads the
# official build into the cache, verifies its SHA-256, and installs the Mesa EGL
# libraries Workbench needs when they are missing (cloud containers have none).
set -euo pipefail

VERSION="${BLENDER_VERSION:-5.2.2}"
SERIES="${VERSION%.*}"
CACHE="${BLENDER_CACHE:-$HOME/.cache/blender-modeler}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

matches_version() { "$1" --version 2>/dev/null | head -1 | grep -q "Blender $VERSION"; }

find_blender() {
  local candidate
  for candidate in "${BLENDER:-}" "$(command -v blender || true)" \
    "/Applications/Blender.app/Contents/MacOS/Blender" \
    "$CACHE/blender-$VERSION-linux-x64/blender"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ] && matches_version "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

fetch_linux() {
  local base="https://download.blender.org/release/Blender$SERIES"
  local tarball="blender-$VERSION-linux-x64.tar.xz"
  mkdir -p "$CACHE"
  echo "Downloading Blender $VERSION (about 380 MB) into $CACHE" >&2
  curl -fsSL -o "$CACHE/$tarball" "$base/$tarball"
  curl -fsSL -o "$CACHE/blender-$VERSION.sha256" "$base/blender-$VERSION.sha256"
  (cd "$CACHE" && grep " $tarball\$" "blender-$VERSION.sha256" | sha256sum -c - >&2)
  tar -xf "$CACHE/$tarball" -C "$CACHE"
  rm -f "$CACHE/$tarball"
}

ensure_egl() {
  [ "$(uname -s)" = "Linux" ] || return 0
  if ldconfig -p 2>/dev/null | grep -q 'libEGL.so.1'; then return 0; fi
  echo "Installing Mesa EGL (libegl1 libegl-mesa0) for headless Workbench" >&2
  local sudo=""
  [ "$(id -u)" = "0" ] || sudo="sudo"
  $sudo apt-get install -y --no-install-recommends libegl1 libegl-mesa0 >&2 ||
    { $sudo apt-get update >&2 && $sudo apt-get install -y --no-install-recommends libegl1 libegl-mesa0 >&2; } ||
    echo "WARNING: could not install EGL; Workbench renders will fail, Cycles still works" >&2
}

BIN="$(find_blender || true)"
if [ -z "$BIN" ]; then
  if [ "$(uname -s)" = "Linux" ]; then
    fetch_linux
    BIN="$CACHE/blender-$VERSION-linux-x64/blender"
  else
    echo "Blender $VERSION not found. Install it from https://www.blender.org/download/lts/ or set BLENDER=<path>." >&2
    exit 1
  fi
fi
ensure_egl

OUT="$(mktemp -d)"
"$BIN" -b --factory-startup --python "$HERE/smoke_render.py" -- "$OUT" >"$OUT/log.txt" 2>&1 || true
if ! grep -q '^SMOKE OK' "$OUT/log.txt"; then
  echo "Smoke render failed; log follows" >&2
  tail -30 "$OUT/log.txt" >&2
  exit 1
fi
grep '^SMOKE' "$OUT/log.txt" >&2
rm -rf "$OUT"
echo "BLENDER=$BIN"
