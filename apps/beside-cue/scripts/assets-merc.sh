#!/bin/bash
# Merc, end to end: rig stage, contact sheet, optimize, copy to public/.
#
# The sculpt stage (import + decimate, minutes) is cached in
# art/merc/merc-sculpt.blend and only reruns with --resculpt, so the
# usual run of this script is the seconds-long part: face, rig, clips,
# fixed renders in art/merc/preview/, two loader motion sheets, and the glb the app
# loads. Change a blink in make_merc.py, run this, look at the sheet.
set -euo pipefail
cd "$(dirname "$0")/.."

SCULPT=art/merc/merc-sculpt.blend
PROOF_DIR=../../art/glass-adventure/loader/v1/proofs
resculpt=false
for arg in "$@"; do
  if [[ "$arg" == "--resculpt" ]]; then
    resculpt=true
  fi
done

sculpt_before=""
if [[ -f "$SCULPT" ]]; then
  sculpt_before=$(sha256sum "$SCULPT" | cut -d' ' -f1)
elif [[ "$resculpt" == false ]]; then
  echo "Merc sculpt cache is missing; pass --resculpt to rebuild it from the source donor." >&2
  exit 1
fi

run_blender () {
  local log status=0
  log=$(mktemp)
  ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio \
    --python-exit-code 1 "$@" >"$log" 2>&1 || status=$?
  grep -E "MERC_|PREVIEW_DONE|Traceback|Error" "$log" || true
  if (( status != 0 )); then
    tail -n 80 "$log" >&2
  fi
  rm -f "$log"
  return "$status"
}

run_blender --python art/merc/make_merc.py -- "$@"
run_blender art/merc/merc.blend --python art/merc/preview.py
bash scripts/assets-glass.sh --merc-only

sculpt_after=$(sha256sum "$SCULPT" | cut -d' ' -f1)
if [[ "$resculpt" == false && "$sculpt_before" != "$sculpt_after" ]]; then
  echo "Merc sculpt cache changed during the stage-two build." >&2
  exit 1
fi
cmp art/merc/merc.opt.glb public/games/glass3d/merc.glb

mkdir -p "$PROOF_DIR"
magick montage \
  -font Adwaita-Sans -pointsize 14 -fill '#f2e4c4' \
  -label 'Front f18' art/merc/preview/12-welcome-f18-front.png \
  -label 'Front f24' art/merc/preview/13-welcome-f24-front.png \
  -label 'Front f30' art/merc/preview/14-welcome-f30-front.png \
  -label 'Front f36' art/merc/preview/15-welcome-f36-front.png \
  -label 'Front f49' art/merc/preview/16-welcome-f49-front.png \
  -label '3/4 f18' art/merc/preview/17-welcome-f18-3q.png \
  -label '3/4 f24' art/merc/preview/18-welcome-f24-3q.png \
  -label '3/4 f30' art/merc/preview/19-welcome-f30-3q.png \
  -label '3/4 f36' art/merc/preview/20-welcome-f36-3q.png \
  -label '3/4 f49' art/merc/preview/21-welcome-f49-3q.png \
  -tile 5x2 -geometry 256x256+10+18 -background '#213033' \
  "$PROOF_DIR/welcome-motion-contact-sheet.png"
magick montage \
  -font Adwaita-Sans -pointsize 14 -fill '#f2e4c4' \
  -label 'Front f06' art/merc/preview/22-laugh-f06-front.png \
  -label 'Front f11' art/merc/preview/23-laugh-f11-front.png \
  -label 'Front f16' art/merc/preview/24-laugh-f16-front.png \
  -label 'Front f22' art/merc/preview/25-laugh-f22-front.png \
  -label 'Front f37' art/merc/preview/26-laugh-f37-front.png \
  -label '3/4 f06' art/merc/preview/27-laugh-f06-3q.png \
  -label '3/4 f11' art/merc/preview/28-laugh-f11-3q.png \
  -label '3/4 f16' art/merc/preview/29-laugh-f16-3q.png \
  -label '3/4 f22' art/merc/preview/30-laugh-f22-3q.png \
  -label '3/4 f37' art/merc/preview/31-laugh-f37-3q.png \
  -tile 5x2 -geometry 256x256+10+18 -background '#213033' \
  "$PROOF_DIR/laugh-motion-contact-sheet.png"
