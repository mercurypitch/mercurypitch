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

echo "1/7 scaffolding $PROJECT"
HYPERFRAMES_SKIP_SKILLS=1 $HF init "$PROJECT" --non-interactive >"$WORK/init.log" 2>&1 ||
  fail "init failed; see $WORK/init.log"
$HF browser ensure >"$WORK/browser.log" 2>&1 || fail "browser ensure failed; see $WORK/browser.log"

echo "2/7 fetching pinned GSAP $GSAP_VERSION and the Outfit font"
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

# The music bed: an A-major chord with upper voices phone speakers can play,
# plus a quiet shaker pulse so the 2-8 kHz band is not empty (about -18 LUFS).
# The whoosh is a soft band-limited air pass, about 1.4 LU over the bed.
ffmpeg -loglevel error -y \
  -f lavfi -i "sine=f=110:d=5" -f lavfi -i "sine=f=220:d=5" -f lavfi -i "sine=f=277.18:d=5" \
  -f lavfi -i "sine=f=329.63:d=5" -f lavfi -i "sine=f=440:d=5" -f lavfi -i "sine=f=554.37:d=5" \
  -f lavfi -i "sine=f=659.26:d=5" -f lavfi -i "anoisesrc=color=white:d=5:a=0.5:seed=7" \
  -filter_complex "[7]highpass=f=3500,lowpass=f=9000,tremolo=f=4:d=1,volume=0.35[shaker];[0][1][2][3][4][5][6][shaker]amix=inputs=8:weights='0.6 0.5 0.4 0.4 0.3 0.2 0.2 1':normalize=0,volume=1.6,tremolo=f=2:d=0.25,afade=t=in:d=0.02,afade=t=out:st=4.2:d=0.8,aformat=channel_layouts=stereo" \
  -ar 48000 assets/audio/bed.wav
ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=color=pink:d=0.45:a=0.5:seed=3" -af \
  "highpass=f=250,lowpass=f=4000,afade=t=in:d=0.25:curve=qsin,afade=t=out:st=0.25:d=0.2:curve=qsin,volume=2.2,aformat=channel_layouts=stereo" \
  -ar 48000 assets/audio/whoosh.wav
cp "$SKILL_DIR/templates/smoke-test.html" index.html

echo "3/7 check"
$HF check >"$WORK/check.log" 2>&1 || fail "check failed; see $WORK/check.log"
grep -q "Check passed" "$WORK/check.log" || fail "check did not pass; see $WORK/check.log"

echo "4/7 rendering twice at 1080p60"
for take in a b; do
  $HF render --fps 60 --quality delivery --strict --output "renders/smoke-$take.mp4" \
    >"$WORK/render-$take.log" 2>&1 || fail "render $take failed; see $WORK/render-$take.log"
done

echo "5/7 comparing every frame"
for take in a b; do
  ffmpeg -v error -i "renders/smoke-$take.mp4" -map 0:v -f framemd5 - |
    grep -v '^#' | awk -F, '{print $NF}' >"$WORK/frames-$take.md5"
done
frames=$(wc -l <"$WORK/frames-a.md5" | tr -d ' ')
[ "$frames" -eq 300 ] || fail "expected 300 frames, got $frames"
cmp -s "$WORK/frames-a.md5" "$WORK/frames-b.md5" || fail "the two renders differ: the composition is not deterministic"
geometry=$(ffprobe -v error -select_streams v -show_entries stream=width,height,r_frame_rate -of csv=p=0 renders/smoke-a.mp4)
[ "$geometry" = "1920,1080,60/1" ] || fail "unexpected picture: $geometry"
streams=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 renders/smoke-a.mp4)
[ "$streams" = "audio" ] || fail "the render has no audio stream"

echo "6/7 rendering the music-only version and comparing the effect with it"
# A sibling project with every effect hidden: HyperFrames allows one root
# composition per project, and render-time variables do not reach the audio.
MUSIC="$WORK/motion-smoke-music-only"
mkdir -p "$MUSIC/renders"
for item in assets package.json hyperframes.json meta.json; do cp -R "$item" "$MUSIC/"; done
sed 's/id="whoosh"/id="whoosh" data-hidden/' index.html >"$MUSIC/index.html"
(cd "$MUSIC" && $HF render --fps 60 --quality draft --strict --output renders/smoke-music-only.mp4) \
  >"$WORK/render-music-only.log" 2>&1 || fail "music-only render failed; see $WORK/render-music-only.log"
python3 "$SKILL_DIR/scripts/measure.py" audio renders/smoke-a.mp4 \
  --music-only "$MUSIC/renders/smoke-music-only.mp4" --out review >"$WORK/audio.log" 2>&1 ||
  fail "measure.py audio failed; see $WORK/audio.log"
grep -q '^| 2\.' review/audio.md || fail "the whoosh at 2.15 s was not found against the music-only render; see review/audio.md"

echo "7/7 measuring"
python3 "$SKILL_DIR/scripts/measure.py" render renders/smoke-a.mp4 --out review >"$WORK/measure.log" 2>&1 ||
  fail "measure.py failed; see $WORK/measure.log"

echo
echo "SMOKE TEST PASSED"
echo "  render:        $PROJECT/renders/smoke-a.mp4 (300 identical frames in both takes)"
echo "  music only:    $MUSIC/renders/smoke-music-only.mp4"
echo "  measurements:  $PROJECT/review/summary.md, $PROJECT/review/audio.md"
echo "  contact sheet: $PROJECT/review/sheet-01.jpg"
grep -E "^[[:space:]]*(beginframe|screenshot) capture" "$WORK/render-a.log" | head -1 |
  sed 's/^ */  render path:   /' || true
