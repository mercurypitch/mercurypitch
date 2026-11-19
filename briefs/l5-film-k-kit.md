# Brief: Lesson 5's film, the kit (the shared pieces every scene builds on)

You build the kit for the film of Find Your Pitch, Lesson 5, "Breath and a steady note": the room,
the camera, the type and marks, the hosts layer and this film's world, each proven in a lab page
against HANDOFFS, and the build guide the scene builders work from. No scene is built here.

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
R = /home/user/mercurypitch/.claude/worktrees/fix (read-only checkout of main; change nothing in it,
never run pnpm there)
P = $S/l5film (the film's HyperFrames project; the tools and the scratch clock are in place)
SKILL_DIR = R/.claude/skills/motion-designer

## Rules
- Write only in P: `assets/lib/`, `lab/kit-src/`, `lab/kit-*/`, `BUILD-GUIDE.md`, and an appended
  section in `DECISIONS.md` (next free number) and in `tools/CHANGES.md` if you touch a tool.
- Do not edit STORYBOARD, HANDOFFS, LAB-CHECKS, BRIEF, FACTS or script.json. Where the board is
  wrong or cannot be built as written, say so in your hand-back with the numbers; do not redesign.
- Another builder renders Merc's passes in P (`merc/`, `tools/merc-*`) at the same time: read its
  `merc/PASSES.md` when it exists, never write there.
- Every heavy job (a render, a lab clip, a Chromium pass) through `$S/bin/heavy <command>`, one at
  a time; other heavy jobs share this 4-core machine.
- No voice, image, video or music service. No attribution, no emojis, no model names in any file.
- Every animated value is a function of timeline time only: no timers, no unseeded randomness, no
  `repeat: -1`. Any frame renders the same every time.

## Read first
1. The skill: `SKILL_DIR/SKILL.md` (§ 3, § 5, § 9, § 10), `references/hyperframes-bridge.md`,
   `references/shot-grammar.md` (§ 4: a dolly needs parallax between depth layers),
   `references/house-rules.md`.
2. `R/docs/plans/find-your-pitch/PRODUCTION-PIPELINE.md` § 2 to § 4 (the traps bind you), and
   `R/docs/plans/find-your-pitch/MERC-BIBLE.md`.
3. The film: `P/BRIEF.md`; `P/STORYBOARD.md` (The world, Camera plan, Persistent actors, Signature
   moments, Codes, Type, Build checks; skim the shot tables for what the kit must offer);
   `P/HANDOFFS.md` (all of it: Shared formulas, the wave rule, World, Framings, Camera moves,
   Carried from Lessons 1, 2 and 4, The cuts, Provisional values); `P/LAB-CHECKS.md`;
   `P/DECISIONS.md` from "Storyboard v1" on.
4. Lesson 4's backup, `$S/l4film/`: `BUILD-GUIDE.md` (§ The clock, § Your files, § The scene
   skeleton, § Rules that cost a render, § The kit, § Proving a scene, § Builder splits), its kit
   files that survive (`assets/lib/frames.js`, `hosts.js`, `stairs.js`, `scripts.txt`), and its 16
   finished scenes in `compositions/`, which show every kit call the series makes (`L.room`,
   `L.prog`, `L.track`, `L.pulse`, `L.chapterCard`, `L.kicker`, `L.pill`, `L.frameRig`,
   `L.mercGate` and the rest). Its `DECISIONS.md` holds the room's history (89, 93 and 100: the
   bokeh, the dust, the staves and the under layer).
5. What step 1 left in P: `assets/lib/lesson.js` (the clock part: `L.scene`, `L.dur`, `L.at`,
   `L.word`, `L.clock`), `lesson.css`, `scripts.txt`, `fonts.css.txt`, `tools/lab.mjs`,
   `tools/clock-lint.py`, `tools/CHANGES.md`, the placeholder scenes.

## The gap you fill
Lesson 4's `lesson.js` (beyond the clock), `motion.js` and `marks.js`, and Lessons 1 and 2's kit,
were lost with their projects: only `frames.js`, `hosts.js` and `stairs.js` survive. HANDOFFS
§ Carried says the room is Lesson 4's; you rebuild it from what survives: the calls and options in
Lesson 4's compositions, its BUILD-GUIDE's kit table and "Known in the kit" notes, its DECISIONS,
and the numbers in this film's HANDOFFS. The hook's last frame (S1g) must be Lesson 4's S15 tease
frame on the same pixels, which HANDOFFS § Carried gives in numbers. Where the old look cannot be
known (a colour, a blur, a count), choose, write the value and why in DECISIONS, and keep it the
same in every scene.

## What to build
1. **The series kit, rebuilt**, with the same names and signatures Lesson 4's scenes call, so the
   series reads one way: `lesson.js` (the clock part stays; the room with its layers far, mid,
   under, near, top and hud; staves, bokeh and dust as Lesson 4 had them; `L.ease`, `L.rng`
   (seeded), `L.afterFonts`, `L.stage`, `L.bead`, `L.staff`, `L.note`), `motion.js` (`L.prog`,
   `L.track`, `L.env`, `L.pulse`, `L.lit`, `L.echoRings`), `marks.js` (`L.kicker`,
   `L.chapterCard`, `L.ringTimer`, `L.pill`, `L.spell`, `L.bracket`, `L.arrow`, and this film's
   tags as one maker: "ILLUSTRATION", "LISTEN ONLY" and "SLOWED · ILLUSTRATION" at 26 px, the
   board's chip). Only what this film uses; each file's header documents every option.
2. **The camera**: Lesson 4's `frames.js` adapted to this film's framings and moves (HANDOFFS
   § Framings and § Camera moves: F0, F-bead, F-gauge, F-strip, F-hold, CU-scoop, CU-wave, F-turn
   and the rest it names), with the layers parting on a push or pull and moving alike on a pan,
   and the floor and its reflections in screen space with the hosts (board v3, item 6).
3. **The hosts layer**: Lesson 4's `hosts.js` adapted to this film's three performances
   (`merc/PASSES.md` when it exists; until then the step-1 test pass in `lab/merc/`): placing and
   scaling a pass so the feet stand on the floor line, the floor patch and light, leaps and hops
   as the board times them.
4. **This film's world**, one module each, with HANDOFFS' pixels as their defaults (a builder who
   passes nothing gets the handoff geometry): the band chart (band, Merc's line by the wave rule,
   the strip, the axis and its labels), the breath figure, the gauge and Merc's small band, the
   mix-up card's rows and miniatures, the folds and traces, the hold chart and its frame, the ring
   of the turn (track, arc, tick, counter, playhead), the recap's frame and its slide, the tease
   and the end card's pieces. Name them in `scripts.txt` in load order.
5. **`lesson.css`**: the palette and type tokens from STORYBOARD § Codes and § Type (ink, ink-2,
   chrome, amber, violet and the rest), local fonts only, pinned local GSAP.
6. **Proof**: lab pages in `P/lab/kit-src/`, stills in `P/lab/kit-<module>/` (render through
   `tools/lab.mjs` `kit:<name>`): each module at its HANDOFFS pixels (within 2 px, measured), each
   framing landed, each camera move with its parallax visible on a short clip, the chips and every
   label HANDOFFS places measured in the real fonts (write the real widths and every clearance
   under 12 px into `P/lab/kit-type/WIDTHS.md`: LAB-CHECKS lines 4 to 15 and 21 rest on them), the
   hook's last frame against HANDOFFS § Carried, and contrast of settled labels over the hatches
   and strip fills (LAB-CHECKS 18). If `check`'s contrast audit cannot measure text over those
   fills at a given time, rebuild Lesson 4's text sweep (`tools/text-sweep.mjs`) from its use in
   Lesson 4's BUILD-GUIDE, and log it in `tools/CHANGES.md`.
7. **`P/BUILD-GUIDE.md`**, Lesson 4's shape for this film: the clock (`L.at`, `L.word`, never a
   typed second), your files, the scene skeleton, the rules that cost a render, the kit table
   (every call), proving a scene (the commands as they run in P now), and builder splits (effort
   per scene and the groups A to E from STORYBOARD's scene table, two builders at a time).
   Then `npx hyperframes@0.8.97 check` on the root: 0 errors (a missing pass is the one expected
   finding while passes render).

## After you hand back
The lead sends the kit lab to one fresh critic (component round); you will get its report to
fix. Keep the lab pages and stills where the critic can find them.

## Hand back
Each kit file and what it offers; every value you had to choose for the lost room and why; the
lab stills and clips by path; `WIDTHS.md`'s clearances under 12 px; what in the board or HANDOFFS
cannot be built as written (with numbers); `check`'s result; open questions.
