# Brief: integration of Lesson 5's film (the kit's fixes, then the whole film rendered and measured)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer (read-only)

All fifteen scenes are built, criticised once and fixed once (DECISIONS 164 to 214 and on). This
step makes the fixes that belong to the kit, so every scene gets them, and then renders the film
whole for its first full-film critic. It starts only when no scene builder is editing. The director
names which part you do; if you are given both, do part 1 first.

## Part 1: the kit's fixes (every scene sees them)
1. **Merc's root from the video tag** (DECISIONS 214): `L.mercGate` counts its index from the root
   table about 1.4 frames behind the pass frame the renderer shows (t - data-start +
   data-media-start), which snapped Merc 50 px for 3 frames at hop 2. Take the root's start from
   the tag, as s13's local `rootFromTag` does; then remove s13's local copy. Re-check every chunk
   whose root moves (merc/PASSES.md, `assets/merc/roots.js`) frame by frame through its move.
2. **The chapter card's glyph snaps** (DECISIONS 202): the card's breathing scale steps glyphs on
   the pixel grid (s11 at 0.800 and 1.467, the same in S8 and S10). Draw the breathing so the raster
   does not step (sub-pixel positions, or a composited transform); prove it on every chapter card
   with measure.py's events and a frame strip.
3. **`L.TRACE.STACK`'s duplicate `h`** (DECISIONS 191): the half-height (70) and the "h" glyph's
   label share the key. Rename the glyph's key; S9 then drops its local 70. `L.TRACE.RECAP` (S13)
   must not change.
4. **The Voice Mirror panel's foot** (DECISIONS 214): `L.RECAP.VM.panel.feet` rises 10 px or more,
   so S13's ten line (ink y 796 to 827) has 16 px or more under the panel; the panel's own lines
   keep their padding.
5. **The bokeh's lift on camera moves** (DECISIONS 200; critic C-01 item 12): at normal exposure
   S10's push reads as a zoom and its truck as a pan, because the parallax between the depth layers
   only shows with the shadows lifted. `L.BOKEH_LIFT` (3) and its ramp by slide speed (frames.js) are
   one setting for the whole film: look at every camera move in STORYBOARD § Camera plan, and set
   the lift so each move reads as itself (a push's layers part, a truck's slide past at their own
   speeds) without the room flashing or brightening between moves (DECISIONS 171, 172). Prove each
   move with frame pairs at its start, middle and end.
6. **The page's "settled" rule as one kit function**: s10 and s13 each compute it (16 ms readings,
   within 35 c for 0.5 s). Put it in the kit and switch both scenes to it; the flags must not move
   (S10: entry 0.704 s, world x 478.8; S13: x 334.5, at the line's 1.204 s).

The kit's `backPad` default stays as it is (DECISIONS 182).

**Edits allowed**: `assets/lib/`, and in scenes only the swaps named above (s09's local 70, s13's
`rootFromTag`, s10's and s13's settled code). Log every change in `tools/CHANGES.md` with its
before and after. **Proof**: the kit labs' probe (`lab/kit-src/probe.mjs`), then every scene's
probe and `check` (0 errors) and clock-lint, through `$S/bin/heavy` one at a time; each fix's own
stills or frame pairs under `P/lab/integration/`.

## Part 2: the whole film
1. If any scene's length changed, `tools/gen-root.py` (read it first; it must leave every scene
   file as it is). `merc-tags.py --check` over all scenes.
2. Render the root (`index.html`) at 1920x1080, 30 fps, with the scratch voice mix (the `full` mix
   does not exist yet) through `$S/bin/heavy`, to `P/renders/film-draft-01.mp4`. `check` (0 errors)
   before the render.
3. `python3 SKILL_DIR/scripts/measure.py render` on it, to `P/review/film-01-measure/`: holds per
   30 s, the longest hold and where, every event with its time and what it is, loudness.
4. **Every cut** (the scene table in `assets/scenes.js`): the last frame before and the first after,
   their difference outside the hosts' boxes, and the hosts' boxes on their own (a matched cut must
   carry its object to 2 px; a plain cut changes only what the board says). One table, one row a cut.
5. A contact sheet of the film (one frame every 2 s) and the film's length.

## Rules
- Every heavy job through `$S/bin/heavy`, one at a time. Never production. No voice, image, video or
  music service. No attribution, emojis or model names in any file. Do not commit or push.
- Do not edit STORYBOARD, HANDOFFS, LAB-CHECKS, DECISIONS, script.json or the cues; name in your
  hand-back any number a document should carry.

## Hand back
Per kit fix: file and line, before and after, the proof's path. Every scene's probe count and
`check` result. For part 2: the film's length, measure.py's summary, the cuts table, the contact
sheet's path, and anything that did not go as written.
