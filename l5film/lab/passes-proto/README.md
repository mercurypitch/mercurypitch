# The final passes, proved on two scenes (20 November)

How the final passes fix what DECISIONS 189, 201, 203, 224, 225, 227 and 234 sent to them, made the
tools' behaviour (`tools/merc-shots.py --final` and the options logged in `tools/CHANGES.md`) and
shown on S8 and S14 at 30 fps on today's clock, with one 60 fps chunk. Everything here is a lab:
the film's passes, shots, scenes and root were only read (`tools-before/film-files.sha256` holds
their hashes from before the work; all 75 still match).

## What the final profile does

| Item | What | Constants (`tools/merc-shots.py`) |
| ---- | ---- | --------------------------------- |
| 1 | A breath in before a phrase: the mouth opens 0.15 s before the first word after every pause of 0.25 s or more. A blink in the pause: the talker's 0.10 s after the voice stops, the listener's after it, wherever the renderer's blinks reach | `PAUSE_MIN` 0.25, `BREATH_IN` 0.15, `BLINK_AFTER` 0.10, `BLINK_PAIR` 0.03, `PAIR_MIN` 0.50, `BREATH_STEP` |
| 2 | A talk cycle: the mouth opens and shuts 5.5 times a second from each word's start | `TALK` (hz 5.5, open 0.70, gain 0.55, power 0.6) |
| 3 | Eyes at rest from 0.2 s before every cut to 0.2 s after it | `CUT_CLEAR` 0.20 |
| 4 | S14's chunks at 400 (300 px drawn), as S15's | `CHUNK_SIZE_FINAL` |
| 5 | 60 fps; every film frame 7.5 ms from a pass-frame boundary | `FINAL_FPS` 60; `tools/merc-tags.py` `MARGIN_MS` 4 |

The renderer is the pinned one: nothing in the bundle changed. A state's blinks run from its start
(`sing` 2.7 s in, `idle` 1.1 s), so a cue of the state a host is already in puts a blink where it
is wanted; the talk cycle and the breath in are the line's envelope written again
(`talk/<line>.env.json`).

## What was measured

**S8's holds** (`measure.py render`, the scene from its own time 0; `s08-before/`, `s08-after/`):

| | Holds | A 30 s | Longest | Holds of 0.3 s or more |
| - | ----- | ------ | ------- | ---------------------- |
| Before | 2.6 s (14) | 3.8 s | 0.4 s | 0.00 (0.3 s, before the chapter card); 5.80 (0.3 s, between "easy." and "If"); 8.80 (0.4 s, between "unlocked." and "Let"); 14.00 (0.3 s, between "quietly," and "and") |
| After | 1.2 s (8) | 1.8 s | 0.3 s | 0.00 (0.3 s, before the chapter card) |

`s08-*/holds.txt` gives every 0.1 s sample with the largest change in Merc's square, in Tavi's and
in the rest of the frame, and the word being said.

**The talk cycle at S8 7.7 to 8.1 s** (the largest change of any pixel in Merc's square, a 0.1 s
sample, at measure.py's scale): before 8, 7, 6, 10; after 38, 39, 37, 19. Over Merc's two lines
(151 samples) his own pixels change by less than 16 in 31 samples before and 12 after.

**The S6 to S7 cut** (`item3-eye-turn.md`): from 0.2 s before the cut to 0.2 s after it the eyes'
largest move in a frame is 1.13 px before (a blink starts at 171.45 and `listen` cuts it on the
cut) and 0.12 px after (`listen` starts at 171.695).

**The cut on `end`** (`cut-end-*/cutbox.txt`; the hosts' squares on the last S14 frame and the first
S15 frame, draft-quality clips on the film's own frames):

| Clip | S14's chunks | S15's chunks | Merc: gradient, fine detail | Tavi: gradient, fine detail |
| ---- | ------------ | ------------ | --------------------------- | --------------------------- |
| `cut-end-before` | the film's, 225 px | the film's, 300 px | +3.9 %, +12.3 % | +4.9 %, +11.6 % |
| `cut-end-a` | final, 300 px | the film's | -1.4 %, -6.8 % | -0.7 %, -6.6 % |
| `cut-end-b` | final, 300 px | final, 300 px | -1.5 %, -6.8 % | -0.7 %, -7.5 % |
| `cut-end-c` | final, 300 px, drawn as S15 draws (`base` 400, in the lab's copy of the scene) | final | -0.4 %, +0.3 % | +0.1 %, +0.6 % |

The body boxes: on `cut-end-before` Tavi's narrows 3 px on the cut (150 x 187 to 147 x 186: the
softer chunk's edge reads wider) and Merc's 1 px; on `cut-end-b` and `-c` both stay within 1 px
(Merc 143 x 184 on both frames of `-b`). In `cut-end-a` Tavi's differs by 2 px each way: S14 is
the final performance and S15 the scratch one, so the pose is not the same frame.

**60 fps** (`final60/`, `f60-s04/`): m-blue-s04 rendered at 60 fps (456 frames, 204 ms a frame).
A copy of it with each frame's number written in (`coded.py`), shown in S4 on the film's own
frames at 60 fps: all 419 film frames from Merc's landing to the scene's end show their own pass
frame (`f60-s04/read.txt`); with the pass's first frame set one off, none does. `final60/margins.txt`:
all 63,925 film frames of the 27 tags sit 7.50 ms or more from a pass-frame boundary; today's
30 fps passes in a 60 fps render sit 0.17 ms from one (`margins-today.txt`).

**The final run** (`final60/plan.md`): 27 jobs (25 chunks and the S1 pair), 63,998 frames, about
4.2 hours one render at a time on this machine (4.0 to 4.7 by the frame times measured here).

## What a person should look at

- `s08-after/clip.mp4` against `s08-before/clip.mp4`: does the talk read as talk (not chewing, not
  singing), and do the blink and the breath in read as a host pausing?
- `item1-idle.png`, `item2-talk.png`, `item5-60fps.png` (strips of the passes' own frames).
- `cut-end-b/clip.mp4` and `cut-end-c/clip.mp4` at the cut (15.9 s), against `cut-end-before/clip.mp4`.

## Files

| Path | What |
| ---- | ---- |
| `shots/`, `talk/`, `final-report.md` | The final profile's shots at 30 fps on today's clock, the talk envelopes, and every pause with what each host does in it |
| `merc/` | The lab's chunks: m-blue and m-orange for s08, s14 and s15 (30 fps, final profile) |
| `final60/` | The same shots at 60 fps (`shots/`, `talk/`, `final-report.md`), the 60 fps chunk (`merc/`), its numbered copy (`merc-coded/`), `margins.txt`, `plan.md`, `PASSES.md` (the guide as the final run will write it) |
| `s08-before/`, `s08-after/` | S8's lab clips, `measure/`, `holds.txt` and `holds.csv` |
| `cut-end-before/`, `-a/`, `-b/`, `-c/` | The cut on `end`: clips, `cutbox.txt`, `pair.png` |
| `eye-turn/`, `item3-eye-turn.png`, `item3-eye-turn.md` | Merc's pass frames across the S6 to S7 cut |
| `f60-s04/` | S4 at 60 fps with the numbered chunk, `read.txt` |
| `pin-check/` | Three frames of today's m-blue from the changed `merc-pass.mjs`: byte for byte the film's dumps |
| `defaults-check/` | The tools' default outputs written aside: the same as the film's |
| `tools-before/` | The six tools as they were, their hashes, and the film files' hashes |
| `protolab.mjs` | A lab clip of scene copies with the lab's chunks (`--film`: the film's own frames) |
| `holds.py`, `passmotion.py`, `strip.py`, `eyestill.py`, `cutbox.py`, `coded.py` | The measures and sheets above; each file's header says how to run it |
| `run-chain.sh`, `run-clips.sh`, `logs/` | The renders in order, one at a time through the heavy helper, and their logs (`logs/round1/`: the first round, before the arcs were keyed by phrase) |
