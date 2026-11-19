# Brief: the passes step again, for DECISIONS 190 (Merc's hops back at the recap's clean break)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Read DECISIONS 190 (it amends 160, which you built). In the `card` pause Merc's hops cross the
Voice Mirror card while the viewer reads it, so the hops go back to the recap's clean break, in a
new silent beat. Groups B to D are building or fixing scenes from s05 to s12 while you work, and
they render with `assets/cues.js`, `assets/audio/voice.wav` and the passes: nothing they read may
change under them, and nothing before b55 may change at all.

## Steps
1. **The script**: insert `{"id": "break", "type": "pause", "dur": 1.9, "gap": 0.0}` into
   `P/script.json`'s events directly before b55 (b55 keeps its 0.3 s gap). Change nothing else.
2. **The clock, written aside**: run `tools/cues.py --no-tts` in a scratch copy of the project
   (what it reads: script.json, tools/, assets/voice-kokoro/, assets/voice/), then compare its
   cues.json with P's: every cue before b55 identical to the millisecond (start, end, words), every
   cue from b55 on 1.9 s later, `break` new. Only then move the new `cues.json`, `assets/cues.js`,
   `assets/audio/voice.wav` and `PACING.md` into P, each by a rename on the same filesystem, so no
   render ever reads a half-written file. Keep the old four as `*.pre190` beside them.
3. **The shots**: `tools/merc-shots.py` writes `merc/shots/*.json` from the new clock. Before the
   queue sees them, prove for every chunk from s03 to s12 (and m01) that its events and frames are
   unchanged from the old shot files (keep the old ones as `merc/shots/*.pre190`); a chunk whose
   shots did not change must not be rendered again. The queue decides "done" by the pass's shot
   file's time, so it would re-render every chunk: do not run the queue. Render only the s13, s14
   and s15 chunks of m-blue and m-orange with `tools/merc-pass.mjs --chunk=<id> --dump=...` (the
   queue's own arguments, `merc-queue.py --list` shows them), each through `$S/bin/heavy`, one at a
   time. Then `touch` the unchanged chunks' WebMs and sidecars, so a later queue run sees them as
   done, and say which you touched.
4. **Prove**: `merc-shots.py --check` silent; the hop pair inside `break` (hop 1 at its start +
   0.60, hop 2 at + 1.25, the state ending at + 1.91) and no line or sound touching it (the tool's
   own assertion); Merc at (110, 840) before and (1290, 840) after, the root's x cancelled as
   PASSES.md says; `merc-roots.py`; `merc-joins.py` for the s12 to s13, s13 to s14 and s14 to s15
   boundaries (byte-equal shared frames as before); a frame sheet of the hops.
5. **The tables**: `tools/gen-root.py` (only s13 to s15 change; read it first and confirm it leaves
   every built scene file as it is: groups B to D are editing s05 to s12), `tools/chapters.py`, then
   `tools/merc-passes.py` (PASSES.md: the hops now in `break`), and `tools/merc-tags.py` for s13 to
   s15 only if those scenes have tags (they are placeholders now). Skip `captions.py` and `mix.py`:
   both still stop on Lesson 4's sounds until the sound step.

## Rules
- Heavy jobs through `$S/bin/heavy`, one at a time. Never production. No voice, image or music
  service. No attribution, emojis or model names in any file.
- Edit only script.json (the one event), the generated files above, and `merc/`'s outputs. Never a
  scene, the kit, STORYBOARD, HANDOFFS or DECISIONS (the director keeps those).

## Hand back
The cue comparison (how many cues unchanged, how many moved, by how much), the shot comparison per
chunk, the chunks rendered (frames, time), the chunks touched, the joins' result, the hop frames
(path to the sheet), the new film length, and anything that did not go as written.
