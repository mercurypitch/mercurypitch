# Lesson 9 page, "Landing a leap" (/learn/09): build plan

This plan comes from a read-only survey of `/home/user/mercurypitch/.claude/worktrees/names-lock`
on 24 October 2026. That checkout is main plus three unrelated router commits, so it is treated as
main. Every status here was checked in the code rather than taken from the spec. Line numbers are
from this checkout, and several differ from the spec's citations.

Short names used below:

- **Spec**: `docs/plans/find-your-pitch/lessons/09-landing-a-leap/WEB-SPEC.md`.
- **Tests N** and **End to end N**: the numbered cases in the spec's Tests section.
- **FACTS N**: the numbered facts in the package's `FACTS.md`.
- **kit/**: `src/features/lessons/kit/`.

## 0. Summary

**Status of the spec's 14 items** ("What the kit and the app still need", spec:612-750):

| Status   | Count | Items                     |
| -------- | ----- | ------------------------- |
| Done     | 5     | 8, 9, 10, 11, 12          |
| Partly   | 1     | 6                         |
| Not done | 8     | 1, 2, 3, 4, 5, 7, 13, 14  |

Item 12 is done in a different shape: it is `kit/merc-hop.ts`, not part of `kit/merc-duo.ts`.

**Missing from the list.** The page needs five shared parts that still live in earlier lessons'
modules (section 2). The spec's own reuse rule (spec:8-10) says they move into the kit first. Also,
about a dozen test files use Lesson 9 as their example of "a lesson with no page". They move to
Lesson 10 in the same commit that adds the page (section 5).

**One conflict with main.** The spec's meta description fails a test that is on main (section 6,
item 1).

**Task order.** Details are in section 4.

Kit tasks. Each is its own PR to main.

- A1a: band chart rungs, each over a time slot or across the plot, with its glow and lit edge. One
  rung at 0 must paint exactly as today.
- A1b: band chart arcs for Merc's leaps (optional number), and the rung-names option.
- A2: kit sound runs. Lesson 7's stoppable `Run` (`lesson-07/play.ts`) moves into the kit.
- A3: octave tag. Lesson 3's `octaveTag` moves into `kit/band-words.ts`.
- A4: ladder reader. `readLadder`, `rungLine` and `NOT_STEADY_RUNG_LINE` go in `kit/take.ts`
  (Tests 6).
- A5: `writeStepsWav` in `src/e2e/helpers/tone-wav.ts`.
- A6: folds. Lesson 3's vibration and its reduced-motion stills move into `kit/folds.ts`.
- A7 (recommended): the band chart tells the frame loop when it has nothing to draw (`wants`).
- A8 (recommended): Lesson 7's microphone holder (`Mic`) moves into the kit.

Page tasks. B3, B4 and B11 are pure modules and can land before the page exists.

- B0 (optional): tests that need "a lesson with no page" find one instead of naming Lesson 9.
- B3: ladder data, covering rungs, spelling, windows and Move do (Tests 1-3).
- B4: the page's sounds and words, covering paths, leaps, timings, ratios, status lines and the
  illustrations (Tests 4 and 9, part of 8).
- B11: the Sing it flow rule, `lesson-09/ladder-flow.ts` (Tests 7).
- B1: the share card, `public/learn/lesson-09-og.jpg`.
- B2: page shell and registration. This is the first page PR. It carries `learn/09.html` with its
  full head and copy, `main.ts`, the drafts line, the service-worker paths, the season's minutes and
  page, the first-paint ceilings, every test shift and `page.test.ts`.
- B5: the ladder chart controller: its seven states, live mode's frame, its spoken summaries and
  reduced motion.
- B6: cold open and predict (Tests 10 and 15; End to end 2).
- B9: recall and quick check (Tests 11; End to end 8 and 13).
- B7: Steps 1 and 2, with the folds strip.
- B8a: Steps 3 and 4.
- B8b: Step 5's landing and scrub, plus stopping sound when the viewer leaves a step (Tests 14).
- B10: Four words.
- B12: Sing it without the microphone: comfort check, voice, listen-only, warm-up, briefing, ladder
  choice, Move do and the Wrap's card.
- B13: the take: listener, guide, live line, readings, feelings and Again (End to end 6 and 7).
- B14: the Wrap: free play, practice card, the next card's tease figure and the footer (End to end
  9 and 10).
- B15: the end-to-end checks that span the page: keyboard, targets, reduced motion, storage,
  publish state, frame loop and sound gate.
- B16: final measurement and docs: ceilings, stylesheet links, app-check run locally, plan
  citations, the module index and the shared records.

App tasks. These are independent of the page.

- C1: the `intervals` launch field, a minor third, and `/exercises/leap-ladder`.
- C2 (optional): `/exercises/arpeggio-jumper`.
- C3: owner decision on Arpeggio Jumper's "richness" share of its grade.
- C4: content rewrite of the Ascent's "Tuning & Ear" week.

**Blockers and open questions** (detail in section 6):

- The description's wording.
- Whether a half-built draft may sit on dev and previews.
- How the share card gets rendered.
- Which "Show:" label the fourth word gets.
- Where `readLadder` starts its slots.
- How rung names fit the 40 px gutter.
- Where arcs sit in rung mode.
- Whether `writeStepsWav` can be timed.
- First-paint headroom on Lessons 3 to 5.
- Whether `mercHop` fits a leap.
- Whether the page joins the whole-page frame-loop rest.

## 1. Status of each spec item

| #   | Item                                         | Status                       | Evidence (file:line)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | What remains                                                                                                                                                                                                               |
| --- | -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lesson host                                  | Not done                     | `learn/` holds only `01.html`-`08.html` and `index.html`. The build needs no change, as the spec says: `tools/draft-lessons.ts:17-18` ("Nothing here or in vite.config.ts names a lesson"), with `lessonPages` at `:77-86`. `kit/drafts.ts:31-38` has lines for Lessons 3-8 only. `src/lib/sw-runtime.ts` has `STANDALONE_DOCUMENT_PATHS` at `:93` and the lesson entries at `:131-157`, ending with Lesson 8 at `:156-157`; there is no `/learn/09`. `src/lesson-gate.ts`, `wrangler.jsonc` `LESSON_DRAFTS` (`:116`, `:167` with production at "0", `:190`, `:232`) and `scripts/assert-draft-lessons.mjs` have no per-lesson code. | `learn/09.html`, `src/features/lessons/lesson-09/`, the drafts line, and the two service-worker paths. All of this is in B2. The release steps (sitemap, `llms.txt`, deleting the drafts line, `datePublished`) wait for the sign-off. |
| 2   | The page's head                              | Not done; conflicts with a test | `src/tests/lesson-pages.test.ts:191-210` requires three things: the chip reads exactly "16 minutes"; the Article's `timeRequired` is `PT16M`; and both the meta description and the Article description contain "A sixteen-minute lesson" (`MINUTE_WORDS`, `:74-89`). The spec's description has none of that. The same file checks the rest of the head at `:139-275`: title of 60 characters or fewer ending " \| MercuryPitch" (`:154-155`); description of 80-160 characters (`:156-159`); canonical, `og:url`, robots and `twitter:card` (`:143-161`); the Article as the first JSON-LD block (`:163-189`); BreadcrumbList (`:212-227`); share card (`:229-249`); chips equal to `PREREQ[9] = [3, 6]` (`:251-263`); legal nav (`:265-276`). `kit/lesson-copy.test.ts:322-331` checks the h1 and `:333-356` checks the og and twitter descriptions and `alternativeHeadline`. | Write the head in full (B2) and reword the description (section 6, item 1). |
| 3   | Share image                                  | Not done                     | `public/learn/` holds `lesson-01-og.jpg` to `lesson-08-og.jpg`, each a 1200x630 baseline JPEG of 44-50 KB (`file public/learn/lesson-0*-og.jpg`). `lesson-pages.test.ts:229-249` requires the card for every lesson document, so it must exist as soon as `learn/09.html` does. The repo has no generator; Lesson 8's card was committed as a binary in `1108914f8`. | B1. |
| 4   | First-paint ceilings                         | Not done                     | `scripts/assert-first-paint-budgets.mjs` has JavaScript entries for 01-08 (`:97`, `:101`, `:143`, `:151`, `:167`, `:176`, `:183`, `:190`) and stylesheet entries at `:242-271`. A document with no ceiling fails (`:507-510`). The rule is measured size plus about a quarter (`:47-58`). Lessons 3 and 4 have about 848 and 882 bytes of JavaScript headroom left (`bb9d432d1`). | Two entries for `learn/09.html` (B2, final values in B16). Watch Lessons 3 to 5 (section 6, item 10). |
| 5   | Band chart: rungs, arcs, rung names          | Not done                     | In `kit/band-chart.ts`: `BandAxis` at `:39-46`, `BandChartOptions` at `:48-65` and `BandScene` at `:68-90`. `bands()` at `:185-197` gives one full-width band at 0, plus the echo. `paint()` is at `:199-218`, and `addDrawer` at `:220-226` has no `wants`. In `kit/band-chart-draw.ts`: `drawNotesGrid` at `:116-137` letters every natural row; `BandSpec` at `:140-147` has no x bounds; `drawBand` at `:150-183` and `drawLitEdge` at `:186-203` are full width; there is no arc painter. No band-chart test file exists. | A1a and A1b. |
| 6   | Folds strip                                  | Partly                       | Done in the kit: the fold drawing in `kit/folds.ts` (`FoldShape` `:20-30`, `drawFoldPair` `:91-99`, `drawFoldText` `:102-114`, `drawFoldLabels` `:117-133`, `foldShapeAt` `:136-146`) and `createSlowClock` in `kit/slow-motion.ts:29-47`. Not done: the vibration (bulge = vib·max(0, sin(TAU·phase)), with vib = 6·(1−0.3s)) and the reduced-motion OPEN/CLOSED stills are still inline in `lesson-03/toy-folds.ts:185-207` and `:210-231`. `slowRate` (`slow-motion.ts:50-53`) prints 0.7 for both D3 and E3, so the page needs its own ratio readout. | A6 for the kit parts. The strip itself, a 64 px canvas inside the chart's figure, is B7. The ratio lines are B4. |
| 7   | `readLadder`, `rungLine`, `NOT_STEADY_RUNG_LINE` | Not done                 | `kit/take.ts` has `readTake` (`:107-128`), `countRun` (`:142-152`), `countLine` (`:158-163`), `trickyAfter` (`:166-167`) and `NOT_STEADY_LINE` (`:64-65`). `readingLine` (`:79-86`) appends "Listen again..." tails, so `rungLine` cannot call it as it stands. The header (`:22-23`) says the module loads with the listener and never at first paint. `kit/listen.ts:32` re-exports it. | A4. |
| 8   | `afterFeeling(f, { restAfterEffort: true })` | Done                         | `kit/comfort.ts`: `AfterFeelingOptions` at `:51-54` and `afterFeeling` at `:56-87`, which sends effort to the rest card when the option is on (`:77`). Lessons 6, 7 and 8 pass it (for example `lesson-07/siren-flow.ts:122`). `mountFeelings` (`:175-206`) locks an answer by default. | Nothing. B11 passes the option. |
| 9   | Sound rules: predict `false` and one owner   | Done                         | `kit/predict.ts`: `play` returns `Promise<boolean>` or `Promise<void>` (`:38-41`, documented at `:31-37`), and a play counts as heard only when the result is not `false` (`:184-188`). `kit/now-playing.ts`: `SoundOwner` at `:17-22`, `createSoundOwner` at `:24-36`, `NowPlaying` at `:39`. Lessons 6, 7 and 8 use it. | Nothing. The header at `now-playing.ts:14-15` ("no other lesson does yet") is stale; fix it in B16. |
| 10  | Move do in the kit                           | Done                         | `kit/move-do.ts`: `MOVE_MAX` `:21`, `clampMove` `:24-25`, `nextShift` `:28-29`, `setMoveEnds` `:32-40`, count-in `:43-51`. Lessons 4, 6 and 8 use it. | Nothing. |
| 11  | Four-words strip                             | Done                         | `kit/words-strip.ts`: `bindWordPlays` at `:54-87` takes `{ owner?, stop? }` (`:46-51`). Lessons 1, 7 and 8 use it. | Nothing. |
| 12  | `mercHop`                                    | Done, in another shape       | `kit/merc-hop.ts` (from Lesson 8): `HOP_MS` 530 at `:15`, and `mercHop(which)` at `:22-40`, a Web Animations hop in place that is skipped when `Motion.paused` is set. Its header (`:8-9`) says only Lesson 8 imports it. It is not in `merc-duo.ts`, whose `mercSing`, `mercListen` and `mercCelebrate` are now at `:143`, `:185` and `:195` (the spec cites `:164`, `:206` and `:216`). | Decide whether a hop in place suits a leap (section 6, item 9). |
| 13  | `writeStepsWav`                              | Not done                     | `src/e2e/helpers/tone-wav.ts` has `RATE` (`:20`), `wavOf` (`:22-42`), `voice` (`:45-46`), `place` for atomic writes (`:58-64`), `writeToneWav` (`:76-84`), `writeGlideWav` (`:94-112`), `fakeMicArgs` (`:115-121`) and `FRESH_VISITOR_INIT` (`:132-142`). Chromium loops the file (`:74`). | A5. |
| 14  | App items                                    | Not done                     | `src/features/exercises/slug-map.ts`: `ExerciseLaunch` (`:24-36`) has no `intervals`, and `EXERCISE_SLUGS` (`:47-64`) has no `leap-ladder` or `arpeggio-jumper`. `src/App.tsx` has `applyExerciseSlug` at `:724-767`, calling `setLaunchOverride` at `:754-762` (the spec cites `:593-638`). `use-interval-trainer-controller.ts`: `INTERVAL_POOL` (`:37-44`) has no minor third; `plannedRounds` (`:48-53`) caps a run at the pool's size; `generateIntervals` (`:55-64`) plays each interval once. Arpeggio Jumper's richness is a quarter of its grade (`use-arpeggio-jumper-controller.ts:301`). The Ascent's "Tuning & Ear" week is at `path-content.ts:186`. | C1 to C4. None of them gates the page: its link today is "Exercises, then tap Arpeggio Jumper" (`kit/season.ts:332-340`). |

**Season and copy data.** Lesson 9's entry is at `kit/season.ts:325-341`. It has the hook, the link
`/pitch-training?lesson=09` and the note "then tap Arpeggio Jumper". It has no `minutes`, no `page`
and no draft comment yet; Lesson 8's entry, with that comment, is at `:303-321`. `EDGES` already
holds `[3, 9]` at `:417` and `[6, 9]` at `:418`. Lesson 9's tease is at `kit/lesson-copy.ts:114`.
Lesson 10's tease, at `:115`, reads "Three notes, one chord. Move one by a semitone." Lesson 10's
title is "Major and minor" (`season.ts:345`).

The spec's "already on main" list (spec:733-750) was spot-checked and holds: `majorScale` is at
`kit/major-scale.ts:43-45`, the deck's `onStep(step, previous)` call is at `kit/step-deck.ts:167`,
and the next card, explorer, page state and warm-up are all in the kit. On the server,
`workers/db-worker/src/mirror-metrics.ts` already accepts pages and questions for lessons 1 to 14
(questions q1 to q4), so it needs no change.

## 2. Needed, but not on the spec's list

The spec says a part that still lives in an earlier lesson's module moves into the kit before this
page uses it (spec:8-10). Five such parts are not on its list:

- **G1. Sounds that can be stopped.** Lesson 9 needs three behaviours: the predict's `false` for a
  cut-short play, `NowPlaying` stopping the sound before it, and leaving a step stopping anything
  queued. Lesson 7's `Run` gives all three: a `done: Promise<boolean>` and a `stop()`
  (`lesson-07/play.ts:21-24`; `timed` `:35-59`, `playLine` `:62-68`, `playNotes` `:71-100`,
  `playNote` `:103-105`). There are four page-local versions:
  - `lesson-02/examples.ts:124` and `lesson-04/examples.ts:82` each have a `schedule` that cannot be
    stopped.
  - `lesson-06/examples.ts:197-226` has a `playNotes` that resolves `Promise<void>`.
  - `lesson-07/play.ts` is the one that can be stopped.

  Lesson 12's needs 8 asks for a kit `schedule` that can be stopped (Lesson 12 WEB-SPEC:700-716 and
  :876-886). It should extend the same module rather than add a second design. This is task A2.
- **G2. The octave tag.** Lesson 3's `octaveTag` (`lesson-03/sing-take.ts:49-55`, with `octavesOf`
  at `:49-50`) is the "octave lower" tag the spec's take asks for (Toys 4, state 6). This is task
  A3.
- **G3. The microphone holder.** Lesson 7's `Mic` (`lesson-07/sing-take.ts:56-77`) loads the
  listener with a dynamic import inside the tap and releases it. This is task A8.
- **G4. A band chart that rests.** The band chart's drawer has no `wants`
  (`band-chart.ts:220-226`). Without one, a page that uses it never stops asking for frames (HANDOFF
  § 4.2, "Still open"). `src/e2e/learn-frame-loop.spec.ts:285-321` holds Lessons 6 to 8 to a
  whole-page rest. This is task A7.
- **G5. The folds' vibration and stills.** Covered under item 6 above. This is task A6.

Two more gaps are not kit parts:

- **G6. Test moves.** These are needed the moment Lesson 9 has a page. See section 5.
- **G7. Step 5's scrub bar.** CONVENTIONS.md § 6 asks a pointer-driven control for a real-mouse
  `@smoke` spec. Lesson 3's band toy scrubs the same chart with a native range input
  (`lesson-03/toy-band.ts:95`, `:202-204`, `:297`), which avoids custom pointer code. Lesson 7's
  custom `role="slider"` (`learn/07.html:796-806`) is the other precedent. Reusing Lesson 3's
  pattern is the cheaper choice.

## 3. How the work ships

**Guardrails.**

- Branches use the `feat/` prefix, for example `feat/lesson-09-rungs` or `feat/lesson-09-page`.
- Bring a branch up to date by rebasing onto main; push with `--force-with-lease`, never plain
  `--force`.
- No commit, push, PR or merge unless the user asks. No Claude attribution. No emojis; use SVG
  icons.
- Never test against production. Run locally or on dev.
- Run `pnpm check` after every change. Note that `pnpm check` runs typecheck, lint and format only,
  so each task also names the tests to run.
- Unit tests sit beside their module. End-to-end specs go in `src/e2e/<feature>.spec.ts`, with no
  `waitForTimeout` and no `.count()` assertions (TESTING.md).
- Every new module gets the banner header (CONVENTIONS.md § 7). Then run `pnpm docs:index`, since
  `docs:index:check` fails a stale index.
- Moving code that a lesson package cites calls for `pnpm plan:cites` and then
  `pnpm plan:cites:check` (HANDOFF § 6).

**Order.**

1. The kit tasks and the pure page modules (B3, B4, B11) go first, as separate PRs. They do not
   depend on one another, except that A1b follows A1a and A7 follows A1, since all three edit
   `band-chart.ts`. The pure modules need no `learn/09.html`. CI does not run knip, but
   `pnpm knip:prod` will list them as unused until B2's `main.ts` imports them.
2. B1 and B2 together form the first page PR. From the moment `learn/09.html` exists, the
   cross-lesson tests and specs pick it up automatically:
   - unit tests: `src/tests/lesson-pages.test.ts` (through `tools/draft-lessons.ts`'s
     `releasedLessons` and `draftLessons`, which is why the drafts line must land with the page:
     without it the page is held to the released checks), `kit/season.test.ts:286-303` (which reads
     `learn/` itself) and `kit/lesson-copy.test.ts`;
   - end-to-end: `learn-stage-fit`, `learn-cold-open-fold` and `learn-no-planning-text`.

   So B2 must pass all of them by itself. Concretely, it needs:
   - the five steps on the sticky stage, each with at least one control of 44 px or more and a
     stage scroll of 60 px or less;
   - a figure (`.viz`) on the stage;
   - the explorer drawing its 15 rows;
   - the title on the first screen;
   - the next card and the lesson menu, which the moved tests now look for on Lesson 9's page.
3. After that, B5 onwards land as small PRs. The page stays a draft the whole time: production's
   `LESSON_DRAFTS` "0" holds it back, while dev and every preview show it (`wrangler.jsonc:167`,
   `:190`, `:232`). Each task adds its own unit tests and the end-to-end cases for what it wires.
   B15 adds the checks that span the page.

**The alternative**, if a half-built page on dev is not acceptable (section 6, item 2): build B2 to
B14 on one branch, `feat/lesson-09-page`, with one commit per task. Each commit passes
`pnpm check` and its unit tests. Open one PR, review it commit by commit, and have end-to-end
green from B2's commit onwards.

## 4. Tasks

Each task gives its files, the tests it adds or changes, how to tell it is done, and what it
depends on. Kit tasks also name the existing lesson pages they can affect. These checks apply to
every task and are not repeated in each one:

- `pnpm check` passes.
- The named tests pass.
- `pnpm docs:index:check` passes, after `pnpm docs:index` if a module was added.

### Kit (A): each its own PR to main

**A1a. Band chart rungs**

- **Goal:** rungs in the scene. Each rung is a band at its cents from do, drawn over a time slot or
  across the plot, with its own glow and lit edge. A scene with one rung at 0 across the plot paints
  exactly today's single band.
- **Files:**
  - `kit/band-chart.ts`: a small, optional hook that paints rungs in place of `bands()` when it is
    given; with no rungs, today's path runs.
  - New `kit/band-chart-rungs.ts`: the `Rung` type `{ c, from?, to?, glow?, lit?, faint? }` and its
    painter. Only Lesson 9 imports this module, so Lessons 3 and 5 do not load it at first paint.
  - `kit/band-chart-draw.ts`: at most, optional x bounds on `BandSpec` (`:140-147`) for
    `drawBand` and `drawLitEdge`, full width by default.
- **Tests:** a new `kit/band-chart.test.ts` with a recording 2D context. The pattern is
  `kit/still-sky.test.ts:16-27`; the blank context is in `browser-doubles.test-fixtures.ts:93-118`.
  1. Write a characterization test first, on main before the change. It records today's drawing
     calls for a Lesson 3 chart (`{ target: 57 }`, as `lesson-03/sing-view.ts:78` mounts it) and
     for a notes-axis chart like Lesson 5's.
  2. The same call list comes out with one rung at 0 across the plot.
  3. A rung over a slot fills only `xOf(from)` to `xOf(to)`, and its lit edge stays inside those
     bounds.

  Together these are the first half of Tests 5.
- **Done when:**
  - Lessons 3 and 5's unit tests pass.
  - `pnpm build:e2e` passes, and Lessons 3 and 5's measured first paint is unchanged or changed by a
    handful of bytes. Record the numbers in the PR.
  - The `learn-lesson-03*` and `learn-lesson-05*` specs pass.
- **Depends on:** nothing.
- **Pages it can affect:**
  - Lesson 3: `hook.ts`, `toy-band.ts`, `toy-octaves.ts` and `sing-view.ts`.
  - Lesson 5: `hook.ts`, `toy-hold.ts`, `toy-push.ts`, `sing-view.ts` and `sing-hold.ts`.
  - Lesson 14's song line will reuse the rungs later (HANDOFF § 4.1).

**A1b. Arcs and rung names**

- **Goal:** Merc's arcs, plus a rung-names option on the notes axis.
  - An arc runs from the end of one band to the start of the next and rises above the straight line
    between them. It is amber, can carry an optional plain digit, and can draw part of itself so
    that it draws as a note sounds.
  - The rung-names option sits beside `named` (`band-chart.ts:39-46`). It names the given rows (for
    example "so · A3") and leaves every other row unnamed, so `drawNotesGrid`'s letters (`:116-137`)
    must be possible to switch off.
- **Files:**
  - `kit/band-chart-rungs.ts`.
  - `kit/band-chart.ts` for the axis option.
  - `kit/band-chart-draw.ts`: only a flag to switch off the letters, and exporting its row painter
    if the new module draws the rows.
- **Tests:** `kit/band-chart.test.ts`. Arcs land where their times and cents say, with the apex
  above the chord and the digit beside it. Names appear at the rung rows and nowhere else. A chart
  without the option letters its rows as today. These are the second half of Tests 5.
- **Done when:** the same checks as A1a pass.
- **Depends on:** A1a.
- **Pages it can affect:** as A1a, and only if `band-chart-draw.ts` changes.
- **Open question:** section 6, items 6 and 7.

**A2. Kit sound runs**

- **Goal:** move Lesson 7's `Run`, `RunOptions`, `playLine`, `playNotes` and `playNote` into the
  kit, unchanged.
- **Files:**
  - New `kit/run.ts`, with a kit note type `{ t, midi, dur }`. That is the same shape as Lesson 7's
    `TuneNote` (`lesson-07/range-data.ts:147-151`), which stays where it is.
  - Lesson 7's importers switch to the kit: `cold-open.ts:34-35`, `range-toy.ts:35-36`,
    `sing.ts:43-44` and `words.ts:24-25`.
  - `lesson-07/play.ts` goes.
- **Tests:** a new `kit/run.test.ts` with fake timers and a spy on `Sound`:
  - `done` resolves `true` when the run ends by itself and `false` when it is stopped.
  - A stop before a note's onset starts no voice and fires no `onNote`.
  - A silent run starts no voice, still fires `onNote`, and resolves `true`.
  - A stop releases each voice with the kit's short release (CONVENTIONS.md § 5b).

  This is the kit half of Tests 15.
- **Done when:**
  - Lesson 7's unit tests and `learn-lesson-07*` specs pass.
  - Lesson 7's first paint is unchanged, since the code only moved.
  - `pnpm plan:cites:check` passes, because Lesson 7's package cites `play.ts`.
- **Depends on:** nothing.
- **Pages it can affect:** Lesson 7.
- **Note for later:** Lesson 12's stoppable `schedule` for chords should extend this module.

**A3. Octave tag**

- **Goal:** move `octaveTag` and `octavesOf` from `lesson-03/sing-take.ts:49-55` into
  `kit/band-words.ts`.
  - Never put them in `take.ts`. That module loads with the listener after Start, and Lesson 3's
    first paint imports `sing-take.ts` statically.
  - `liveGap` (`:58-61`) stays with Lesson 3.
- **Files:** `kit/band-words.ts` and `lesson-03/sing-take.ts`.
- **Tests:** move the cases at `lesson-03/sing.test.ts:120-124` beside the kit module, unchanged.
- **Done when:**
  - The `learn-lesson-03` sing spec passes.
  - Lesson 3's first paint is unchanged (the code moved) and Lesson 5's is unchanged (the build
    drops the unused code).
  - `pnpm plan:cites:check` passes.
- **Depends on:** nothing.
- **Pages it can affect:** Lesson 3.

**A4. Ladder reader**

- **Goal:** read a sung ladder note by note, reusing the existing reader.
  - In `kit/take.ts`, split `readingLine` (`:79-86`) into the reading's words and its retry tails.
    `readingLine`'s output must not change.
  - Add `readLadder(frames, rungs, slotSec = 1.5)`. It returns `{ heard: false }`, or
    `{ heard: true, slots, count }` where each slot is read by `readTake` against its rung, and the
    count is `countRun` with one take per slot.
  - Add `rungLine(label, reading)` and `NOT_STEADY_RUNG_LINE` ("We didn't hear a steady note
    there.").
  - `listen.ts:32` already re-exports the module, so nothing else changes.
- **Files:** `kit/take.ts`, plus a test file beside it (`take.test.ts`, or a new
  `take-ladder.test.ts`).
- **Tests:**
  - Every case in Tests 6, on synthetic frames at the detector's 16 ms hop (`DEFAULT_HOP_SEC`,
    `src/lib/pitch-measurements/f0.ts:35`): four steady notes; four notes 30 cents flat; one A3
    held for 6.0 s; the top do sung an octave low; a slot with only 0.4 s of voice; no voice at all;
    every note 0.3 s late; and the smaller ladder.
  - Every template passes `validateGuidedDynamicClaim` with surface `finding`.
  - No line holds "Listen again" or "Try again".
  - The existing `readingLine` cases still pass.
- **Done when:** Lessons 3, 5 and 7's take and sing tests pass, and `pnpm build:e2e` shows no
  first-paint change.
- **Depends on:** nothing.
- **Pages it can affect:** Lessons 3, 5 and 7, which share this reader.
- **Open question:** section 6, item 5.

**A5. `writeStepsWav`**

- **Goal:** `writeStepsWav(steps, leadSilence)` in `src/e2e/helpers/tone-wav.ts`: steady tones in
  order after a stretch of silence. Use the existing envelope (`voice`) or a short crossfade, write
  atomically through `place()`, and encode the steps and the lead in the file name, as
  `writeToneWav` does.
- **Tests:** B13's sing spec uses it. The spec allows dropping the 4-of-4 end-to-end case if the
  fake device's start cannot be pinned.
- **Depends on:** nothing.
- **Pages it can affect:** none. It is additive, and the specs that use `tone-wav.ts` stay as they
  are.
- **Open question:** section 6, item 8.

**A6. The folds' vibration and stills**

- **Goal:** move three things from `lesson-03/toy-folds.ts:185-231` into `kit/folds.ts`:
  - the vibration size, `vib = 6·(1 − 0.3s)`, and the slowed bulge, `vib·max(0, sin(TAU·phase))`;
  - the fast blur;
  - the reduced-motion OPEN and CLOSED stills.

  Lesson 3 then calls the kit.
- **Files:** `kit/folds.ts` and `lesson-03/toy-folds.ts`.
- **Tests:** a new `kit/folds.test.ts` with a recording context. The bulge follows the phase, and
  the stills draw OPEN and CLOSED. Lesson 3's existing tests pass unchanged.
- **Done when:** the `learn-lesson-03*` specs pass and Lesson 3's first paint is unchanged.
- **Check during this task:** whether `foldShapeAt` still reads in a 64 px strip. It was drawn for
  Lesson 3's taller canvas.
- **Depends on:** nothing.
- **Pages it can affect:** Lesson 3 (Step 1 and free play). Lesson 5 imports `kit/folds.ts`
  (`lesson-05/toy-starts.ts:22-23`); additions leave it unchanged.

**A7 (recommended). The band chart rests**

- **Goal:** a `wants` for the band chart, modelled on `frame-loop.ts:1-18` and
  `range-chart.ts:158`.
  - It compares what the scene shows with what it last drew, and asks for frames only while
    something changes or moves.
  - Comparing is safer than relying on `wake()`, because Lessons 3 and 5 change the scene in place
    from many controllers. On any input the loop asks every `wants` again, which catches such
    changes.
- **Files:** `kit/band-chart.ts`.
- **Tests:** in `kit/band-chart.test.ts`:
  - An unchanged scene asks for no frame.
  - A changed scene asks for one.
  - A change made in place without a wake is caught at the next input.
- **Done when:**
  - `learn-frame-loop.spec.ts` passes. Lessons 3 and 5 still do not rest page-wide, because their
    other drawers keep the loop running.
  - Lessons 3 and 5's specs pass.
  - Their first paint stays under its ceiling. Measure it, since Lesson 3 has little room.
- **Depends on:** A1a and A1b, which edit the same file.
- **Pages it can affect:** Lessons 3 and 5.

**A8 (recommended). Microphone holder in the kit**

- **Goal:** move Lesson 7's `Mic` (`lesson-07/sing-take.ts:56-77`) into a kit module and pass the
  consumer id in. The listener stays behind its dynamic import.
- **Files:** a new `kit/mic-hold.ts`, and `lesson-07/sing-take.ts` with its users.
- **Tests:** Lesson 7's sing tests and `learn-lesson-07-sing`. A kit test, if one is added, needs
  `vi.mock` of the listener module, which is allowed because the test is not pure.
- **Done when:** Lesson 7's first paint is unchanged and those tests pass.
- **Depends on:** nothing.
- **Pages it can affect:** Lesson 7.

### Page (B)

**B0 (optional). Tests find "a lesson with no page"**

- **Goal:** tests that only need some lesson without a page find one, instead of naming Lesson 9.
  This makes B2 smaller, and the next page to land cannot break these tests.
- **Files:**
  - `kit/publish.test.ts:44-55`, using `LESSONS.find((L) => L.n > 0 && L.page === undefined)`, as
    Tests 12 asks.
  - `src/features/admin/lessons/lesson-admin.test.ts:96` and `:481`.
- **Done when:** the tests pass with no change in behaviour.
- **Depends on:** nothing.

**B3. Ladder data (pure)**

- **Contents:**
  - do for each voice: D3 for the lower and D4 for the higher (FACTS 69, 74), moved by Move do's
    shift (`kit/move-do.ts`).
  - The full ladder, [0, 4, 7, 12], with the labels "Do", "Mi", "So", "Top do".
  - The smaller ladder, [0, 4, 7, 4, 0], with the labels "Do", "Mi", "So", "Mi again", "Do again".
  - Spelled names from `majorScale(do)` degrees 1, 3, 5 and 8 (`kit/major-scale.ts:43-45`), and
    spoken names from `kit/notes.ts`.
  - The window for each state (spec Toys 1, "Windows").
  - The intervals 4, 3, 7, 5 and 12, with their names.
- **Files:** a new `src/features/lessons/lesson-09/ladder-data.ts` and `ladder-data.test.ts`.
- **Tests:** Tests 1, 2 and 3, using `VOCAL_RANGES` from `src/stores/settings-store.ts:91` and FACTS
  20, 22, 73, 75 and 90.
- **Depends on:** nothing.

**B4. Sounds and their words (pure)**

- **Contents:**
  - The cold open's leap and its three paths, with their live-region lines.
  - Step 1's step and leap, with the ratio lines: 2^(2/12) reads "1.12" and 2^(7/12) reads "1.50".
  - Step 2's illustration points (FACTS 98).
  - Step 3's climb and its two leaps, with their lines.
  - Step 4's five leaps in the syllabus's order, numbered and timed at 12.4 s, or 24.8 s with Slow,
    each with a line such as "1 of 5: mi to so, a minor third, 3 semitones".
  - Step 5's landing trace (FACTS 94, 99), with readouts from `bandValueText`
    (`kit/band-words.ts:79-81`) and the scrub bar's `aria-valuetext`.
  - Free play's leap lines.
  - Every frequency as `hz(m)`.
- **Files:** new modules in `lesson-09/`, for example `sounds.ts` and `lines.ts`, with tests.
- **Tests:**
  - Tests 4 and 9.
  - Every template passes `validateGuidedDynamicClaim`, and no spoken line holds a sharp or flat
    sign (part of Tests 8).
- **Depends on:** B3.

**B11. The Sing it flow rule (pure)**

- **Goal:** a new `lesson-09/ladder-flow.ts`, built on `lesson-07/siren-flow.ts`'s pattern: the
  visit, its events, what the card offers, and its lines.
- **What Lesson 9 adds to that pattern:**
  - The voice choice comes before either path.
  - Sound off, and no Web Audio at all.
  - The ladder choice, which can only get smaller within a visit.
  - Again and Again smaller.
  - Start again after a take that heard no voice.
  - `afterFeeling(f, { restAfterEffort: true })`.
- **Tests:** `ladder-flow.test.ts`, covering Tests 7, including the walk over every sequence of
  take outcomes, ladder choices and answers. That walk must never reach a fourth take or a third
  sung ladder, never offer the full ladder after a sung smaller one, and never show Again after
  "Effortful" or "Uncomfortable". Tests 7's storage clause is checked in the browser-level tests of
  B12 and B13.
- **Depends on:** nothing.
- **Note:** Lesson 11's needs 7 (a `kit/siren-flow.ts`) is a different rule. Keep this one in the
  page's folder.

**B1. Share card**

- **File:** `public/learn/lesson-09-og.jpg`, a 1200x630 baseline JPEG of about 45-50 KB.
- **How to render it, locally only, never against production:**
  1. Build a throwaway scratch page on the dev server that draws the kit's band chart in its
     compact state: do's and so's bands over two slots, with Merc's arc between them and no middle
     note.
  2. Put Merc and Tavi's stills either side (`lesson-01/assets/merc-*.png`), with the title
     "Landing a leap", "Lesson 09" and the wordmark.
  3. Take a 1200x630 screenshot with Playwright and convert it to a baseline JPEG.

  Commit only the JPEG, unless the owner wants a generator in the repo.
- **Done when:**
  - `file` reports "baseline, … 1200x630".
  - The card is checked against the predict: no middle note and no "mi" (HANDOFF § 5).
  - The head's `og:image:alt` describes what the card shows.
  - `lesson-pages.test.ts:229-249` passes once B2 lands.
- **Depends on:** A1a and A1b, since the still is drawn with the kit.

**B2. Page shell and registration (the first page PR)**

Files:

- **`learn/09.html`**
  - The head in full, as spec need 2 gives it, but with the description reworded (section 6, item
    1). Lessons 8 and 3 are the patterns: `learn/08.html:11-13`, `:75-76` and `:83` for the
    description, `alternativeHeadline` and `timeRequired`.
  - The body, section by section:
    - the masthead, with the anchors Lesson, Sing and Explorer;
    - the hero: kicker; `h1.hook#hook`; five chips, two of them wholly `a.chip.chip-link` to
      `/learn/03` and `/learn/06`; the promise; the sound gate with both its lines; and the stage,
      with the bubbles, Merc and Tavi and the compact chart's canvas;
    - the predict card's markup, its plays disabled;
    - the `#recall` host;
    - the Four words markup, with four inline SVG figures and their buttons;
    - `#lesson`, holding the five steps' copy from LESSON.md and the sticky stage: one toy whose
      `.viz` holds the chart canvas and the 64 px folds canvas, plus `#stepNow`, Previous, Next, and
      every step's row of controls;
    - `#sing`, with its static copy;
    - the `#quiz` host;
    - `#wrap`, with the recap, the challenge, `#practiseCard`, the free-play host and an empty
      `[data-next-card]`;
    - `#explorer`;
    - the footer.
  - No Watch section. Each toy does nothing until its own task wires it.
- **`lesson-09/main.ts`**, in Lesson 8's boot order (`lesson-08/main.ts`):
  1. The CSS imports: the kit sheets that voice lessons take, without the ear-game or beat-machine
     sheets, and `lesson-09.css`. That sheet sets `--viz-min: 210px` on the ladder chart, as
     `lesson-03/lesson-03.css:177-182` does.
  2. The sound switch and the motion switch.
  3. `createStepDeck({ toyFor: () => 1, after: { label: 'Sing it', selector: '#sing' } })`.
  4. `createNextCard(9)`, before `createExplorer({ current: 9 })`.
  5. `initMasthead(sections, { lesson: 9, deck })`.
  6. `initReveals`, `startFrameLoop` and `initMercs(q('#heroStage'), { sparkles: 'none' })`.
- **`kit/drafts.ts`:** `9: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, or the wording
  for the build period in section 6, item 2.
- **`src/lib/sw-runtime.ts`:** `'/learn/09'` and `'/learn/09.html'` after `:156-157`, with the
  drafts comment.
- **`kit/season.ts`, Lesson 9's entry:** the comment `// A draft until its sign-off (drafts.ts), as
  Lesson 3 is.`, then `minutes: 16` and `page: '/learn/09'` after `topics`.
- **`scripts/assert-first-paint-budgets.mjs`:** `learn/09.html` in both tables. Each value is the
  size measured in `build:e2e` plus a quarter, with the reason comment written the way Lesson 8's
  is (`:184-190`, `:268-271`). The comment names the dynamic import that B13's take will bring,
  since the ceiling holds only while that boundary does.
- **Every test shift in section 5.**
- **New `lesson-09/page.test.ts`,** on `lesson-08/page.test.ts`'s pattern. It checks that:
  - no sharp or flat sign appears in text or accessible names;
  - every referenced id exists, once;
  - every button has `type=button`;
  - there is no Watch section;
  - the order is cold open, then recall, then Four words;
  - the practice links carry `?lesson=09`;
  - the share card exists;
  - no two controls on a stage share an accessible name (part of Tests 8).
- **New `lesson-09/page-dom.test-fixtures.ts`:** `loadPage()` for `learn/09.html`, and a recorder
  for the kit's sound runs, standing in for Lesson 8's `FakeBeatClock`. Later tasks' browser-level
  tests use both.
- **New `src/e2e/learn-lesson-09.spec.ts`,** starting with End to end 1: no AudioContext before
  the first tap, and nothing plays before a play button.

Done when:

- These unit tests pass:
  - `src/tests/lesson-pages.test.ts`;
  - `kit/lesson-copy.test.ts`, `kit/team-notes.test.ts`, `kit/season.test.ts`,
    `kit/drafts.test.ts` and `kit/publish.test.ts`;
  - every shifted unit test, and `lesson-09/page.test.ts`.
- `pnpm build:e2e` passes, which includes the first-paint check and the drafts check.
- These end-to-end specs pass: `learn-stage-fit`, `learn-cold-open-fold`, `learn-no-planning-text`,
  `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-lesson-08`, `learn-sound-gate`,
  `learn-publish-state`, `learn-frame-loop` and `learn-lesson-09`.
- Each `dist/learn/NN.html`'s stylesheet links are the same files, in the same order, as in main's
  build (MISTAKES.md:919-924).
- Lessons 3 and 4 still fit under their ceilings, since the new season fields and drafts line add
  bytes to every lesson page.

Depends on: B1, and the decisions in section 6, items 1 and 2.

**B5. The ladder chart controller**

- **Goal:** a new `lesson-09/ladder-chart.ts` that mounts the kit's band chart (A1) on a notes
  axis, using B3's voice and windows.
  - It draws seven states: compact, step, hear, ladder, order, landing and free play. It also
    provides live mode's frame for B13.
  - It follows `VoiceChoice.subscribe` (`kit/voice-choice.ts:20-48`) and Move do.
  - Its `describe()` summaries use spoken names only, for example "Do, D3, and so, A3, with Merc's
    leap between them" and "Do is D3".
  - An arc draws as its second note starts.
  - Under reduced motion, arcs and traces draw whole at once and bands light without a pulse.
- **Tests:** `ladder-chart.test.ts`, through a recording context or by inspecting the scene:
  - each state's rungs, window and names;
  - every window holds every note its state plays (the last clause of Tests 4);
  - no summary holds a sign;
  - reduced motion lands every state in its end state.
- **Done when:** `learn-stage-fit` passes with the chart mounted at all four short landscape sizes.
- **Depends on:** A1a, A1b, B2, B3 and B4. Also A7, if the page is to rest.

**B6. Cold open and predict**

- **Goal:** a new `lesson-09/cold-open.ts`.
  - It mounts the kit's predict with three choices, re, mi and fa.
  - Play Merc's leap is a `[data-free]` play, so it works before a choice. The three plays are
    "Play do, re, so", "Play do, mi, so" and "Play do, fa, so".
  - It sets `revealOn: ['re', 'mi', 'fa']` and `revealAfter: 'all'`, with the four hints and the
    `guess` line ("You said: mi"), as spec Toys 2 gives them.
  - Every play is a kit run (A2) that claims `NowPlaying` and resolves `false` when cut short.
  - The chart draws each path (B5), and a polite live region speaks it (B4).
  - The Merc of the chart's voice sings, and Tavi celebrates once at the reveal, with no sparkles.
    Whether Merc also hops is section 6, item 9.
- **Tests:**
  - Unit: `cold-open.test.ts` with fake timers and the run recorder, covering Tests 10 and 15.
  - End to end: End to end 2, at 390x844 and 1440x900.
- **Depends on:** A2, B4 and B5.

**B9. Recall and quick check**

- **Recall** (`lesson-09/recall.ts`):
  - It follows `lesson-05/recall.ts:16-23`: `createQuiz` with prefix `rc-`, the keys
    `fyp-l09-recall-seed` and `fyp-l09-recall-v1`, no `lesson`, and
    `away: { href: recallStepHref }`.
  - Its questions are Lesson 6's `l06-q2` and `l06-q3`, imported from `lesson-06/quiz-questions.ts`
    as `lesson-08/quiz-questions.ts:20` does.
  - It shows to everyone, so it does not use Lesson 8's `data-if-live` wrapper.
  - The question's Play goes through `lesson-06/quiz-play.ts`'s `bindQuizPlays`, which already
    claims `NowPlaying`, as `lesson-08/recall.ts` uses it.
  - `initRecall` runs after `initMasthead`.
- **Quick check:**
  - `lesson-09/quiz-questions.ts` holds `l09-q1` to `l09-q4` from LESSON.md.
  - `main.ts` calls `createQuiz({ questions, lesson: 9, keys: { seed: 'fyp-l09-seed', record:
    'fyp-l09-quiz-v1' }, deck })`.
- **Tests:**
  - Unit: Tests 11. Every line passes the claims check, and no feedback line starts with "Right",
    "Yes" or "Correct".
  - End to end: End to end 8.
  - End to end 13 goes in `learn-publish-state.spec.ts`, using `serveWith(page, '/learn/09', {
    drafts: false, lessons: { 9: { published: true }, 6: { published: false } } })`.
- **Depends on:** B2. The telemetry already accepts Lesson 9's questions (section 1).

**B7. Steps 1 and 2, with the folds strip**

- **Files:** `lesson-09/steps.ts`, the steps' module, which B8a and B8b extend, and
  `lesson-09/folds-strip.ts`.
- **The folds strip:** a 64 px canvas under the chart, inside the same figure, so the stage fit
  sizes both together.
  - It uses the kit's folds with A6's vibration, slowed 220 times by `createSlowClock`.
  - The folds rest apart when nothing sounds, and become stills under reduced motion.
- **Step 1:** Step, and "Leap: do up to so". Slow carries `aria-pressed` and doubles every length.
  The status line names the move and gives the ratio (B4).
- **Step 2:**
  - Hear it first plays so alone and lights its band, with the status "So: hear where the leap
    lands.".
  - Leap and Slow work as in Step 1.
  - The illustration carries the label "an illustration".
- **Tests:**
  - Unit: `steps.test.ts` with `loadPage` and the run recorder: the status lines, `aria-pressed`,
    the doubled lengths, and the stills under reduced motion.
  - End to end: Steps 1 and 2's part of End to end 3.
- **Depends on:** A2, A6 and B5.

**B8a. Steps 3 and 4**

- **Step 3:** Climb lights each band as it sounds. Leap to so and Leap to the top do draw their arcs
  over the slots the climb went through. Each leap has its status line.
- **Step 4:** rung mode. Play the five leaps draws a numbered arc as each second note sounds, over
  12.4 s, or 24.8 s with Slow. Each leap has a status line such as "1 of 5: …".
- **Tests:** `steps.test.ts` with fake timers: the order, the numbers, the timing and the status
  lines.
- **Depends on:** B5, B7 and A2.

**B8b. Step 5, and stopping sound when the viewer leaves a step**

- **Step 5:**
  - Play sounds the illustrated landing through `contourVoice` in the soft tone
    (`kit/sound.ts:321`).
  - It also has Pause, and Slow, which stretches the landing to 6.0 s.
  - The scrub bar follows Lesson 3's native range on its band chart. It runs 0 to 3 s in tenths of
    a second, with Home and End for its ends, and an `aria-valuetext` such as "1.4 seconds of 3: 80
    cents below Merc's note, outside the band".
  - The readout uses `bandValueText`. The band's edge lights with "IN THE BAND".
- **Leaving a step:** the deck calls each toy's `onStep(step, previous)` (`kit/step-deck.ts:167`).
  The page stops the step's runs whenever `step` differs from `previous`, and never on a layout
  switch, which calls it with the same step.
- **Tests:**
  - Unit: Tests 14 for the step routes. With Step 4's five leaps sounding, each route stops them:
    Previous, Next, a swipe, the lesson menu's jump, a `#step-N` address and a quick-check link.
    Running the clock past their end starts no note, and `onStep` with the same step stops nothing.
  - Tests 14's other cases (a word play over the climb, a free-play rung over the recall's notes)
    land with B10 and B14.
  - End to end: the scrub bar by keyboard.
  - Only if the scrub bar ends up a custom pointer control: a real-mouse `@smoke` spec, plus the
    touch paths in CONVENTIONS.md § 6.
- **Depends on:** B8a.

**B10. Four words**

- **Goal:** `lesson-09/words.ts`, built on `bindWordPlays` with `{ owner: NowPlaying }`.
  - Leap plays do up to so, with its arc.
  - Third plays do up to mi, then mi up to so.
  - Arpeggio plays do, mi, so and the top do.
  - Landing zone lights so's band and plays nothing. Its label is section 6, item 4.
- **Tests:** `words.test.ts`: each button's runs; the landing zone plays nothing; a word play over
  Step 3's climb stops the climb (a Tests 14 case).
- **Depends on:** A2, B2 and B4.

**B12. Sing it, without the microphone**

- **Goal:** `lesson-09/sing.ts` builds the card's states 1 to 5 and state 9. What it offers comes
  from B11's rule.
  1. The comfort check, through `mountComfort` (`kit/comfort.ts:159-166`).
  2. The voice choice, with its two lines (`kit/voice-choice.ts`). It comes before either path.
  3. Just listen today: Play Merc's ladder lights the rungs, with the doctor lines and the rest
     card.
  4. The warm-up (`kit/warm-up.ts`), whose Skip is stored as `fyp-l09-warmup`.
  5. The briefing: Your turn, the stop line, "What this does", the ladder choice (`aria-pressed`),
     Move do (lower and higher, four each way, each end's button disabled), Play Merc's ladder and
     Start.
  - With sound off, Start shows its hint and asks for no microphone.
  - Without Web Audio, Sing it is listen-only at once, with the hint "This browser can't play sound
    here.".
  - The Wrap's card comes from `VisitEnding` and `mountPractiseCard` (`kit/comfort.ts:101-149`).
- **Tests:**
  - Unit: `sing.test.ts`, with `loadPage`, the run recorder and a `getUserMedia` spy. Every state's
    controls match what the rule offers, and nothing is written to storage except `fyp-voice` and
    `fyp-l09-warmup` (Tests 7's storage clause).
  - Unit: on the page's own Move do buttons, each end's button is disabled at four steps each way
    and enabled again one step back (Tests 3's button clause; DECISIONS 15).
  - End to end: Just listen today never calls `getUserMedia`, and the sound-off hint shows.
- **Depends on:** A2, B3, B5 and B11.

**B13. The take**

Files: `lesson-09/sing-take.ts`. In order, it does the following.

1. Start loads the listener through its dynamic import, using A8's holder or Lesson 7's pattern, and
   calls `listen('lesson-09', Sound.context())`.
2. Merc sings the ladder, each slot's band lighting as he sings it.
3. At least 0.4 s after his last note, it runs `takeFrames` with `wait: 6` and `run` set to 6.0 or
   7.5 s (`kit/listen.ts:168-195`).
4. The guide: do's band glows until the voice starts, then each slot's band glows in turn from the
   first voiced frame.
5. The live violet line is folded around the glowing rung with `foldCents`, with the octave tag
   (A3) and pins at the chart's edges.
6. `readLadder` (A4) gives one `rungLine` per note, the lit edges, the count and the "tricky" line.
7. "How did that feel?" goes through `mountFeelings` with its default, so an answer locks, and
   `reset()` frees it for the next take.
8. Again, Again smaller and Done for today follow. Merc celebrates once when every heard note
   landed.
9. Hiding the tab or leaving the section abandons the take and releases the microphone at once.
   Nothing from the take is stored.

On the first-paint side, import only types from `kit/listen` and `kit/take`. Everything else comes
through the loaded module, as `lesson-03/sing-take.ts` does.

- **Tests:**
  - Unit: take cases in `sing.test.ts` with a fake listener, as Lessons 3 and 7's sing tests do.
  - End to end: a new `src/e2e/learn-lesson-09-sing.spec.ts`. It covers End to end 6, with
    `fakeMicArgs`, `writeToneWav(220)` on the lower full ladder, a D3 tone for the octave line, and
    `writeStepsWav` for the 4-of-4 case if A5 holds up. It also covers End to end 7, with a spy on
    `MediaStreamTrack.stop`.
- **Done when:** first paint has not grown by more than a little. A jump of tens of KB means the
  take's boundary broke: fix the import, and never raise the ceiling for it.
- **Depends on:** A3, A4, B11 and B12. A5 for the 4-of-4 case; A8 recommended.

**B14. The Wrap and the footer**

- **Goal:** `lesson-09/wrap.ts`, plus the markup it needs.
  - Free play puts the chart in rung mode with four rung buttons, named "do, D3" and so on. A second
    tap plays the leap between the two rungs, with its arc and its line. It has Hear it first, Slow,
    and a voice switch ("Lower voice", "Higher voice") that lasts for the visit and stores nothing.
  - The recap lines and the challenge.
  - The practice card, with "Ten minutes, gently, most days" and a link to
    `/pitch-training?lesson=09` in a new tab, or the rest card, as B12 decides.
  - The next card's tease figure in `[data-next-card]`: an inline SVG of the pitch spiral with do,
    mi and so lit and one "?" over all three, and no button. The pattern is
    `learn/08.html:1646-1669`.
  - The footer's lines.
- **Tests:**
  - Unit: `wrap.test.ts`: the free-play lines; the voice switch stores nothing; a free-play rung
    over the recall's notes stops them (a Tests 14 case).
  - End to end 9: every practice link carries `?lesson=09`, and `/pitch-training?lesson=09` in a
    fresh profile opens the Exercises tab with no intro, as `src/e2e/lesson-marker.spec.ts:66-75`
    checks.
  - End to end 10, in `learn-next-card.spec.ts`: Lesson 9's card names Lesson 10 and says "Coming
    later"; its words come in the order eyebrow, next-tease, q2, chip; its children are
    `next-words` then `l09-tease`; and it holds no button.
- **Depends on:** A2, B5 and B12.

**B15. End-to-end checks across the page**

- **Files:**
  - `learn-lesson-09.spec.ts`: End to end 1; End to end 3 as a keyboard sweep; End to end 4 at
    390x844 and at 344 px wide; End to end 11 under reduced motion; End to end 12, checking the
    storage keys after a full run.
  - `learn-publish-state.spec.ts`: End to end 13, if B9 did not add it.
  - `learn-frame-loop.spec.ts`: Lesson 9's explorer rests. If A7 landed and every Lesson 9 drawer
    has a `wants`, the whole page rests too.
- **Done when:** all of these pass on `build:e2e` at both viewports.
- **Depends on:** B5 to B14.

**B16. Final measurement and docs**

- Re-measure first paint in `build:e2e`, and set Lesson 9's two ceilings to the measured size plus a
  quarter, with the reason.
- Compare each `dist/learn/NN.html`'s stylesheet links with main's build.
- Run the app-check skill at phone and desktop widths with Sing it in every state, locally or on
  dev, never against production. Walk the spec's QA list (spec Contract).
- Run `pnpm lesson:words`; the spec gives 2,346 words. Then run `pnpm plan:cites` to re-anchor the
  spec's citations that drifted (section 6, item 12), and `pnpm plan:cites:check`.
- Fix the stale headers:
  - `now-playing.ts:14-15`;
  - `merc-hop.ts:8-9`, if the page uses `mercHop`;
  - the mirror-metrics comment that counts `createQuiz` sites.
- After the page merges, write the shared records HANDOFF § 6 asks for: MASTER-PLAN § 11 and its
  CURIOSITY-MOMENTS heading. Move the rungs, the runs and the ladder reader into HANDOFF § 4.1's
  "Done since the specs were written".
- **Depends on:** all B tasks.

### App (C): independent of the page

**C1. The `intervals` launch field and `/exercises/leap-ladder`**

- **Files:**
  - `src/features/exercises/slug-map.ts`: add `intervals` to `ExerciseLaunch` (`:24-36`), and add
    `'leap-ladder': { kind: 'exercise', exercise: EXERCISE_INTERVAL_TRAINER, intervals: [3, 4, 7,
    5, 12] }` to `EXERCISE_SLUGS` (`:47-64`).
  - `src/App.tsx`: `applyExerciseSlug` (`:724-767`) passes the intervals into `setLaunchOverride`
    (`:754-762`).
  - The launch-override module (`:18`, `:34`, `:46`): a reader for the intervals.
  - `use-interval-trainer-controller.ts`: use the given intervals in place of `INTERVAL_POOL`
    (`:37-44`), which has no minor third. Either run five rounds or let intervals repeat
    (`plannedRounds` `:48-53`, `generateIntervals` `:55-64`).
- **Tests:** a line in `src/tests/slug-map.test.ts`, and controller tests for the pool override and
  the round count.
- **Done when:** the app checks pass. The lesson card's wording changes later, when LESSON.md's
  editorial note gives the new sentences and the season entry's `needs` turns into a second link.
- **Also serves:** Lesson 6's planned slug (Lesson 6 WEB-SPEC:514).

**C2 (optional).** `/exercises/arpeggio-jumper`, a data-only slug, with its line in the slug-map
test.

**C3 (owner decision).** Arpeggio Jumper counts "richness" as a quarter of its grade
(`use-arpeggio-jumper-controller.ts:301`). Leave it out of the grade, or name it in the result.

**C4 (content).** Rewrite the Ascent's "Tuning & Ear" week (`path-content.ts:186`) against the
claims rules. The page does not link it.

## 5. The test shifts B2 carries

Tests that today use Lesson 9 as "the lesson with no page" move to Lesson 10, whose title is "Major
and minor", in the same commit that adds `learn/09.html`. Commit `1108914f8` made the same moves
from Lesson 8 to Lesson 9.

Unit tests:

- `kit/lesson-menu.test.ts`:
  - `:36-47`: Lesson 9's row becomes `ready`, reading "Ready · 16 min" and linking `/learn/09`. Use
    row 10 as the example of a lesson coming later.
  - `:50-60`: the label example becomes "Lesson 10, Major and minor, coming later".
  - `:62-66`: `Array(6)` becomes `Array(5)`.
  - `:144-155`: `'ready'` four times, then five `'later'`.
- `kit/next-card.test.ts`: `:76-88` and `:320-335` move to `nextCard(…, 9)` and
  `createNextCard(9)`, Lesson 10, "Major and minor", with `data-select-lesson` `'10'`.
- `kit/explorer-reveal.test.ts:303-317`: `pageWithNextCard(9, 10)` and "Major and minor".
- `kit/publish.test.ts`:
  - `:44-55` finds a lesson with no page (B0, or here).
  - Add two tests in the shape of `:75-82`: Lesson 9 held back has neither page nor reading time,
    and `defaultPageState(true)` keeps both (Tests 12).
- `kit/season.test.ts`: add a test in the shape of `:269-284`, checking `/learn/09`, 16 minutes, no
  film and the link `/pitch-training?lesson=09`. The test at `:286-303` then covers the page by
  itself.
- `src/features/admin/lessons/lesson-admin.test.ts:96` and `:481`: use `rowFor(10)`, or the
  planned lesson that B0 finds.
- `src/features/admin/AdminLessonsPage.test.tsx`:
  - `:86-99`: "404 Not found" four times, then `Array(5).fill('No page yet')`, and the comment
    becomes "Lessons 6, 7, 8 and 9".
  - `:106-117`: `/learn/09` joins the paths asked for.

End-to-end specs:

- `learn-next-card.spec.ts`:
  - `CARDS` (`:26-74`): Lesson 8's row becomes "Next lesson 09 · Landing a leap Ready · 16 min",
    linking `/learn/09`, "Start lesson". Add a `/learn/09` row for Lesson 10: "Coming later",
    `#explorer`, "See it on the map".
  - `:190-207`, "a lesson coming later opens the map": move it to `/learn/09` with "Major and
    minor".
  - The tease test for Lesson 9's card is B14's.
- `learn-explorer.spec.ts:141-158`: `/learn/09`, and "Major and minor".
- `learn-lesson-menu.spec.ts:378-382`: "Lesson 10, Major and minor, coming later".
- `learn-lesson-08.spec.ts`:
  - `:260-283`: Lesson 8's card now leads to `/learn/09`, reading "Ready · 16 min" and "Start
    lesson", as `learn-lesson-07.spec.ts:244-262` checks Lesson 7's card.
  - The header comment at `:16` changes to match.
- `learn-sound-gate.spec.ts:15`: add `'09'`, and update the header's "Lessons 1 to 8".
- `learn-frame-loop.spec.ts`: add Lesson 9 (B15), and update the header's "Lesson 1 to Lesson 8".

The cross-lesson specs pick the new page up by themselves and need no edit: `learn-stage-fit`,
`learn-cold-open-fold` and `learn-no-planning-text` read `lessonPages`.

## 6. Ambiguities, conflicts and blockers

1. **The description (conflict; blocks B2).** `lesson-pages.test.ts:191-210` requires "A
   sixteen-minute lesson" in the meta description and in the Article's description, which must also
   equal each other (`:182-183`). The spec's text ("… Hear it first, aim at its band, and sing
   do-mi-so-do as a ladder. A free lesson in your browser.") passes neither check.

   It also names do-mi-so-do. A reader can take that to mean mi, which is the predict's answer, and
   HANDOFF § 5 records answer leaks as the season's most common review finding.

   A wording that fits the pattern of Lessons 7 and 8, at 147 characters, inside the 80-160 the
   test allows: "How do you land a note you have to leap to? A sixteen-minute lesson on big
   leaps: hear the landing note first, aim at its band, then sing a ladder."

   The lead decides the copy. Need 2 in the spec should then be updated to match.
2. **A half-built draft on dev (decision; before B2).** If B2 onwards land on main one task at a
   time, dev and every preview show Lesson 9 with toys that do nothing until their task lands. Lesson
   8's card on dev will then also say "Ready · 16 min".

   The console can publish any draft. It asks first ("Publish … before its sign-off?",
   `AdminLessonsPage.tsx:201`) and shows the draft's reason as "Waiting on …"
   (`lesson-admin.ts:429`).

   There are two options:
   - Accept it, and word the drafts line for the build period. For example: "the rest of its page,
     then the vocal coach's sign-off (MASTER-PLAN § 12 item 8)". No test pins the reason's text.
   - Use the one-branch alternative in section 3.
3. **The share card (blocks B2).** `lesson-pages.test.ts` requires the card as soon as the page
   exists. The repo has no generator, and the spec wants the card drawn with the kit, so it comes
   after A1. Do not commit a placeholder: `public/` is served everywhere.
4. **The fourth word's button (B10).** LESSON.md has "[Show: so's band lights]", while spec Toys 3
   has "Show: so's landing zone". LESSON.md is the copy's source, so either change that copy or
   correct the spec.
5. **Where `readLadder` starts its slots (A4).** The spec starts the slots at the first voiced
   frame as Voice Mirror's `preprocess` keeps it. `takeFrames` times the take from a raw test
   instead (`listen.ts:112`, `:184`: f0 above 0 and confidence at or above `CONF_MIN`), and the live
   guide follows that. The two can differ by a few 16 ms frames.

   Recommendation: `readLadder` takes the start as an optional parameter, defaulting to
   `preprocess`'s first voiced frame. The page passes the take's own `voicedAt`, so the bands the
   guide lit and the slots the reading uses agree. Tests 6 should cover both. With 1.5 s slots and
   a 0.3 s attack trim, a few frames are harmless either way.
6. **Rung names in a 40 px gutter (A1b).** In the 12 px monospaced font, "top do · D4" is about 80
   px wide and "so · A3" about 50 px. The notes axis leaves 40 px (`band-chart.ts:165`), and the
   grid writes its labels right-aligned at x0 minus 8 (`band-chart-draw.ts:135`). So either the
   gutter widens when rung names are given, or the names are drawn inside the plot beside each band.
   Either choice changes only width, so the spec's px-per-semitone figures, which are heights, still
   hold. Check it at 344 px wide.
7. **Arcs in rung mode (A1b, B8a).** In Step 4 the rungs span the whole plot, and the spec does not
   say where each of the five numbered arcs sits in time. Proposal: five equal columns in play
   order, each arc spanning its column, with its number beside the apex.
8. **`writeStepsWav` timing (A5, B13).** The fake device starts playing its file when Chromium
   opens it, and loops it (`tone-wav.ts:74`). The 8 s lead must cover three things: loading the
   listener, Merc's ladder and the 0.4 s gap. The tones must then begin inside the take's 6 s wait.
   The test cannot pin that start.

   A `%noloop` suffix on `--use-file-for-fake-audio-capture` may stop the looping; that was not
   checked here. The spec already allows the unit tests to carry the per-note readings instead.
9. **`mercHop` (B6).** `kit/merc-hop.ts` is a hop in place that lands a beat `HOP_MS` (530 ms)
   after it starts; it was built for Lesson 8's claps. Using it for Merc's leaps means starting it
   `HOP_MS` before each leap's second note. The spec allows `mercSing` alone instead. If the page
   uses it, update the header that says only Lesson 8 imports it.
10. **First-paint headroom (A1, A7, B2).** Lesson 3 has about 848 bytes of room and Lesson 4 about
    882 (`bb9d432d1`). Lesson 5's room was not measured here. B2's season fields and drafts line add
    bytes to every lesson page, and any code added to `band-chart.ts` or `band-chart-draw.ts` adds
    to Lessons 3 and 5. Keep the new painters in `kit/band-chart-rungs.ts`. If a ceiling must rise,
    raise it in the same change and say why (the budget file's rule, `:47-58`).
11. **Resting the frame loop (A7, B15).** Without a band-chart `wants`, Lesson 9's page never
    rests. Lessons 6 to 8 do rest, and their spec holds them to it. Decide whether Lesson 9 joins
    them. That is recommended, and it needs A7 plus a `wants` on the folds strip and on any drawer
    the page adds.
12. **Drifted citations (B16).** Places where the spec's citations no longer match the code:

    | What                   | Spec cites | Now at                       |
    | ---------------------- | ---------- | ---------------------------- |
    | `BandAxis`             | `:38-46`   | `:39-46`                     |
    | `drawNotesGrid`        | `:112-137` | `:116-137`                   |
    | `drawLitEdge`          | `:185-203` | `:186-203`                   |
    | `mountComfort`         | `:158-166` | `:159-166`                   |
    | `mountFeelings`        | `:168-206` | `:175-206`                   |
    | `VisitEnding`          | `:89-114`  | `:101-114`                   |
    | `merc-duo.ts`          | `:164`, `:206`, `:216` | `:143`, `:185`, `:195` |
    | `applyExerciseSlug`    | `:593-638` | `:724-767`                   |

    In the text itself: item 12's `mercHop` exists in a different file, and item 9's owner is
    already in the kit. Re-anchor with `pnpm plan:cites`, then check by content (HANDOFF § 5).
13. **Not build blockers.** Publishing waits on the vocal coach's sign-off and on Lessons 3 and 6
    being live (the spec's intro). Nothing in the code enforces either. C1 to C4 do not gate the
    page.

## 7. Where each spec test lands

| Spec test                                     | Task                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Tests 1, 2, 3 (ladders, spelling, Move do)    | B3; Tests 3's disabled end buttons in B12 (DECISIONS 15)                |
| Tests 4 (sounds, drawings, timings, readouts) | B4; its window clause in B5                                             |
| Tests 5 (band chart with rungs)               | A1a, A1b                                                                |
| Tests 6 (ladder reader)                       | A4                                                                      |
| Tests 7 (Sing it flow)                        | B11; its storage clause in B12 and B13                                  |
| Tests 8 (copy)                                | B4 (templates), B2 (`page.test.ts`), B9 (quiz feedback), A4 (rung lines) |
| Tests 9 (frequencies)                         | B4                                                                      |
| Tests 10 (predict)                            | B6                                                                      |
| Tests 11 (quizzes)                            | B9                                                                      |
| Tests 12 (season data)                        | B2 (B0 for `publish.test.ts:44-55`)                                     |
| Tests 13 (`restAfterEffort`)                  | Already in the kit; B11 passes the option                               |
| Tests 14 (one sound at a time, leaving a step) | B8b; more cases in B10 and B14                                         |
| Tests 15 (a play cut short)                   | A2 (kit run), B6                                                        |
| End to end 1                                  | B2 (spec started), B15                                                  |
| End to end 2                                  | B6                                                                      |
| End to end 3                                  | B7, B8a, B8b, B14 each, then B15's sweep                                |
| End to end 4                                  | B15; the short landscapes are covered from B2 by `learn-stage-fit`      |
| End to end 5                                  | Automatic from B2                                                       |
| End to end 6, 7                               | B13 (A5 for the 4-of-4 case)                                            |
| End to end 8                                  | B9                                                                      |
| End to end 9, 10                              | B14 (the card itself exists from B2)                                    |
| End to end 11, 12                             | B15                                                                     |
| End to end 13                                 | B9 or B15, in `learn-publish-state.spec.ts`                             |
