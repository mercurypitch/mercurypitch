# Lesson 10: follow-ups and asks

- **Asks from Lesson 12's plan (24 October), section 6 item 18:**
  - L10-K2 takes a voice kind on each note (L12-K1 folds into it; Lesson 12 decision 3), beside the gain on each note.
  - L10-K3 takes a reach for each side (L12-K2 folds into it; Lesson 10 decision 5), with L12-K2's tests: -4 and +3 hold, +4 and -5 are refused; the default stays plus and minus 4; `setMoveEnds` marks only the end reached, with `aria-disabled`.
  - L10-P14 exports its quiz-play binder, so Lesson 12's recall can import it.
  - L10-P8's question ids and slot stay fixed once shipped: Lesson 12's recall filters Lesson 10's own questions (G8).
  - B15 or L10-P21 pads `open()` (also in `../l9/FOLLOWUPS.md`).

- Lesson 7 Sing it: when a play is cut short by a hidden page or the Sound switch (K2 item 5), "played" drops as intended, but the listen ring runs on to its natural end, since ring.stop is not called. Cosmetic; K2 left it alone (24 Oct).
- kit/run.ts chords (K2 review N1, 25 Oct): a stop from inside onNote in the middle of a chord leaves that chord's later notes built after the stop and unowned for their dur (one timer per onset now; before, one per note, cleared by the stop). No caller stops its own run from onNote; if one ever does, guard the onset loop with a flag the stop sets.
- After K3 and K1 merge (review 25 Oct): rewrite as done the plan sentences that still plan them or call Move do's ends "disabled". Lesson 10 spec :18, item 5 (:782-786), item 7 (:797-800); Lesson 12 spec :873-874; Lesson 9 spec :332, :457, :724, :788, :818; Lesson 14 spec :429, :598, :981, :1013. Owners: P22, Lesson 12's docs task, B16, Lesson 14's builder.
- Optional (K1 review): Lesson 6's melody.ts SOLFEGE (do to la) could index the kit's MAJOR_SOLFEGE.

- **From the chords run (P1, P2, P3, P7; review 25 Oct, head bdd1f8ef7):**
  - P7's `said` ("C 4", "E flat 4") repeats Lesson 6's `spoken` in `lesson-06/tune-words.ts`. When Lesson 6 is next built and measured, move it to `kit/notes.ts` as `spokenName`, appended at the end of the file so no plan citation shifts.
  - Sing it lines exist only where the spec words them; P4 must not invent the others.
  - The two-note level of 0.075 extends FACTS 81 (which gives the three-note level); P22 adds it to FACTS.
  - P7's templates are each built from one spec example; P22 checks them against every spec line once the page plays them.
  - Step 5's scale has no name strip; "Play Merc's notes first" has no closing period in the spec. Both for P22.
  - `EarNote` carries no level, so P16 and P17 must sound the games' chords at 0.075 themselves.
  - Step 5's choice keys `one` and `three` must match P17's `data-choice`.
  - P7 imports `MoveId` and `Tempo` from P2's `sounds.ts`, so P7 cannot join the page before P2.
  - The triad syllables are literals until K1's `MAJOR_SOLFEGE` and `MINOR_SOLFEGE` are in the base; swap them then.
  - The ear games' roots are chromatic, MIDI 60 to 67 (FACTS 78 says "C4 to G4").
  - Two whole-suite load timeouts in that run (`lesson-07/sing.test.ts`, `kit/beat-layout.test.ts`) were not checked against main; both have timed out under load before.

- **From the layout-hero review (25 Oct, head 821ef42a1):**
  - The chords commits (P1, P2, P3, P7, under bdd1f8ef7) cite "PLAN Pn" in their messages: reword them in the PR-time fold (decision 20). Rewording now would move both branches stacked on them.
  - P11 or the hero's wiring: if the page pulses the chord's beads as they sound, the pulse must follow mi's or so's glide, or leave the moving bead as the one that sounds; and `setView('top')` at mount moves the camera unless the page starts it from above.
  - The toy sets the compact strip's text at 12 px or less (the box is 14.5 px tall; about 360 px wide at 844 x 390).

- **From the sing-quiz review (25 Oct, head e409678d5):**
  - P22: the spec's Toys 6 takes the flow's status lines, the series' with "Merc's notes" and "them", and "Your turn: sing with the guide." while a sweep runs.
  - If the coach settles the feeling answer on `changeable`, the flow takes Lesson 8's rested rule and line ("Merc can still sing the notes for you.", to be settled then).

- **From the page's first run (27 Oct, head 0c4e9fa5c):**
  - Kit: one width for the sound gate's button on every page. Stack both labels in one grid cell, the inactive one `visibility: hidden`, so no lesson's gate line can sit within the labels' 1.6 px of a wrap. Lesson 10's `.l10-hero .gate .btn` rule then goes.
  - The cold open's run: `Names.set('flats')` in main.ts (decision 27), and Play the chord's place on a phone (decision 28).
  - Step 5's task shows its Notice and the "Do or la?" drawer, kept hidden (`data-scale-reveal`) until the reveal.

- **From run 5 (27 Oct, the Wrap and the page-wide checks):**
  - Copy pass: free play's four group labels are the builder's words: "Free play: major or minor", "Free play: chord or scale", "Free play: the names switch" (the steps' group is "Names on the stairs") and "Free play: the chord beads".
  - Kit (task for 0.9.24, owner's go): free play's lit Play shows the `.btn.primary.is-on` dark-on-dark words too (l10/page-5/shots/*-03-free-play-lit.png).
  - A live WebGL Merc under reduced motion is not verified in a browser (headless Chromium runs the stills); a device check, as for Lessons 6 and 9.
  - src/e2e/helpers/lesson-qa.ts measures the keyboard reach, live regions, 44 px targets and rest; Lesson 9's QA spec keeps its own copies of the same measures. A later tidy: move Lesson 9's onto the helper.
  - Lesson 10's browser specs are four files now (the reduced-motion one is learn-lesson-10-motion.spec.ts), each under 600 lines.
  - The builder used `cd` three times (no work changed); BUILDER-RULES already forbids it.
- **From run 4 (27 Oct, Sing it):**
  - The ring at 390 px: "Sing with the line · 6" wraps to three lines in the 128 px ring and the countdown falls below the circle (l10/page-4/shots/390x844-07-guide-mid-sweep.png); at 1440 "SING WITH THE" crosses the ring. The same words and CSS as Lesson 6's (a draft), so Lesson 6 shows it too. For the copy pass or the kit: a shorter turn line for the small ring, or the state line under the ring.
  - The ring's state words are Lesson 6's, not in Lesson 10's docs: "Listen", "Get ready", "Sing with the line · n", "Rest"; "Rest" also shows after Merc's notes, when the viewer's turn comes next. Copy pass.
  - No status line while Merc's notes play; Lessons 6 and 8 say one ("Merc sings the first version.", "Merc sings the line."). Copy pass; LESSON.md's own "Merc sings do-mi-so, then do-me-so" is a candidate.
  - Sing it's markup has no Stop: Merc's notes and a sweep stop on any of Sing it's presses, another sound, the Sound switch (notes only) or leaving. The coach or P22: is a Stop wanted for the 10 s notes and the 11 s sweep?
  - WEB-SPEC Toys 6's "answering Easy later does not bring the practice card back" cannot happen under the kit's lock (Easy is disabled after Effortful, and the guide is away); the tests assert the lock. P22's docs pass says so.
  - After Effortful, "Play Merc's notes" sits right on "do is E3" (the guide's notes hidden between them): spacing, P22.
  - CSS headroom: 89,870 of 88 KB (242 B). The Wrap's run raises it to 89 in the commit that needs it (decision 25).
- **From run 3 (27 Oct, head 703621d37 after the fold):**
  - Kit, and live on Lesson 2: a lit primary button (`.btn.primary.is-on`) shows its dark words on `.btn.is-on`'s dark teal, because `.btn.is-on` (lesson-base.css:521) sets the background and not the colour. Seen on Lesson 10's Play the pattern (l10/page-3/shots/*-step4-pattern.png); the same rule lights the kit ear game's Play (Lessons 6, 8, 10) and Lesson 2's published "Play a step", climb, lift, slide and unroll buttons while they sound. Lesson 7 already dodges it (`.range-toy .btn:not(.primary).is-on`). A kit fix for 0.9.24: give `.btn.primary.is-on` light words, or keep its own fill with a ring. Owner's call on the look; Lesson 2 is published, so not in this branch.
  - Kit step deck, every lesson: a focus or click on a stage control within about 1 s of opening `/learn/NN#step-N` stops the deck's smooth scroll short, and once the 1.1 s lock ends the deck follows the page to Step 1. The e2e waits for the page to hold still; the kit should not lose the step.
  - Step 5: Play C minor from a folded major chord writes two polite lines in one tick (the spread's, then the quality's; the last stands), and the scale starts while the 0.6 s spread is still moving. The spec is silent; P22 or the coach: one line, and the scale after the spread lands?
  - Step 5's names switch says nothing in the polite line (the switch's own pressed state does). WEB-SPEC's live-region rule is per action; a line for it would be new copy, for the copy pass.
  - FACTS 78 "a root from C4 to G4": the games deal all eight semitones, MIDI 60 to 67. P22's docs pass says so in FACTS 78.
  - End to end 13, the reduced-motion sweep, and the -qa and -sing specs of Lessons 6 and 9 were not run this run: the next runs.
  - At PR time, the three module-map commits become one at the end.
