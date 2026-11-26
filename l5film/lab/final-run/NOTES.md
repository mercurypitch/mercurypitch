# Lesson 5's final run: notes to resume from (brief `briefs/l5-final-run.md`)

The log of record is DECISIONS from 257 on, `tools/CHANGES.md` (26 November, the final run) and the
last row of `LEDGER.md`. This file says where the run is and how to pick it up. Everything is run
from the film's root (`l5film/`), every heavy job through `$S/bin/heavy`, one at a time.

## Where the run is

| Step | What | State |
| ---- | ---- | ----- |
| 0 | Copies of everything the run rewrites: `lab/final-run/before/` (the 15 scene files, `merc/`, `assets/merc/` as `assets-merc/`, `index.html`, `scenes.js`, `review/merc/`, the ten tools; `before.sha256`) | done |
| 1 | `MIX=full python3 tools/gen-root.py`, in place: the 13 root `data-duration` values of DECISIONS 252, nothing else (`logs/01-gen-root.txt`); `check`: 0 errors, 24 standing warnings (`logs/01-check-after-gen-root.txt`) | done |
| 2 | `merc-shots.py --final` on the voiced clock | next |
| 3 | The 27 jobs, joins, tags, roots, guide, sheet | |
| 4 | The 60 fps render | |
| 5 | The measure | |
| 6 | The deliverables | |

## How to resume

- The queue is resumable: `python3 tools/merc-queue.py --order=final --list` shows what is done; the
  same command without `--list`, detached (`setsid nohup ... > merc/queue.out 2>&1 &`), renders the
  rest. A job is done while its WebM and sidecar are newer than its shot file, so never touch
  `merc/shots/*.json` after the queue starts unless that pass is meant to render again.
- One scene's passes alone (a retake of a line): see "A retake" below.
