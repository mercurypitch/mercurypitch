# Brief: Lesson 5's film, production step 2: the lead's answers, then Merc's passes

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
R = /home/user/mercurypitch/.claude/worktrees/fix (read-only checkout; change nothing, never pnpm)
P = $S/l5film

The rules of step 1 hold: write only in P; every heavy job through `$S/bin/heavy`, one at a time
(one other heavy job shares the machine); no voice, image, video or music service; no
attribution, no emojis, no model names in any file. Do not edit STORYBOARD, HANDOFFS, LAB-CHECKS
or script.json. Append to DECISIONS.md (next free number; the lead's last is 125) and log every
tool change in `tools/CHANGES.md`. Leave `assets/lib/` to the kit step (read it, do not grow it):
another builder will write the kit there later.

## 1. The lead's answers to your six questions
1. **Tavi's scratch speed: 0.78** (from 0.9; about 180 words a minute while speaking, nearer the
   board's word-rate pace, which is the best guess at the final voices). Speak her 15 lines again;
   Merc's takes stay. Re-run the clock, PACING.md, SCRIPT.md, chapters, voice.wav and the root.
   Report the new total and each act's shift against the board. No placeholder render needed.
2. **Freeze the board clock now** as `board-cues.json`, from the script.json the board was timed
   on (it has not changed), and make `board-clock.py` read the frozen file. A later change to
   script.json goes through the lead, who re-times the board on purpose.
3. **Chunks are this step's** (below).
4. **Keep `MIX=voice`** until the sound step.
5. **Keep Lesson 4's 0.2 s tail** (the end card runs 6.20 s on a voiced clock).
6. **Pin them**: every pass of this film renders on Chromium 1243 under Playwright 1.63.0, from
   the bundle built at b5ddaf2d7 (`assets/merc-lib/BUILD.json`). Write it in DECISIONS. If the
   app's Merc renderer changes on main before the final passes, the lead decides.

## 2. Merc's passes, on the scratch clock
Read `STORYBOARD.md` § Merc performances (three performances, its scoring notes), § Persistent
actors, the host rows in the shot tables, HANDOFFS' host positions and sizes, Lesson 4's
`merc-shots.py`, `merc-tags.py`, `merc-whole.py` and `merc-pass.mjs` (now in `P/tools/`), and
PRODUCTION-PIPELINE § 3 and § 4 (the Merc traps, 5, 9, 14 and 15 among them).

1. **Shots.** Adapt `merc-shots.py` to Lesson 5: the m01 pair (S1, 0 to 37.95, both slide out
   37.30 to 37.90, at 420; neither sings in S1), m-orange (from her leap, opening 1.38 s before
   o3, to past the film's end) and m-blue (from his leap, opening 1.38 s before b6, to past the
   end, his two hops at the recap's clean break). Scoring as the board says: `sing` from 0.15 s
   before to 0.15 s after the host's own sound; talk on the host's lines; `listen` while the other
   talks; `idle` otherwise; every `sound` event with no singer (`easy`, `pushed`, `push`, the
   starts, `starts`) leaves both idle and turned to the drawing; in `hold` both idle with no arcs;
   nobody `listen`s to the viewer. Time everything from cues (board times map through
   `board-clock.py`), never typed seconds. Write `merc/shots/*.json`.
2. **Chunks.** Give `merc-pass.mjs` a frame range (start frame and count, or from and to), and
   make `merc-tags.py` understand chunked passes. Cut each long performance into chunks at scene
   boundaries, each rendered at the largest size it is shown at (300 for S4, S5 and S10 to S14;
   300 for S6 to S9, shown at 240; 400 for S15; 420 for the m01 pair). Prove the chunks join: at
   two boundaries the first frame of chunk k+1 equals the same frame rendered inside one straight
   range (pixel-identical, or say the difference).
3. **Render** the passes as straight-alpha WebM through the heavy helper, longest first (trap 9),
   at **30 fps** for the build's labs and critic rounds; the final 60 fps passes come after the
   final voices re-time the film. Log each pass's frames, size and time a frame.
4. **Look** at stills, and put them on one contact sheet: both leaps (in the air and settled),
   the m01 pair talking and listening, the slide-out, each sing with its arcs (Merc's `gauge`,
   Tavi's `demo`, both in `listen`, Merc's `twinkle`), both idle with no arcs in `hold`, Merc's
   hops, and the last frame past the end.
5. **For the scene builders**, write `merc/PASSES.md`: each pass and chunk (file, frames, size,
   first and last cue it covers), where the feet sit in a pass's frame (so a scene can stand a
   host on the floor at y 840), and how a scene places and scales a pass.

## Hand back
The answers done (new total, shifts, the frozen clock); the passes, chunks and render times; the
join proof; the contact sheet's path; PASSES.md; anything a scene builder must know; open
questions.
