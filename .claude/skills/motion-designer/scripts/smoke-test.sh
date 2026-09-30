#!/usr/bin/env bash
# motion-designer smoke test: scaffold a HyperFrames project, render a
# 5-second 1080p60 composition twice, confirm both renders are identical frame
# for frame, and measure the result. Needs network for npx and two downloads.
#
# Usage: bash scripts/smoke-test.sh <work-dir>
# Prints SMOKE TEST PASSED and the paths to look at, or SMOKE TEST FAILED.
set -euo pipefail

HF_VERSION=0.8.97
GSAP_VERSION=3.14.2
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:?usage: smoke-test.sh <work-dir>}"
PROJECT="$WORK/motion-smoke"
HF="npx --yes hyperframes@$HF_VERSION"

fail() {
  echo "SMOKE TEST FAILED: $*" >&2
  exit 1
}

command -v node >/dev/null || fail "node is not installed"
node_major=$(node -p 'process.versions.node.split(".")[0]')
[ "$node_major" -ge 22 ] || fail "node $node_major is too old; HyperFrames needs 22 or newer"
command -v ffmpeg >/dev/null || fail "ffmpeg is not installed"
command -v ffprobe >/dev/null || fail "ffprobe is not installed"
filters="$(ffmpeg -hide_banner -filters 2>/dev/null || true)"
for filter in ebur128 tblend signalstats scdet; do
  case "$filters" in
  *" $filter "*) ;;
  *) fail "ffmpeg lacks the $filter filter" ;;
  esac
done
command -v python3 >/dev/null || fail "python3 is not installed"
[ ! -e "$PROJECT" ] || fail "$PROJECT already exists; pass an empty work dir"

mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
PROJECT="$WORK/motion-smoke"

echo "1/6 scaffolding $PROJECT"
HYPERFRAMES_SKIP_SKILLS=1 $HF init "$PROJECT" --non-interactive >"$WORK/init.log" 2>&1 ||
  fail "init failed; see $WORK/init.log"
$HF browser ensure >"$WORK/browser.log" 2>&1 || fail "browser ensure failed; see $WORK/browser.log"

echo "2/6 fetching pinned GSAP $GSAP_VERSION and the Outfit font"
cd "$PROJECT"
mkdir -p assets/vendor assets/fonts assets/brand assets/audio renders
curl -sSfL -o "assets/vendor/gsap-$GSAP_VERSION.min.js" \
  "https://cdn.jsdelivr.net/npm/gsap@$GSAP_VERSION/dist/gsap.min.js"
curl -sSfL -o assets/fonts/Outfit-wght.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf"
curl -sSfL -o assets/fonts/OFL.txt \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/OFL.txt"

# The mark: MercuryPitch's shipped logo when this skill lives in that repo,
# a plain disc anywhere else.
REPO_ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/docs/branding/logo/meniscus2/mark.svg" ]; then
  cp "$REPO_ROOT/docs/branding/logo/meniscus2/mark.svg" assets/brand/mark.svg
else
  printf '%s\n' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="246" fill="#8a97a6"/></svg>' >assets/brand/mark.svg
fi

# A quiet A-major pad as the music bed and one soft band-limited whoosh.
ffmpeg -loglevel error -y -f lavfi -i "sine=f=220:d=5" -f lavfi -i "sine=f=277.18:d=5" \
  -f lavfi -i "sine=f=329.63:d=5" -f lavfi -i "sine=f=110:d=5" -filter_complex \
  "[0][1][2][3]amix=inputs=4:normalize=0,volume=0.12,tremolo=f=2:d=0.35,afade=t=in:d=0.02,afade=t=out:st=4.2:d=0.8,aformat=channel_layouts=stereo" \
  -ar 48000 assets/audio/bed.wav
ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=color=pink:d=0.45:a=0.5" -af \
  "highpass=f=250,lowpass=f=5000,afade=t=in:d=0.25:curve=qsin,afade=t=out:st=0.25:d=0.2:curve=qsin,volume=0.6,aformat=channel_layouts=stereo" \
  -ar 48000 assets/audio/whoosh.wav
cp "$SKILL_DIR/templates/smoke-test.html" index.html

echo "3/6 check"
$HF check >"$WORK/check.log" 2>&1 || fail "check failed; see $WORK/check.log"
grep -q "Check passed" "$WORK/check.log" || fail "check did not pass; see $WORK/check.log"

echo "4/6 rendering twice at 1080p60"
for take in a b; do
  $HF render --fps 60 --quality delivery --strict --output "renders/smoke-$take.mp4" \
    >"$WORK/render-$take.log" 2>&1 || fail "render $take failed; see $WORK/render-$take.log"
done

echo "5/6 comparing every frame"
for take in a b; do
  ffmpeg -v error -i "renders/smoke-$take.mp4" -map 0:v -f framemd5 - |
    grep -v '^#' | awk -F, '{print $NF}' >"$WORK/frames-$take.md5"
done
frames=$(wc -l <"$WORK/frames-a.md5" | tr -d ' ')
[ "$frames" -eq 300 ] || fail "expected 300 frames, got $frames"
cmp -s "$WORK/frames-a.md5" "$WORK/frames-b.md5" || fail "the two renders differ: the composition is not deterministic"
geometry=$(ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate -of csv=p=0 renders/smoke-a.mp4)
[ "$geometry" = "1920,1080,60/1" ] || fail "unexpected picture: $geometry"
ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 renders/smoke-a.mp4 |
  grep -q audio || fail "the render has no audio stream"

echo "6/6 measuring"
python3 "$SKILL_DIR/scripts/measure.py" render renders/smoke-a.mp4 --out review >"$WORK/measure.log" 2>&1 ||
  fail "measure.py failed; see $WORK/measure.log"

echo
echo "SMOKE TEST PASSED"
echo "  render:        $PROJECT/renders/smoke-a.mp4 (300 identical frames in both takes)"
echo "  measurements:  $PROJECT/review/summary.md"
echo "  contact sheet: $PROJECT/review/sheet-01.jpg"
grep -E "^[[:space:]]*(beginframe|screenshot) capture" "$WORK/render-a.log" | head -1 |
  sed 's/^ */  render path:   /' || true
