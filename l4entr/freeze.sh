#!/bin/bash
# Freeze the live Lesson 4 project for a film render: copies of the root files and compositions/,
# symlinks to assets/ and .transcode-cache, and checksums of both (compositions.md5 relative, run from
# compositions/; kit.md5 absolute, every assets file but voice/). Usage: bash freeze.sh <dir>
set -eu
D=${1:?target dir}
P=/home/user/mercurypitch/output/motion/lesson-04
[ -e "$D" ] && { echo "exists: $D"; exit 1; }
mkdir -p "$D/compositions" "$D/renders"
cp -p "$P"/index.html "$P"/hyperframes.json "$P"/meta.json "$P"/package.json "$D"/
cp -p "$P"/compositions/*.html "$D"/compositions/
ln -s "$P/assets" "$D/assets"
ln -s "$P/.transcode-cache" "$D/.transcode-cache"
(cd "$D/compositions" && md5sum *.html > ../compositions.md5)
find "$P/assets/" -type f ! -path "$P/assets/voice/*" -print0 | sort -z | xargs -0 md5sum > "$D/kit.md5"
echo "frozen $D: $(wc -l < "$D/compositions.md5") compositions, $(wc -l < "$D/kit.md5") kit files"
for f in "$P"/compositions/*.html; do cmp -s "$f" "$D/compositions/$(basename "$f")" || echo "MISMATCH $f"; done
