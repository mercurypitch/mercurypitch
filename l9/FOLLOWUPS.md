# Found while building Lessons 9 and 10 (not fixed in the task that found them)

- kit/run.ts (A2): a run's length comes from the array's last note (`last.t + last.dur`), not the note that ends last. With chords or unsorted notes, `done` resolves while a voice still sounds, and stop() can no longer cut it. Matters for Lesson 12's chords.
- kit/run.ts (A2): `playLine` ignores RunOptions.gain; `playNotes`/`playNote` ignore RunOptions.timbre.
- PLAN.md G1 cites lesson-07/play.ts lines; after A2, cite kit/run.ts. The repo itself has no citation of play.ts.
- A2 review (READY): S1 run end (fixing in A2 commit 2), N1-N3 and N6 (A2 commit 3). Open: Lesson 12's WEB-SPEC need 8 (:876-880) and HANDOFF.md:196-197 still ask for "a schedule that can be stopped" without naming kit/run.ts; point them at it (B16 or the docs pass). The kit now has three timed-note shapes: RunNote {t, midi, dur}, TuneEvent {midi, at, dur}, EarNote {midi, at, dur}.
- A8 (feat/kit-mic-hold) is stacked on 059f5be4d; rebase it onto feat/kit-run's tip once A2's fix commits land.

## Arpeggio grading (arp/CONSENSUS.md, 24 October)

- The Practise it card's copy does not mention the richness term, so the page is safe whichever grading is live.
- One sentence depends on an owner decision: "They want each note in the octave they play, not an octave away" (LESSON.md:294-295; WEB-SPEC.md:551-552). If Arpeggio Jumper v2 ships the per-run octave offset, the sentence stays true for Interval Trainer only, and the card must say which drill follows the singer's octave. Build the card as written until the owner decides.
- The "For the vocal coach" note (LESSON.md:424-426), FACTS 50 and the WEB-SPEC app-content proposal (:553-557) change when v2 lands. That is a docs edit, not page code.

## From the B3 and B4 review (review-b3b4/REPORT.md)

- Integration (N3): once A2 is in, `export type SoundNote = RunNote` in lesson-09/sounds.ts, and cite kit/run.ts, not Lesson 7's play.ts.
- B13 (N4): pass `slotSec: LADDER_NOTE_SEC` to readLadder, or assert LADDER_NOTE_SEC equals A4's LADDER_SLOT_SEC (FACTS 76 makes them one number). sounds.ts must not import take.ts.
- B8a: when Climb plays in Step 3, clear the last leap's status line. B4 gives Climb no line of its own.
- B8b:
  - landingSound has no `from`, so resuming after Pause or a scrub needs one. Lesson 7's sirenContourFrom is the precedent.
  - The kit's playLine has no `at`, so B8b schedules the glide itself and stops both voices on a cut.
  - landingAt and landingTrace take at-speed seconds, so under Slow B8b halves its clock. Add a unit test under Slow.
- B7: COPY_TRACE is in at-speed seconds and has no `slow`.
- B9: if FACTS 96 wants a unit check, assert Lesson 6's QUIZ_FOURTH, never a copy.
- Integration: fold B3's and B4's fixup commits, and apply scratchpad/l9/b3-msg.txt and b4-msg.txt as their messages.

## From C1 and A4

- B13: `{ heard: false }` shows state 7's "didn't hear you start" line (WEB-SPEC.md:420). The kit has none (DECISIONS 19).
- B13: build each rung's line with `rungLine(label, slot)`, never `slot.line`, which carries the retry advice. The count line is `countLine(count) ?? NONE_HEARD_LINE`, and the tricky line comes from `trickyAfter(count)`.
- Docs, once C1 is in: Lesson 9 FACTS 59 ("a slug launch carries only exercise, notes, scaleId and difficulty") and 60's engineering note, CURRICULUM § 4's "Data alone is not enough" paragraph, and Lesson 6's matching facts are out of date. They change in the page PR's docs commit, or in C1's PR if the reviewer says so.

## From the quiz review (review-quiz/REPORT.md)

- Season-wide (not this page): no test holds a quiz's words or option order to its LESSON.md's `## Quick check`. Lessons 6 to 9 rely on review. A shared test that parses each LESSON.md and compares it with the module, allowing for the curly quotes and the `tryStep` markup, would catch drift; review-quiz/compare.py is a start. Lesson 8's test also lacks the right-answer-first case.
- Integration docs pass: record the curly quotes in Lesson 9's FACTS (as Lesson 8's FACTS 3 does for Lesson 6): q1's `"aim"`-style straight quotes in LESSON.md are curly in code.
- B9: `recall.ts` imports `RECALL_QUESTIONS` from `./quiz-questions` (DECISIONS 20); the recall tests are already in the quiz commit.

## Asks from Lesson 10's plan (l10/DECISIONS.md 14)

- B15: pad `open()` in `learn-frame-loop.spec.ts:207-214` with `String(n).padStart(2, '0')`, as `learn-lesson-menu.spec.ts:258` does; today it loads `/learn/010` for Lesson 10.
- B2: the recorder for kit runs lives beside `kit/run.ts` (a kit test fixture), never page-local, so Lessons 10 and 12 import it.
- B2: the map test in `learn-next-card.spec.ts`, `learn-explorer.spec.ts:141-158` and `learn-lesson-menu.spec.ts:378-382` find "the first lesson with no page" by B0's `lessonWithNoPage()`, as B0's unit tests do (end-to-end specs already import kit fixtures, `learn-no-planning-text.spec.ts:20`), so no later page shifts them.
- B12: Move do's end buttons assert `aria-disabled`, from Lesson 10's K3 (`feat/kit-move-do-aria`), which the page branch picks up first.

## From the B11 review (review-b11/REPORT.md)

- Integration (S4): after B11 is cherry-picked onto the page branch, the first page task that imports both modules (B12) makes the flow `import type { LadderId } from './ladder-data'`, drops its own type, and renames its `LADDERS` to `LADDER_ORDER`.
- B13 (N2): fire `mercCelebrate` once, when `celebrate` turns true (or in the feel handler, as Lesson 5's hold-flow does), never on every render.
- B13 (N4): if the listener heard a voiced frame but the reader kept none, pass 'unsteady', not 'none'.
- B13 (decision 23): send the new cancel event when the sound turns off while Merc sings, before the take listens.
- B12 (N6): set `VisitStart.sound` the way the kit reads it: `Sound.canPlay` counts 'unset' as on.
- Season (decision 24): Lessons 5 and 7 show a retry cue after the last take with no retry control; align them with WEB-SPEC's rule.

## From the A5 and A8 builds

- `jam-room-rows.spec.ts:246` and `jam-stage-layout.spec.ts:787` fail in this container with main's own helper as well (words at y 191 against 190; a seam 6.06 points off against 3). Not Lesson 9's; a container or main issue to note when the jam specs are next touched.
- A8 adds 52 bytes to Lesson 7's first paint (134468 to 134520), the cost of passing the consumer id in; accepted, inside the ceiling.

## From the C1 review (review-c1/REPORT.md)

- N1: two test files for one module (`src/tests/exercise-interval-trainer.test.ts` and the colocated `use-interval-trainer-controller.test.ts`): move the old one by `git mv` (precedent acd879e41) the next time the trainer's tests change.
- N4: `intervalRangeLabel` "X through Y" can overstate a list of three or more, and at level 1 leap-ladder plays four of five; name each interval when the list holds three, if it ever matters.
- N5: at integration, if cheap, move the re-anchored citations out of 14ce2ef77 into the docs commit.
- Lesson 9's card: do not promise all five leaps at every level; "each leap at least once" holds from level 2 up. Lesson 6's card: with two intervals the order strictly alternates; do not call it shuffled.

## From the A3 and A6 builds

- B7 (64 px strip; a6-shots/ panels 01-23): skip `drawFoldLabels` in the strip (FRONT and BACK clip); give the stills' words a place beside each pair, or compose B7's own stills from `foldVibration`, `drawFoldPair` and `drawFoldText`; optionally scale the folds' thickness by h/180 for Lesson 3's slender look, keeping the vibration in fixed pixels; use `foldStretch(hz)` from `kit/folds-sing.ts` (decision 25).
- RELEASE-REVIEW.md cites `sing-take.ts` and `toy-folds.ts` lines pinned to fd2166c; they are history, leave them.

## From the reviews of 24 October (lead)
- Kit-wide: `drawTrace` leaves lineCap/lineJoin round (band-chart-draw.ts:224-225), so Lessons 3 and 5's full-width glow overhangs the plot by 6 px from frame 2. Its own change, after Lesson 9 (A1a review B1 fixes it for rungs only).
- A3 S2: Lesson 3's first paint +34 bytes (132336 -> 132370), accepted; headroom 750 under 133120.
- A3 N2: the page PR's docs commit cites `octaveTag` (kit/band-words.ts:94-99) in Lesson 9 WEB-SPEC state 6 (:350-351).
- A5 N4: the page PR marks writeStepsWav built in Lesson 9 WEB-SPEC :729 and :919-921 and Lesson 14 WEB-SPEC :894 and :1145 (as Lesson 7's :661 does).
- B13: the smaller ladder (7.5 s) needs a longer lead than 8 s (A5/A8 review).
- A8 N3: Lesson 5's `class Mic` and Lesson 3's mic holder are still copies of MicHold: a follow-up.
- B0 N4: AdminLessonsPage.test.tsx:192-194 and AdminLessonsPage.publish.test.tsx:239-241 find a planned lesson with `?? -1`: give them the helper.
- AdminLessonsPage 5 s timeout flake on main (B0 review): a separate small PR, `vi.setConfig({ testTimeout: 15_000 })` in both AdminLessonsPage test files with a comment naming the cost.

- C1 (/exercises/leap-ladder) rebased onto 2bc138b4e as fb120f4f9, 9563f75ab, 855efc050 (patch-ids equal to the fold). The browser spec exercise-slugs.spec.ts and first paint were run by the reviewer on 5e08dd4a3; on the new base CI runs them (24 Oct).

## From the page run 1 review (25 October)
- WEB-SPEC Toys 1, "Keyboard and screen readers": name Step 5's scrub bar and its native range ("Scrub the landing", decision 26), and list the group label "The ladder you'll sing" beside "The voice you'll sing with". Docs commit of the page PR.
- B12: move `@import '../kit/lesson-voice.css'` from lesson-09.css back to main.ts once Sing it loads both modules (imported from main.ts now, it splits the comfort chunk's sheet, and Lessons 3 and 5-8 link it after their own: MISTAKES.md).
- B6/B9: when the cold open and the quizzes load predict, quiz and hero-sky, the `reveal` chunk (the old `predict`, same bytes) goes; put Lesson 3's first-paint budget back to 130 and restate its comment. Lesson 9's budgets (89 JS, 105 CSS) rise with each toy, each with its own measure and reason.
- B6: Merc and Tavi stay hidden on the shell (`#duo.pending`) until the cold open removes the class, as Lesson 8's `cold-open.ts:93` does.
- Page PR docs: 10 and 12 WEB-SPEC still say to add a coming-later `CARDS` row (the next-card spec now derives it from `lessonWithNoPage()`); 12 WEB-SPEC:846 says "after Lesson 8's"; 11, 13 and 14 WEB-SPEC say "beside Lessons 3 to 8's". Each lesson's page run restates its own.
- plan-cites does not parse the citation at 08 WEB-SPEC:1179 (`:102-119` on its own); the builder moved it to 117-134 by hand. A parser case for the tool.
- LESSON-TOUR.md:34 and :235 say "eight pages"; B2's tour spec now walks nine. Restated in B2 once Lesson 9's shell is checked at 390 and 1440 px (lead, this run).
- Still to their own tasks: B15's `open()` padding; the practice card's copy predates C1; the spec corrections of decisions 4, 17, 21 and 22 go in with the code that implements them; the tour copy's LISTENING_LESSONS (B13).
- Kit (owner follow-up, not this branch): under 1181 px the tour's question mark hangs under the masthead's right end (lesson-menu.css:89-148) and covers the end of the hero kicker, the lesson number in "FIND YOUR PITCH · SEASON 1 · LESSON 08", at 390 px. Confirmed on main's code (lesson-tour worktree, 7b7a666e7) for Lessons 1, 2 and 8: "Lesson 01" ends at x 364 under the disc (338-374); at 360 px the kicker wraps and "LESSON 01" shows (page-1/review/kicker/). Sent to the owner 17:3x with the 390 crop, asking whether to fix it before the tag. A fix: room for the disc at the kicker's end below 1181 px. Ask the owner (they hold tour polish).
- `learn-lesson-08.spec.ts:224` (the quick check) failed once in the page run 1 gates (#scoreN 2, not 3) at a load of about 4.4 with the builders running; alone it passed 4 of 4, and it had not failed in eleven earlier runs. A guess: the "Try Step 2 again" link glides the page, and a click that lands mid-glide hits the wrong answer. If it fails again, make the test wait for the page to settle after the link.
- (page run 2) The hear state's canvas summary names do and so but not the illustration it draws; the four words' `[data-word-said]` line is empty. Both need copy from the spec or LESSON.md before a page task fills them.
- (page run 2) Lesson 3's budget back to 130: try once Lesson 9 loads the folds, the comfort check and Merc and Tavi's images (the three split chunks re-merge); 133,409 B at run 2, 289 over 130.
