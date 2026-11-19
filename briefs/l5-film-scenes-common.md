# Brief: Lesson 5's film, the scenes (common to every scene group)

You build one group of scenes of the film of Find Your Pitch, Lesson 5, "Breath and a steady
note": each scene as its own HyperFrames sub-composition on the film's one clock, on the shared
kit, proven in its lab. Your group's own brief names your scenes and anything particular to them.

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
R = /home/user/mercurypitch/.claude/worktrees/fix (read-only checkout of main; never change it,
never run pnpm there)
P = $S/l5film (the film's HyperFrames project)
SKILL_DIR = R/.claude/skills/motion-designer

## Rules
- Write only your scenes' files: `P/compositions/<scene-id>.html`, `P/lab/<scene-id>/` (stills,
  clips, `BUILD-NOTES.md`). Another builder works on another group at the same time.
- Never edit the kit (`P/assets/lib/`), the tools, STORYBOARD, HANDOFFS, LAB-CHECKS, DECISIONS,
  BRIEF, FACTS, script.json or cues. If the kit lacks something or the board cannot be built as
  written, build the smallest local version in your scene, say so in your hand-back with the
  numbers, and the director decides (and may promote it into the kit for everyone).
- Every heavy job (a lab render, a clip, a Chromium pass) through `$S/bin/heavy <command>`, one at
  a time. Merc's passes render on the same cores.
- Every animated value is a function of timeline time only (no timers, no unseeded randomness, no
  `repeat: -1`); every time comes from the clock (`L.at`, `L.word`, `L.dur`), never a typed second
  but 0 and the scene's length. `tools/clock-lint.py` must print nothing for your files.
- No voice, image, video or music service. No attribution, no emojis, no model names in any file.
- On screen only what FACTS and the board say; every number and claim is the board's.

## Read first
1. `P/BUILD-GUIDE.md`, all of it: the clock, your files, the scene skeleton, the rules that cost a
   render, the kit table, proving a scene.
2. Your scenes' rows in `P/STORYBOARD.md` (the section your group brief names), its § Persistent
   actors, § Codes, § Type and § Build checks for your scenes; `P/HANDOFFS.md` for your scenes,
   § Shared formulas, § Framings, § Camera moves, § The cuts (your first and last frames are fixed
   there), § Provisional values; `P/LAB-CHECKS.md` lines that name your rows.
3. The kit headers you call (`P/assets/lib/*.js`: every option is documented there), the kit's lab
   pages in `P/lab/kit-src/` (working examples), and `P/merc/PASSES.md` for the hosts (which pass and
   chunk, how a scene places it, `assets/merc/roots.js`).
4. `SKILL_DIR/SKILL.md` § 3, § 5, § 10 and `references/shot-grammar.md` for the shots your rows
   name.

## Build
- One sub-composition per scene, in the skeleton BUILD-GUIDE shows, loading the kit through the
  root's script list.
- Carried objects land on the same pixels on both sides of every cut (HANDOFFS § The cuts): prove
  it with stills of your first and last frames, within 2 px.
- Every framing your scene lands is where HANDOFFS § Framings puts it: a still at each landed
  framing. Every camera move shows its tell (the layers part on a push or pull).
- Hosts from their passes, placed as PASSES.md says; a pass not rendered yet shows as the kit's
  placeholder, and `check`'s missing-pass finding is the one expected finding.
- The board's motion rules hold: things land slowly enough to read and leave fast; no two landings
  closer than the board's 0.4 s rule unless the board says so; the frame never stops and starts all
  at once.

## Prove
For each scene: lab stills at the times its Build checks and LAB-CHECKS lines name, at its first
and last frames and at each landed framing; a 30 fps draft clip of the whole scene (or of each
part, for a scene over 40 s) with its sound; `measure.py render` on the clip; the root `check`
(0 errors bar missing passes); clock-lint silent; `merc-tags.py <scene-id> --check` once passes
exist. Look at every still yourself before you hand back.

## After you hand back
The director sends your group's labs to one fresh critic (a component round) and gives you its
report to fix. Keep your lab folders where a critic can find them.

## Hand back
Per scene: the file, the rows built and the anchor (cue or word) each row keys off, the stills and
clips by path, the handoff and framing checks with their numbers, measure.py's summary, what you
could not build as written (with numbers), what you built locally that the kit might offer, any
provisional HANDOFFS value you confirmed (with the still), and open questions.
