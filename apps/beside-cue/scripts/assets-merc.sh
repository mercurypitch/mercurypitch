#!/bin/bash
# Merc, end to end: rig stage, contact sheet, optimize, copy to public/.
#
# The sculpt stage (import + decimate, minutes) is cached in
# art/merc/merc-sculpt.blend and only reruns with --resculpt, so the
# usual run of this script is the seconds-long part: face, rig, clips,
# a sheet of eight renders in art/merc/preview/, and the glb the app
# loads. Change a blink in make_merc.py, run this, look at the sheet.
set -euo pipefail
cd "$(dirname "$0")/.."
blender --background --python art/merc/make_merc.py -- "$@" 2>&1 | grep -E "MERC_|Traceback|Error" || true
blender --background art/merc/merc.blend --python art/merc/preview.py 2>&1 | grep -E "PREVIEW_DONE|Traceback|Error" || true
bash scripts/assets-glass.sh
