#!/usr/bin/env bash
# Every app icon this project ships, from four checked-in masters.
# ============================================================
#
#   ./scripts/icons.sh
#
# Regenerate after changing anything in art/icon/. Idempotent: it
# overwrites, never appends, so running it twice is running it once.
#
# The masters live in art/icon/ rather than being derived from the
# branding gallery, because a build must not depend on a sibling repo.
# They came from `bc_icon_03t_punch` in disjoint-colliders (the record
# with a mercury label, saturation and contrast pushed), quantised to 48
# colours -- the artwork is flat vector, so the palette costs nothing and
# it strips the JPEG mosquito noise the generator left around the edges.
#
# What each platform actually wants, which is not the same thing:
#
#   iOS      One 1024 square, FULLY OPAQUE. An alpha channel fails App
#            Store validation outright. Never pre-round it: the system
#            applies its own superellipse mask, and a rounded source
#            gets rounded twice. Xcode derives every other size.
#            Since iOS 18 there are also dark and tinted appearances;
#            those two MAY carry alpha, and tinted must be greyscale
#            because the system colours it.
#
#   Android  Two separate things. The adaptive icon is a 108dp canvas
#            whose outer 18dp on every side is eaten by the launcher's
#            mask and its parallax, so the art has to sit inside the
#            middle ~66dp or it gets cropped on somebody's phone. The
#            legacy 48dp ic_launcher is still needed for the recents
#            switcher and old launchers, and the round one for launchers
#            that ask for it.
#
#   Web      No transparency for apple-touch-icon (iOS composites it on
#            black and any alpha shows as black), transparency fine for
#            everything else.
#
# The Play Store's 512 listing icon and the App Store's marketing icon
# are NOT in this list on purpose: the App Store takes its 1024 from the
# build, and Play takes its 512 from an upload in the Play Console. Both
# are written to build/store-icons/ for that upload.

set -euo pipefail
cd "$(dirname "$0")/.."

SRC=art/icon/beside-cue-icon-1024.png
SRC_DARK=art/icon/beside-cue-icon-dark-1024.png
SRC_TINTED=art/icon/beside-cue-icon-tinted-1024.png
SRC_DISC=art/icon/beside-cue-disc-1024.png

for f in "$SRC" "$SRC_DARK" "$SRC_TINTED" "$SRC_DISC"; do
  [ -f "$f" ] || { echo "missing master: $f" >&2; exit 1; }
done

command -v magick >/dev/null || { echo "ImageMagick (magick) required" >&2; exit 1; }

say () { printf '  %s\n' "$1"; }

# --------------------------------------------------------------------
# iOS
# --------------------------------------------------------------------
IOS=ios/App/App/Assets.xcassets/AppIcon.appiconset
mkdir -p "$IOS"
echo "iOS"

# -alpha off, then -background, then -flatten: three ways of saying the
# same thing, because a PNG that merely looks opaque can still carry an
# alpha channel and that is what the validator reads.
magick "$SRC" -background white -alpha remove -alpha off \
  -quality 100 "$IOS/AppIcon-512@2x.png"
say "AppIcon-512@2x.png (light, opaque)"

magick "$SRC_DARK" -background black -alpha remove -alpha off \
  -quality 100 "$IOS/AppIcon-dark-1024.png"
say "AppIcon-dark-1024.png"

# Greyscale by VALUE, sRGB by colorspace. A PNG actually tagged Gray is
# a different beast to an asset catalog than an sRGB one that happens to
# be grey, and only one of them is worth handing to Xcode.
# png:color-type=6 is the part that matters: -colorspace sRGB alone does
# nothing here, because ImageMagick still writes a greyscale PNG when
# every pixel happens to be grey. Forcing RGBA is what actually hands
# Xcode an sRGB file.
magick "$SRC_TINTED" -colorspace sRGB -define png:color-type=6 \
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
RES=android/app/src/main/res
echo "Android"

# Adaptive foreground: a 108dp canvas whose outer 18dp on every side is
# reserved for the launcher's mask and its parallax shift, leaving an
# inner 72dp that is always visible. The mark is itself a circle, so it
# can go right out to that 72 -- 70 keeps a dp of air against the
# parallax without making it look timid, which 66 did.
ADAPTIVE_DP=108
SAFE_NUM=70
# Legacy launcher: 48dp, art to the edge, the launcher does not mask it.
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

  magick "$SRC_DISC" -resize "${safe}x${safe}" \
    -background none -gravity center -extent "${adaptive}x${adaptive}" \
    "$dir/ic_launcher_foreground.png"

  magick "$SRC" -resize "${legacy}x${legacy}" -alpha off \
    "$dir/ic_launcher.png"

  # The round variant is masked here rather than left to the launcher,
  # because a launcher that asks for ic_launcher_round expects a circle
  # and will not cut one for you.
  half=$((legacy / 2))
  magick "$SRC" -resize "${legacy}x${legacy}" \
    \( +clone -alpha transparent -fill white \
       -draw "circle $half,$half $half,0" -alpha extract \) \
    -alpha off -compose CopyOpacity -composite \
    "$dir/ic_launcher_round.png"

  say "mipmap-$density: foreground ${adaptive}px (art ${safe}px), launcher ${legacy}px"
done

# The adaptive icon's background is a flat brand colour, so the
# foreground can stay a bare disc with no field of its own and never
# show a seam against it.
cat > "$RES/values/ic_launcher_background.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFF5DD</color>
</resources>
XML

# Point the adaptive icon at the mipmap PNGs. It shipped pointing at a
# placeholder vector in drawable/, which meant the mipmap foregrounds
# next to it were dead files -- @drawable and @mipmap do not share a
# namespace, so nothing was ever reading them.
for name in ic_launcher ic_launcher_round; do
  cat > "$RES/mipmap-anydpi/$name.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
XML
done
say "mipmap-anydpi/*.xml -> @mipmap/ic_launcher_foreground"

# --------------------------------------------------------------------
# Web
# --------------------------------------------------------------------
WEB=public/icons
mkdir -p "$WEB"
echo "Web"

# Transparency is fine everywhere here except apple-touch-icon, which
# iOS composites onto black -- so that one is flattened.
# Re-quantised after the resize, not before: scaling a 48-colour image
# interpolates its way back to thousands, and a 512 favicon has no
# business being most of a megabyte.
for size in 16 32 48 192 512; do
  magick "$SRC" -resize "${size}x${size}" +dither -colors 64 \
    "$WEB/icon-${size}.png"
done
say "icon-{16,32,48,192,512}.png"

magick "$SRC" -resize 180x180 -background white -alpha remove -alpha off \
  +dither -colors 64 "$WEB/apple-touch-icon.png"
say "apple-touch-icon.png (180, opaque)"

magick "$WEB/icon-16.png" "$WEB/icon-32.png" "$WEB/icon-48.png" public/favicon.ico
say "favicon.ico (16+32+48)"

# --------------------------------------------------------------------
# Store uploads — not shipped in any build
# --------------------------------------------------------------------
STORE=build/store-icons
mkdir -p "$STORE"
echo "Store uploads (build/store-icons, gitignored)"

magick "$SRC" -resize 512x512 -background white -alpha remove -alpha off \
  "$STORE/play-store-512.png"
say "play-store-512.png (upload in Play Console)"
magick "$SRC" -background white -alpha remove -alpha off "$STORE/app-store-1024.png"
say "app-store-1024.png (App Store takes this from the build; kept for reference)"

echo
echo "Done. Commit the generated files -- they are build inputs, not build output."
