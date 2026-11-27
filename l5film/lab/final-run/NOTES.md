# Lesson 5's final run: notes to resume from (brief `briefs/l5-final-run.md`)

The log of record is DECISIONS from 257 on, `tools/CHANGES.md` (26 November, the final run) and the
last row of `LEDGER.md`. This file says where the run is and how to pick it up. Everything is run
from the film's root (`l5film/`), every heavy job through `$S/bin/heavy`, one at a time.

## Where the run is (updated 26 November 23:55 UTC)

| Step | What | State |
| ---- | ---- | ----- |
| 0 | Copies of everything the run rewrites: `lab/final-run/before/` (the 15 scene files, `merc/`, `assets/merc/` as `assets-merc/`, `index.html`, `scenes.js`, `review/merc/`, the ten tools; `before.sha256`) | done |
| 1 | `MIX=full python3 tools/gen-root.py`, in place: the 13 root `data-duration` values of DECISIONS 252, nothing else (`logs/01-gen-root.txt`); `check`: 0 errors, 24 standing warnings (`logs/01-check-after-gen-root.txt`) | done (257) |
| 2 | `merc-shots.py --final` on the voiced clock, with the lead's additions (DECISIONS 258, `tools/CHANGES.md`; `logs/02-*`); S14's `base` 400 (259); the 54 Merc tags written for the new shots and `--margins` checked (`logs/03-tags-*`) | done: do NOT run merc-shots.py again (it would make every pass stale) |
| 3 | The 27 jobs, roots, joins (23 of 23), tags check (15 of 15), sheet (on `lab/final-run/dump-current/`) | done 04:09 UTC 27 November (263) |
| 4 | The 60 fps picture in 19 pieces (DECISIONS 264: the single render stopped, OOM; 265: the pieces), then the join and the two muxes | `lab/final-run/render-pieces.sh` running; state in `render-pieces.state` |
| 5 | The measure | |
| 6 | The deliverables | |

### Step 3, the queue

- First queue started 19:54:40 UTC; rendered m-blue-s04 (107 s), m-orange-s15 (146 s), m-blue-s15
  (182 s), then a worker restart killed it at 20:21 with m-blue-s13 at 3360 of 4147 frames (its
  `assets/merc/m-blue-s13-merc.part.webm` is that dead job's; the queue renders the chunk again whole).
  Nothing ran from 20:21 to 23:52.
- Resumed 26 November, by `lab/final-run/run-passes.sh` (detached): the queue, then, once every job
  is done, `merc-joins.py`, `merc-roots.py`, `merc-tags.py <scene> --check` for each scene and
  `merc-sheet.py`, each logged in `lab/final-run/logs/03-*`. It writes `lab/final-run/run-passes.state`
  (one line a stage as it finishes). Rerunning it is safe: the queue skips done jobs, the rest
  rewrite their own outputs.
- 27 November 02:02 UTC: 15 of 27 done (through m-blue-s08; times in `merc/render.log`), the queue
  still running; about 36,200 frames left, about 2.4 h.

## How to resume

- `python3 tools/merc-queue.py --order=final --list` shows what is done. If nothing runs
  (`ps -eo args | grep merc-`), start the rest with
  `setsid nohup bash lab/final-run/run-passes.sh > lab/final-run/logs/03-run-passes.out 2>&1 &`.
  A job is done while its WebM and sidecar are newer than its shot file, so never touch
  `merc/shots/*.json` after the queue starts unless that pass is meant to render again.
- One scene's passes alone (a retake of a line): rewrite the shots, then render only that scene's
  chunks: `python3 tools/merc-queue.py --order=final` renders every chunk whose shot file is newer,
  which after a new `merc-shots.py --final` is all of them; to redo one scene alone, render its two
  chunks by hand with the command the queue logs in `merc/queue.out`
  (`$S/bin/heavy node tools/merc-pass.mjs merc/shots/<pass>.json --chunk=<pass>-sNN --dump=...`),
  then `merc-roots.py`, `merc-joins.py` and `merc-tags.py <scene> --check`.

### Steps 4 and 6a, the renders (DECISIONS 262)

- Start, once step 3 is finished, from `l5film/`:
  `HEAVY_PRI=1 HEAVY_MIN_GIB=10 setsid nohup $S/bin/heavy $S/bin/heavy bash lab/final-run/render-final.sh > lab/final-run/logs/04-render-final.out 2>&1 &`
- The music-only sibling project is `$S/l5film-music-only/` (made by this run: `index.html` with
  `music-only.wav`, `meta.json`, `renders/`, the rest symlinks to `l5film/`).
- If the script died (a worker restart): `rm -rf /dev/shm/l5-extract` first (its own frames, about
  5.3 GiB of memory), then start it again; `SKIP_FILM=1` at the head of that command line skips a film already
  rendered (`render-final.state` says "film render exit 0").

### Step 4 in pieces (DECISIONS 265; replaces render-final.sh, which is not to be run again)

- Start or resume, from `l5film/`:
  `HEAVY_PRI=1 HEAVY_MIN_GIB=10 setsid nohup $S/bin/heavy $S/bin/heavy bash lab/final-run/render-pieces.sh > lab/final-run/logs/05-render-pieces.out 2>&1 &`
  It rebuilds the plan in `/dev/shm/l5-plan` (cleared on every exit; if a restart left it, `rm -rf
  /dev/shm/l5-plan` first) and skips every `renders/pieces/piece-NNN.mp4` already there.
- After all 19: concat (stream copy) to `renders/pieces/picture.mp4`, count 34,185 frames, mux
  `assets/audio/full.wav` and `music-only.wav` (AAC 192k, as HyperFrames muxes) to
  `renders/film-final-60.mp4` and `renders/film-final-60-music-only.mp4`; the join check against
  snapshots of the root; then `renders/pieces/` can go (made by this run).
