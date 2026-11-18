# K5/K4: the first builder's hand-back (24 Oct)

## State
- kit-spiral, `feat/kit-spiral-owner`: one commit, `7b66be9e7` feat(lessons): play the spiral's own notes through a page's sound owner (kit/spiral.ts +70/-8, kit/spiral.test.ts +220). Code complete; treat it as unverified until step 1 passes. Tree clean, no dist/.
- `feat/kit-spiral-rest` not created; K4 not started in the repo.
- K5: `SpiralOptions.owner?: SoundOwner`. With an owner, four ways in play a stoppable voice that claims the owner and releases it at the note's end (0.9 s); another claim fades it out in 0.08 s. The four: a bead tap; a `[data-key]` click; Enter or Space on the slider; a canvas activation with no pointer. Without an owner, the path is unchanged (`void play(m)`), so Lessons 1 and 2 behave as before.
- Decisions: public `play()` never claims and still uses playTone (a page claims for its own run and lights beads through `play`; a claim there would stop that run). It claims even with sound off (Lesson 6's pattern), still flashing the bead and showing the "sound is off" toast. A second note on the same copy cuts the first: stop, then claim. Only the timer at the note's end releases; `stopAsked` never releases (only the owner calls it).
- Gates: spiral.test.ts 18/18 (7 new), light lane. eslint/prettier on the two files clean (before the restart; repeat). `pnpm check`: tsc passed, then eslint was OOM-killed (exit 137; the lanes' memory gate was broken then and is fixed now), so it is not passed. Not run: mutations, re-anchor, index, build:e2e and first paint (main: learn/01 142729 of 158720, learn/02 163292 of 168960), specs, pr:validate, docs:index:check, Lesson 1 and 2 unit tests.

## Remaining, in order
1. `pnpm check` through heavy. If lint or format rewrites anything, commit it as `fixup!` on 7b66be9e7 (no amend).
2. K5 mutations (restore with `git checkout -- src/features/lessons/kit/spiral.ts` after each):
   - remove `owner.claim(stopAsked)` (line 321): the four "stops the sound that held the page" cases go red;
   - remove `asked?.stop(CUT_SEC)` (line 303): "stops its note where it stands";
   - remove `owner.release(stopAsked)` (line 327): "lets the owner go";
   - the no-owner path claims `NowPlaying`: "with no owner".
3. Re-anchor: `pnpm plan:cites reanchor --base origin/main --write`; `node scripts/plan-cites.mjs check` at or under 183; commit "docs(find-your-pitch): re-anchor citations to the spiral".
4. `node scripts/gen-agent-index.mjs`; if INDEX.md changes, commit "docs(agent): regenerate the module map" last.
5. Heavy: build:e2e (exits 1 at Glassworks), then assert-first-paint-budgets and scratchpad/bin/fp-bytes.mjs for learn/01 and learn/02; learn-lesson-01*, learn-lesson-02* and learn-frame-loop specs; pr:validate; docs:index:check; Lesson 1 and 2 unit tests.
6. `git switch -c feat/kit-spiral-rest` (sanctioned), then K4.

## K4 design (worked out, not coded)
- spiral-draw.ts: export `TAG_MS = 1800`, used in `drawOverlays` where 1800 is inline. The 700 ms pulse is `pulseOf` in spiral-keys.ts.
- mountSpiral state: `dirty`, `room`, `drawnLook`, `drawnMoving`.
  - `look()` joins: canvas clientWidth and clientHeight, `devicePixelRatio || 1`; yaw, u, top, pan, sel; focused, hover, labels, `lit.size`, `Names.mode`.
  - `moving()`: `turnLeft !== 0 || (!dragging && (|vel| > 0.01 || (drifting() && turning && u < 0.02))) || u !== uTarget || top !== topTarget || pan !== panTarget`.
  - `fadingAt(t)`: true while the tap label is up (u < 0.6, under TAG_MS) or any pulse has `pulseOf > 0`.
  - `pageWants = opts.overlayWants?.() ?? (opts.overlay !== undefined || opts.keys !== undefined)`: Lesson 2's copies keep drawing every frame; Lesson 1 rests when still.
  - `wants()`: `dirty || look() !== drawnLook || (room && (drawnMoving || moving() || fadingAt(now) || pageWants()))`.
  - `draw()`: clears `dirty`; under 24 px sets `room = false` and `drawnLook`, returns; otherwise `room = true`, draws, records `drawnLook` and `drawnMoving`.
  - `changed() = dirty = true; wake()`, from `watchPixelRatio`, a ResizeObserver on the canvas, `document.fonts.ready` and `loadingdone`.
  - `wake()` in `hit`, `setSel`, `setUnrolled`, `setLabels`, `setTurning`, `setView`, `light`, the Names subscriber, and `pointerleave`.
  - Docs for `overlayWants`, and a header paragraph on resting.
- Tests in a new file, kit/spiral-frames.test.ts (spiral.test.ts is 417 lines; K4's tests would pass the 600 cap). This departs from the plan: say so in the report. An unrun draft: scratchpad l10/spiral-frames.test.ts.draft. Its frame counts were computed, not observed (113 for the tag, 44 for the flash, 75 or 76 for the 1.2 s camera move). `paints()` counts getBoundingClientRect calls, which `up()` and `hoverAt()` also make, so the tap tests count frames with `settle()`.
- K4 mutations: `wants` always false; `wants` ignoring a pulse; `wants` ignoring `setView`; an overlay with no `overlayWants` resting.
- Open: K4's size check reads clientWidth/clientHeight (as slide-guide and explorer do), so it would miss a CSS scale transform on the spiral's container; none found in the lesson CSS; note it in K4's commit.
