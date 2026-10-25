# Lesson 9 build: lead decisions (24 October 2026)

Answers to PLAN.md section 6. Builders follow these; a builder who finds one wrong says so in its report instead of working around it.

1. Description: "How do you land a note you have to leap to? A sixteen-minute lesson on big leaps: hear the landing note first, aim at its band, then sing a ladder." (147 characters). The spec's need 2 is updated to match in the page PR.
2. Shipping: kit tasks (A) are separate small PRs. The page (B2 onwards) is one branch, `feat/lesson-09-page`, one commit per task, one PR, so dev never shows a half-built page. Nothing merges to main until the owner has cut the release tag; stacked branches (A1b on A1a, A7 on A1b) are fine until then.
3. Share card: rendered from the kit's own band chart (after A1) in a headless browser, 1200x630 baseline JPEG like lesson-08-og.jpg. Never a placeholder in public/.
4. Fourth word's button: LESSON.md is the copy's source, so "Show: so's band lights". The spec is corrected in the page PR.
5. readLadder: takes an optional start time, defaulting to preprocess's first voiced frame; the page passes the take's own voicedAt. Tests cover both.
6. Rung names: widen the notes gutter to fit the longest given name, only when rung names are given. Check at 344 px wide; if the plot gets too narrow there, say so with a screenshot instead of shrinking the type.
7. Arcs in rung mode: five equal columns in play order, each arc spanning its column, its number beside the apex.
8. writeStepsWav: try the `%noloop` suffix on --use-file-for-fake-audio-capture; if the start still cannot be pinned, the unit tests carry the per-note readings, as the spec allows.
9. mercHop: try the hop timed to land on each leap's second note (start it HOP_MS before); if it reads wrong in a screenshot or recording, use mercSing alone. Update merc-hop.ts's header if the page uses it.
10. First paint: new painters live in kit/band-chart-rungs.ts so Lessons 3 and 5 do not load them. Measure Lessons 3, 4 and 5 after every kit change; a ceiling that must rise rises in the same change with its reason.
11. Frame loop: Lesson 9 joins Lessons 6 to 8 in resting page-wide (A7, plus a wants on the folds strip and any drawer the page adds).
12. Citations: re-anchor with `pnpm plan:cites reanchor --base <ref>` in each PR that moves cited code, then `pnpm plan:cites:check` must not rise above main's count.

## From the B3 and B4 review (24 October 2026; review-b3b4/REPORT.md)

13. Free play's timing: each tapped rung sounds 1.0 s, Step 1's length, and a Hear-it-first leap waits 0.6 s, Step 4's gap. No fact gives free play's timing, so the code says these are borrowed. Free play is in the soft tone (WEB-SPEC.md:502), not Merc's voice.
14. Step 5's readout: none during do's first second. FACTS 94's readout begins when the leap lands at 1.0 s, against so, whose band glows throughout.
15. Tests 3 splits: Move do's limits and spelling stay with B3; "each end's button disabled" moves to B12's `sing.test.ts`, on the page's own buttons.
16. Review fixes go on the branch as `git commit --fixup=<sha>` commits, never a rebase. The lead folds them into their task commits at integration, and fixes the commit messages then.

## From the B11 build (24 October 2026)

17. Again, smaller's accessible name is "Again, smaller ladder". It must contain the visible label, "Again, smaller" (LESSON.md:239), and the spec's "Again, on the smaller ladder" does not (WCAG 2.5.3). The other two names stay as the spec gives them: "Again: do-mi-so-do" and "Again: the smaller ladder". The spec (WEB-SPEC.md:371) is corrected in the page PR.

## From the C1 and A4 builds (24 October 2026)

18. C1's three questions:
    - A launched list runs as many rounds as the difficulty table gives, past six at levels 7 to 10. The pool's ceiling of six was a limit of supply (it cannot give more distinct intervals), not a design rule, and Lesson 6's spec expects a short list to repeat.
    - `launchIntervals` keeps its octave cap. A later user of the field can widen it.
    - Leap-ladder runs share Interval Trainer's comparability key. The key is per drill type by contract (exercise-comparability.ts:13-17), and difficulty already varies within it.
19. FACTS 76's 1.5 s: B13 passes `slotSec: LADDER_NOTE_SEC` to readLadder and asserts that it equals the kit's `LADDER_SLOT_SEC`. sounds.ts never imports take.ts. The page, not the kit, owns the line for `{ heard: false }` (WEB-SPEC.md:420, state 7).

## From the quiz review (24 October 2026; review-quiz/REPORT.md)

20. The recall's questions live in `lesson-09/quiz-questions.ts` as `RECALL_QUESTIONS`, as in Lessons 4, 5, 7 and 8: Lesson 6's own `l06-q2` and `l06-q3` objects, filtered from Lesson 6's `QUIZ_QUESTIONS`, with Lesson 8's two recall tests. They move into the quiz commit from B9, whose `recall.ts` imports them from `./quiz-questions`. The quiz test also pins each right answer first (Lesson 4's case). A test holding every lesson's quiz words to its LESSON.md is a season-wide follow-up, not this page's.

## From the B11 review (24 October 2026; review-b11/REPORT.md)

21. A sound-off hint names the button just pressed, as every lesson's does: beside Start, "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start."; beside Start again, the same ending "then press Start again."; beside an Again button, "then press Again." The two new forms go into WEB-SPEC beside :340 in the same commit as the code.
22. The listen path shows its listen line and the doctor lines at once, before any voice is chosen, as Lessons 3, 6 and 8 do: the referral guidance never waits on an unrelated choice. Its voice line is Lesson 8's, "Choose a voice: it picks the Merc who sings.", added to LESSON.md and WEB-SPEC state 2. FACTS 3 and the spec's Length change with it if the word counter says so.
23. Sound turned off while Merc sings, before the take listens, cancels the take: a new event ends it without counting it, and the card returns to its state before Start with the sound-off hint. No take is spent on a ladder the viewer could not hear.
24. No retry wording without a retry control (WEB-SPEC.md:404): after the last take, the no-voice line keeps "We didn't hear you start that time." and drops "Start on do when its band lights." Lessons 5 and 7 still show it; aligning them is a follow-up.

## From the A3 and A6 builds (24 October 2026)

25. A6's painters leave the shared `kit/folds.ts` for a leaf module, `kit/folds-sing.ts`, imported only by the pages that call them (Lessons 3 and 9), as decision 10 does for the band chart's rungs. Lesson 5 must not download 319 bytes it never calls, and Lessons 3 and 5 hold the season's least first-paint room. Lesson 3's frequency-to-stretch mapping, `clamp(log2(f/110)/2, 0, 1)`, moves there too, as `foldStretch(hz)`, for B7.

## From the page run 1 review (25 October 2026; page-1/review/)

26. Step 5's scrub bar is the kit's native range (`input.range`, lesson-stage.css), as Lesson 3's chase scrubs its band chart: 0 to 3 s in steps of 0.1, named "Scrub the landing", its `aria-valuetext` from `scrubText(t)` in `lesson-09/lines.ts` ("0.0 seconds of 3" at rest). It sits after Slow on the same row, and takes a row of its own where the row has no room for it, at 344 px. A native range brings keyboard, touch and screen-reader behaviour with no pointer code of its own; B8b wires it, and its markup is already in `learn/09.html`.
27. The head's `teaches` list (JSON-LD) words Step 1's question (LESSON.md:110) as a phrase, "Why a leap is harder than a step", as every other lesson's list does.
28. B11's `next()` (cognitive complexity 26) is split into small rules (`comfortAnswered`, `mercPlayed`, `silenced`, `took`; now 14), not waved through with a metrics baseline update: the ratchet holds, and a baseline edit would conflict with every other branch that moves the baseline file. Folded into B11's commit.
29. Code comments and commit messages name no plan task (B6, B12 and so on) and no scratchpad file (PLAN.md, DECISIONS): they say what is still to come in plain words ("once it is wired").

## From the page run 2 review (25 October 2026; page-2/review/)

30. While Lesson 9's page is still being built, each toy raises its first-paint budget to the smallest whole KB above its own measure, the measure and the cause in the raise's comment, so each raise stays a tripwire. The page task that completes the page sets the ceiling the tables' rule asks for, its measure plus about a quarter (WEB-SPEC, the budget rows).
31. Lesson 9's `main.ts` imports `kit/lesson-guide.css`, which the page does not use, so that the sheet stays in one chunk with Lesson 2's quiz modules, which this page shares through Lesson 6's questions (decision 20). Without it, Lessons 2, 4, 6 and 8 link the sheet after their own stylesheets, and Lesson 4's scale guide and Lesson 6's tune guide lose their heights to the slide guide's 190 px. Measured on a build: those four pages keep exactly their links; Lesson 9 gains 577 bytes of CSS.
