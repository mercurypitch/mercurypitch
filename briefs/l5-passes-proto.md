# Brief: the final passes, proved on two scenes first (Lesson 5's film)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer (read-only)

The film's picture and sound are accepted. The hosts' passes (Merc and Tavi, the app's WebGL Merc
rendered to alpha WebM per scene chunk) are 30 fps passes on the scratch voices' clock. The final
passes come after the owner's voices: 60 fps on the final clock, about 4 to 5 hours of rendering.
Before that, this step settles how the final passes fix what the decisions sent to them, so the
final run is one pass with no surprises. Prove it on S8 and S14 at 30 fps on today's clock.

## Read first
- `P/merc/PASSES.md` (generated: the passes, the chunks, the performances) and the tools it
  names: `tools/merc-shots.py`, `merc-pass.mjs`, `merc-queue.py`, `merc-roots.py`, `merc-joins.py`,
  `merc-passes.py`, `merc-tags.py`, `merc-whole.py`, `merc-sheet.py`. Read each before you run it.
- `P/STORYBOARD.md` § Merc performances; `P/BUILD-GUIDE.md` on the passes.
- DECISIONS 128 to 131, 160 to 163, 189, 190, 201, 203 (the eye turn at the S6 to S7 cut, about
  line 1529), 224, 225 (S14's chunk size; 60 fps), 227 and 234 (`L.passFrame`).

## What the final passes must do
1. **A visible idle in every pause over 0.25 s** (189): a breath or a blink, so a host's stillness
   in a pause never reads as a frozen frame. measure.py counts a hold when no pixel changes by 16 or
   more for 0.1 s, so the idle must move pixels by that much at the hosts' smallest drawn size
   (225 px).
2. **A talk cycle that registers at 225 px** (201): at S8 7.7 to 8.1 s no pixel changed by 16 or
   more while Merc talked. The mouth and the arcs must change visibly at that size, never in a way
   that reads as shouting or singing.
3. **The S6 to S7 eye turn** (the decision near DECISIONS line 1529): start Merc's turn toward Tavi
   on the far side of the cut, so a matched cut never carries a moving eye.
4. **S14's chunks at S15's resolution** (225): render S14's hosts as S15's (300 px drawn), so the
   cut on `end` does not sharpen them.
5. **60 fps with no film frame on a pass boundary** (224, 225, 234): say how the final run
   guarantees it, and prove it with one 60 fps chunk.

## The work
- Make 1 to 4 the tools' behaviour for the final run. Keep the performances' character
  (STORYBOARD § Merc performances); name every constant you change and why.
- **Do not touch the film's current passes**: `merc/shots/` and `assets/merc/` stay as they are,
  and so do the root's tags, so the film still renders as it does now. Write everything to
  `P/lab/passes-proto/`: shots, chunks, sidecars, clips, measures. If a tool cannot write
  elsewhere, add an output option; log each tool change in `tools/CHANGES.md`.
- Render on today's clock at 30 fps, in a copy of the scene for the lab, never the film's own files:
  - S8's two chunks (m-blue-s08, m-orange-s08), then S8's lab clip with them;
  - S14's two chunks at the new size, then the cut on `end` against S15's current chunks;
  - one 60 fps chunk: the shortest one that shows a pause idle and a talk.
- Measure with `python3 SKILL_DIR/scripts/measure.py render` on S8's clip, before and after: the
  holds per 30 s, the longest, and every hold of 0.3 s or more with the words around it. The talk
  cycle's pixel change at S8 7.7 to 8.1 s. The cut on `end`: the hosts' boxes either side.
- Estimate the final run: chunks, frames and render hours at 60 fps on this machine, and in what
  order the chunks should render.

## Rules
- Every render and measure through `$S/bin/heavy`, one at a time. Read any script before running it.
- Never production. No voice, image, video or music service. No attribution, emojis or model names
  in any file. Do not commit or push.
- Edit only the passes' tools (with output options, never breaking today's outputs) and
  `P/lab/passes-proto/`. Do not edit the scenes, the kit, the cues, the passes in `assets/merc/`,
  `merc/shots/`, `index.html`, or the documents; name the numbers they should carry.

## Hand back
- Per item 1 to 5: what changed (file and line), the constants before and after, and a frame
  pair or strip under `P/lab/passes-proto/` that shows it.
- S8's holds before and after.
- The talk cycle's change at 225 px, and the `end` cut's numbers.
- The 60 fps proof and the final run's estimate and order.
- What a person should look at: the idle's character, and whether the talk reads as talk.
