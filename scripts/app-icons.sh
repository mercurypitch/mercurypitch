#!/usr/bin/env bash
# Every icon and launch image a Capacitor app in this repository ships,
# from four checked-in masters.
# ============================================================
#
#   scripts/app-icons.sh apps/mercurypitch
#
# One script for every app. Each app keeps its own masters and one small
# config in <app>/art/icon/ (see icon.conf); the platform rules below are
# the same for all of them and live here once. Regenerate after changing a
# master. Idempotent: it overwrites, never appends, and drops ImageMagick's
# timestamp chunk so running it twice produces identical bytes.
#
# Masters, all 1024x1024, named <PREFIX>-...:
#   -icon-1024.png         the light icon, OPAQUE, on its own field
#   -icon-dark-1024.png    the iOS 18 dark appearance (may carry alpha)
#   -icon-tinted-1024.png  greyscale values, alpha, sRGB-tagged; iOS colours it
#   -disc-1024.png         the art alone on transparency, for Android's
#                          adaptive foreground
#
# What each platform actually wants, which is not the same thing:
#
#   iOS      One 1024 square, FULLY OPAQUE. An alpha channel fails App
#            Store validation outright. Never pre-round it: the system
#            applies its own superellipse mask, and a rounded source gets
#            rounded twice. Xcode derives every other size. Since iOS 18
#            there are also dark and tinted appearances; those two MAY
#            carry alpha, and tinted must be greyscale.
#
#   Android  Two separate things. The adaptive icon is a 108dp canvas
#            whose outer 18dp on every side is eaten by the launcher's
#            mask and its parallax, so the art has to sit inside the
#            middle ~72dp or it gets cropped on somebody's phone. The
#            legacy 48dp ic_launcher is still needed for the recents
#            switcher and old launchers, and the round one for launchers
#            that ask for it.
#
#   Launch   Capacitor's template ships a set of splash PNGs at fixed
#            sizes on both platforms. Each one is regenerated at its OWN
#            dimensions, so the template's set of sizes stays the source
#            of truth and this script never has to know them.
#
# The Play Store's 512 listing icon and the App Store's marketing icon
# are not produced here: the App Store takes its 1024 from the build, and
# Play takes its 512 from an upload in the Play Console.
#
# Beside Cue still runs its own apps/beside-cue/scripts/icons.sh, which
# this was generalised from; switching it over (task A15b) needs a
# byte-stability check against its committed set, and is its own change.

set -euo pipefail

APP=${1:?usage: scripts/app-icons.sh <app-dir>}
[ -d "$APP" ] || { echo "no such app dir: $APP" >&2; exit 1; }
ART="$APP/art/icon"
CONF="$ART/icon.conf"
[ -f "$CONF" ] || { echo "missing $CONF" >&2; exit 1; }
# shellcheck disable=SC1090
. "$CONF"
: "${PREFIX:?icon.conf must set PREFIX}"
: "${ANDROID_BACKGROUND:?icon.conf must set ANDROID_BACKGROUND}"
: "${SPLASH_BACKGROUND:?icon.conf must set SPLASH_BACKGROUND}"
: "${SPLASH_ORB_FRACTION:?icon.conf must set SPLASH_ORB_FRACTION}"

SRC="$ART/$PREFIX-icon-1024.png"
SRC_DARK="$ART/$PREFIX-icon-dark-1024.png"
SRC_TINTED="$ART/$PREFIX-icon-tinted-1024.png"
SRC_DISC="$ART/$PREFIX-disc-1024.png"
for f in "$SRC" "$SRC_DARK" "$SRC_TINTED" "$SRC_DISC"; do
  [ -f "$f" ] || { echo "missing master: $f" >&2; exit 1; }
done
command -v magick >/dev/null || { echo "ImageMagick (magick) required" >&2; exit 1; }

# ImageMagick stamps a tIME chunk into every PNG it writes, so re-running
# this script would rewrite every file with identical pixels and different
# bytes. Git cannot tell that apart from a real change. Named explicitly:
# the friendly "date" keyword alone does not drop it. Not -strip, which
# would take the colour chunks too, and these files are handed to
# platforms that read them.
PNG='-define png:exclude-chunk=tIME,date'
# shellcheck disable=SC2086  # PNG must word-split into magick's argv

say () { printf '  %s\n' "$1"; }

# --------------------------------------------------------------------
# iOS
# --------------------------------------------------------------------
IOS="$APP/ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$IOS"
echo "iOS"

# -alpha remove, then -alpha off: a PNG that merely looks opaque can still
# carry an alpha channel, and that is what the validator reads.
magick $PNG "$SRC" -background white -alpha remove -alpha off \
  -quality 100 "$IOS/AppIcon-512@2x.png"
say "AppIcon-512@2x.png (light, opaque)"

magick $PNG "$SRC_DARK" -background black -alpha remove -alpha off \
  -quality 100 "$IOS/AppIcon-dark-1024.png"
say "AppIcon-dark-1024.png"

# png:color-type=6 forces RGBA: -colorspace sRGB alone still writes a
# greyscale PNG when every pixel happens to be grey, and an asset catalog
# treats a Gray-tagged file differently from an sRGB one that is grey.
magick $PNG "$SRC_TINTED" -colorspace sRGB -define png:color-type=6 \
  -quality 100 "$IOS/AppIcon-tinted-1024.png"
say "AppIcon-tinted-1024.png (greyscale values, sRGB, alpha)"

cat > "$IOS/Contents.json" <<'JSON'
{
  "images": [
    {
      "filename": "AppIcon-512@2x.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    },
    {
      "appearances": [
        {
          "appearance": "luminosity",
          "value": "dark"
        }
      ],
      "filename": "AppIcon-dark-1024.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    },
    {
      "appearances": [
        {
          "appearance": "luminosity",
          "value": "tinted"
        }
      ],
      "filename": "AppIcon-tinted-1024.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
JSON
say "Contents.json (light + dark + tinted)"

# --------------------------------------------------------------------
# Android
# --------------------------------------------------------------------
RES="$APP/android/app/src/main/res"
echo "Android"

# Adaptive foreground: 108dp canvas, inner 72dp always visible. A circular
# mark can go right out to it; 70 keeps a dp of air against the parallax.
ADAPTIVE_DP=108
SAFE_NUM=70
LEGACY_DP=48

for row in "mdpi 1" "hdpi 1.5" "xhdpi 2" "xxhdpi 3" "xxxhdpi 4"; do
  set -- $row
  density=$1
  scale=$2
  dir="$RES/mipmap-$density"
  mkdir -p "$dir"

  adaptive=$(awk "BEGIN{printf \"%d\", $ADAPTIVE_DP * $scale}")
  safe=$(awk "BEGIN{printf \"%d\", $ADAPTIVE_DP * $scale * $SAFE_NUM / 108}")
  legacy=$(awk "BEGIN{printf \"%d\", $LEGACY_DP * $scale}")

  magick $PNG "$SRC_DISC" -resize "${safe}x${safe}" \
    -background none -gravity center -extent "${adaptive}x${adaptive}" \
    "$dir/ic_launcher_foreground.png"

  magick $PNG "$SRC" -resize "${legacy}x${legacy}" -alpha off \
    "$dir/ic_launcher.png"

  # Masked here rather than left to the launcher: a launcher that asks
  # for ic_launcher_round expects a circle and will not cut one for you.
  half=$((legacy / 2))
  magick $PNG "$SRC" -resize "${legacy}x${legacy}" \
    \( +clone -alpha transparent -fill white \
       -draw "circle $half,$half $half,0" -alpha extract \) \
    -alpha off -compose CopyOpacity -composite \
    "$dir/ic_launcher_round.png"

  say "mipmap-$density: foreground ${adaptive}px (art ${safe}px), launcher ${legacy}px"
done

# The field between the art and the mask edge is drawn as a ring around
# the mark on every launcher shape; it cannot be removed, only coloured.
mkdir -p "$RES/values"
cat > "$RES/values/ic_launcher_background.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ANDROID_BACKGROUND}</color>
</resources>
XML
say "values/ic_launcher_background.xml = ${ANDROID_BACKGROUND}"

# Point the adaptive icon at the mipmap PNGs. Capacitor's template points
# it at placeholder vectors in drawable/; @drawable and @mipmap do not
# share a namespace, so with that xml in place the PNGs above are dead
# files. The placeholders themselves are removed for the same reason.
mkdir -p "$RES/mipmap-anydpi-v26"
for name in ic_launcher ic_launcher_round; do
  cat > "$RES/mipmap-anydpi-v26/$name.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XML
done
rm -f "$RES/drawable-v24/ic_launcher_foreground.xml" "$RES/drawable/ic_launcher_background.xml"
say "mipmap-anydpi-v26/*.xml -> @mipmap/ic_launcher_foreground; template placeholder vectors removed"

# --------------------------------------------------------------------
# Launch images, at whatever sizes the template already ships
# --------------------------------------------------------------------
echo "Launch images"
count=0
while IFS= read -r splash; do
  dims=$(magick identify -format '%w %h' "$splash")
  set -- $dims
  w=$1; h=$2
  short=$(( w < h ? w : h ))
  orb=$(awk "BEGIN{printf \"%d\", $short * $SPLASH_ORB_FRACTION}")
  magick $PNG -size "${w}x${h}" "xc:${SPLASH_BACKGROUND}" \
    \( "$SRC_DISC" -resize "${orb}x${orb}" \) -gravity center -composite \
    -alpha off "$splash"
  count=$((count + 1))
done < <(find "$APP/ios/App/App/Assets.xcassets/Splash.imageset" "$RES" -name 'splash*.png' | sort)
say "$count splash images regenerated at their own dimensions (orb at ${SPLASH_ORB_FRACTION} of the short side)"

echo "done: $APP"
