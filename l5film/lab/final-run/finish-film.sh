#!/bin/bash
# After render-pieces.sh (DECISIONS 265 to 269): join the 19 pieces, count the frames, mux the two
# soundtracks onto the one picture, check every join against snapshots of the root, take a frame
# from every scene, and measure. Run from anywhere; idempotent.
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P=$S/l5film
cd "$P" || exit 1
H=$S/bin/heavy
LOG=$P/lab/final-run/logs
ST=$P/lab/final-run/finish-film.state
SKILL=/home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$ST"; }
TOTAL=34185; CHUNK=1800; N=19

# 1. the join: stream copy, the pieces in order
ls renders/pieces/piece-0*.mp4 | grep -v tmp | sort > /dev/null
n=$(ls renders/pieces/piece-[0-9][0-9][0-9].mp4 | wc -l)
[ "$n" = $N ] || { note "STOP: $n pieces, not $N"; exit 2; }
for f in renders/pieces/piece-[0-9][0-9][0-9].mp4; do echo "file '$P/$f'"; done > renders/pieces/list.txt
ffmpeg -v error -y -f concat -safe 0 -i renders/pieces/list.txt -c copy -movflags +faststart renders/pieces/picture.mp4 || { note "STOP: concat failed"; exit 3; }
frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 renders/pieces/picture.mp4)
note "joined: $frames frames ($TOTAL wanted), $(du -h renders/pieces/picture.mp4 | cut -f1)"
[ "$frames" = $TOTAL ] || { note "STOP: frame count"; exit 4; }

# 2. the two soundtracks on the one picture: AAC 192k at 48 kHz, as HyperFrames muxes its sound
for v in full:film-final-60 music-only:film-final-60-music-only; do
  ffmpeg -v error -y -i renders/pieces/picture.mp4 -i assets/audio/${v%%:*}.wav -map 0:v:0 -map 1:a:0 \
    -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart renders/${v#*:}.mp4 || { note "STOP: mux ${v%%:*}"; exit 5; }
  note "muxed renders/${v#*:}.mp4: $(du -h renders/${v#*:}.mp4 | cut -f1), $(ffprobe -v error -show_entries format=duration -of csv=p=0 renders/${v#*:}.mp4) s"
done

# 3. every join against single-frame snapshots of the film's root at those frames' times
J=review/final-film/joins; mkdir -p $J
at=$(python3 -c "print(','.join(f'{f/60:.6f}' for k in range(1,$N) for f in (k*$CHUNK-1, k*$CHUNK)))")
rm -rf $J/snap
$H npx --yes hyperframes@0.8.97 snapshot . --at "$at" --no-end -o $J/snap > $LOG/06-snapshots.txt 2>&1
note "snapshots exit $?: $(ls $J/snap/*.png 2>/dev/null | wc -l) frames"
for k in $(seq 1 $((N - 1))); do
  for f in $((k * CHUNK - 1)) $((k * CHUNK)); do
    ffmpeg -v error -y -i renders/pieces/picture.mp4 -vf "select=eq(n\,$f)" -frames:v 1 $J/film-f$f.png
  done
done
python3 lab/final-run/joincheck.py $J > review/final-film/joins.md 2>&1; note "join check exit $?"

# 4. a frame from the middle of every scene
python3 - <<'EOF'
import re, subprocess
for l in open('index.html'):
    m = re.search(r'id="host-(s\d\d[^"]*)".*data-start="([\d.]+)" data-duration="([\d.]+)"', l)
    if m:
        f = round((float(m.group(2)) + float(m.group(3)) / 2) * 60)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'renders/pieces/picture.mp4', '-vf', f'select=eq(n\\,{f})',
                        '-frames:v', '1', f'review/final-film/scene-{m.group(1)}-f{f}.png'], check=True)
EOF
note "scene frames: $(ls review/final-film/scene-*.png | wc -l)"

# 5. the measure, and the effects against the music
mkdir -p review/final-measure
$H python3 $SKILL/scripts/measure.py render renders/film-final-60.mp4 --out review/final-measure --every 5 > $LOG/06-measure.txt 2>&1
note "measure render exit $?"
$H python3 $SKILL/scripts/measure.py audio renders/film-final-60.mp4 --music-only renders/film-final-60-music-only.mp4 --out review/final-measure/audio > $LOG/06-measure-audio.txt 2>&1
note "measure audio exit $?"
note "finished"
