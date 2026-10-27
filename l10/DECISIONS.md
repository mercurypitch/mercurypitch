# Lesson 10 page: lead decisions

Answers to PLAN.md section 6, 24 October 2026. Lesson 9's decisions (`../l9/DECISIONS.md`) and builder rules (`../l9/BUILDER-RULES.md`) apply here too.

1. **The description** drops "thirds": "Which single note turns a major chord into a minor one? A seventeen-minute lesson with sound toys: major and minor chords by ear, and the natural minor scale." (158 characters). The cold open's answer is the chord's third, and a Lesson 6 graduate could read it off the old wording. `teaches` keeps "Major and minor thirds": it lives only in the structured data, which no viewer sees.
2. **Shipping** follows Lesson 9's decision 2: the kit tasks (K) are small PRs to main; the page is one branch, `feat/lesson-10-page`, stacked on `feat/lesson-09-page`, one commit per task, one PR. Nothing merges before the owner's release tag. The page-module tasks (P1 to P10) go on a few branches, one commit per task, and join the page branch by cherry-pick. **The drafts line** keeps the spec's wording; Lesson 12's line copies its form.
3. **The explorer card's practice link** is the owner's. Build it with the plan's recommendation, Stack (`/ear-lab?lesson=10`, "then tap Stack"); a switch to Drone Intonation is a one-line change to the season entry.
4. **Drone's richness** needs no Lesson 10 task: `arp/CONSENSUS.md` deletes the term. LESSON:432-433, FACTS 49 and spec:709 change when Drone's grade does (the consensus's "With the other bumps").
5. **K3: yes.** At its limit a Move do button takes `aria-disabled="true"` and keeps focus, and each handler returns first when its button is `aria-disabled`, so a click at the limit neither shifts nor stops a running guide. K3 also takes optional limits for each side (default `MOVE_MAX` both ways), which Lesson 12 needs (four lower, three higher), so Move do changes once. Lesson 9's B12 builds on K3 and asserts `aria-disabled` (DECISIONS 15 there).
6. **K4: yes**, after K5 on the same file, so Lesson 10 rests page-wide like Lessons 6 to 9. Lessons 1 and 2 keep drawing as they do.
7. **Button names:** the recall keeps Lesson 6's "Play" for `l06-q3` (shared with Lessons 8 and 9); P22 corrects spec:604. Quick check question 2 shows "Play" and is named "Play the question's chord".
8. **K1 lives in `kit/names-modes.ts`.** Lesson 10's track owns K1 to K5; Lesson 12's plan builds on them and never makes a second copy. The chord beads stay on this page; P22 corrects spec:219-220.
9. **First-paint ceilings** rise only in the change that needs it, with its reason (Lesson 9 decision 10).
10. **The share card** is rendered in a headless browser from the kit's own spiral, seen from above, with P9's pre-reveal marks (do, mi and so alike, in chrome, with their triangle), Merc and Tavi's stills, "Major and minor", "Lesson 10" and the wordmark. The render page runs on the local dev server only and is never committed. No note is marked as the one that moves.
11. **K5: accepted.**
12. **LESSON's stale Lesson 11 hook** becomes the season's current one in P22, in one commit with FACTS 3 and the spec's Length.
13. **A stage control stops the stage's sound first** (Major · Minor, the root buttons, Stack a third, Chord · Scale, the names switch), except in Step 4, whose switches act from the next quaver.
14. **The asks of Lesson 9's builders** are in `../l9/FOLLOWUPS.md`: B15 pads `open()`; B2 puts its recorder for kit runs beside `kit/run.ts`; B2 makes the map test, `learn-explorer.spec.ts:141-158` and `learn-lesson-menu.spec.ts:378-382` find the first lesson with no page.
15. **C10-4** also takes the consensus's "Fix now" item for Drone: the idle line and help say "just intonation", but every target is equal-tempered (`DroneIntonationExercise.tsx:134-135`, `exercise-help.ts:142`). The consensus's other two "Fix now" items (Call-Response, Routine Runner) stay with the arpeggio track.
16. **Branches and builders** (all from origin/main 5e08dd4a3 unless stacked):
    - K1 `feat/kit-names-modes`, then K3 `feat/kit-move-do-aria`: one builder.
    - K5 `feat/kit-spiral-owner`, then K4 `feat/kit-spiral-rest` stacked on K5: one builder.
    - P1, P2, P3, P7 on `feat/lesson-10-chords`, one commit each.
    - P4, P5, P8 on `feat/lesson-10-sing-quiz`, one commit each; then C10-4 on `feat/lesson-10-app-copy`.
    - P6, P9, P10 on `feat/lesson-10-layout-hero`, one commit each.
    - K2 waits for A2's fixes, then stacks on `feat/kit-run`. P11 to P22 wait for Lesson 9's B2.
17. **A gap button's name starts with its label** (review of P7, 25 October): "4, major third: C 4 up to E 4", as Lesson 6's gap buttons do, so a voice control user can say what they see (WCAG 2.5.3). P22 corrects the spec's example in Toys 1, "Keyboard and screen readers" ("Play the major third, C 4 up to E 4").
18. **P4's lines and sweeps** (lead, 25 October, before the sing-quiz run):
    - A line Lesson 10's LESSON.md or spec words comes from P7's `SING_LINES`, imported, never copied.
    - A status line Lesson 10 does not word takes the series' line where Lessons 6 and 8 share it word for word ("Before you sing: how is your voice today?", "Choose the voice you'll sing with.", "Choose a voice: it picks the Merc who sings.", "How did that feel?"). Where the two differ only in what Merc sings, it takes Lesson 8's form with "Merc's notes" in place of "Merc's line". Each such line is listed in the run's report, and P22 adds them to the spec's Toys 6.
    - A sweep cut short (Stop, the section off screen, the page hidden) asks nothing, and the card goes back to what it showed before the sweep ran, as Lesson 8's flow does. Only a sweep that ends asks "How did that feel?".
    - The sweeps have no cap: Lesson 10 has no Again, and the spec asks the feeling question "each time a sweep ends".
19. **The layout-hero review** (lead, 25 October; head 821ef42a1 after the fold). The builder's questions:
    - The spaces across the figure are even, (300 - 280) / 3 px: FACTS 82 gives the parts and the total, not the spaces.
    - No name strip in Step 5 or free play, as the spec's Drawing lists it in Steps 1 to 4 only. The compact strip is the top-left corner above the top name, 14.5 px tall, so the toy sets its text at 12 px or less.
    - A name box is one row, 15 px; a stair runs from its tread to the window's foot; Step 1's compact window is root to fifth, as a chord's is.
    - Under reduced motion the bead lands at 1.2 s and is home at 3.1 s: the glide's start and the sound's end.
    - mi's glow is the kit's tune-line glow (0.12 s up, 1.2 s down); the spec gives no length.
    - At rest after the reveal the ring's centre reads "C major"; the neither name wraps after its colon; the halo keeps "mi" on E flat, as LESSON.md's live line says "Mi moved down a semitone".
    - The kit's bead stays drawn where it is during a slide; the page's moving bead travels over the ring.
    - hero-marks takes MOVE from sounds.ts, which loads kit/sound.ts and its visibilitychange listener: accepted. The hero plays through kit/sound.ts anyway, and FACTS 73's timings keep one home.
    - The kit's orange A4 stays: it is the series' colour code (Look: "Lessons 1 to 7's look, unchanged"), Lesson 2's card shows the same orange note, and it marks no chord tone.
    - The kit's C4 seam tick through do's halo stays: it marks where the ring starts.
    - The syllable literals stay until K1 is in the page's base (as for the triads, FOLLOWUPS).
    - The share card is accepted (48,717 bytes, baseline, 1200x630; nothing gold, no name, no note marked), with the builder's alt text for P11: "The title card: Find Your Pitch, Lesson 10, Major and minor, above the ring of twelve notes seen from above, with C, E and G circled alike in chrome as do, mi and so and joined by a thin triangle, between Merc and Tavi."
    - The review's one finding: no test said which halo turns gold (a gold on so passed all 18). The fold adds one: the gold sits on E4 at rest, on E flat 4 once mi's move lands, and stays on mi through so's move.
20. **Lesson 9's decision 29 applies to Lesson 10**: code comments and commit messages name no plan task (P6, K1) and no scratchpad file (PLAN.md, DECISIONS). The layout-hero messages were reworded in its fold; the chords and sing-quiz commits get the same in theirs.
21. **The sing-quiz review** (lead, 25 October; head e409678d5 after the fold). The builder's questions:
    - While a sweep runs, the flow says Lesson 8's "Your turn: sing with the guide.": Lesson 10 sings with the kit's guide as Lesson 8 does, and Lesson 6's "with the line" names its tune line. The flow's status is always a line, as Lesson 8's is. Folded into P4.
    - "them" for "it" where "Merc's notes" replaces "Merc's line": "press Play Merc's notes to hear them", "Merc sings them". Folded into P4.
    - The listen line takes Lesson 8's form: confirmed.
    - No `rested` line: under the kit's lock, an answer that puts the guide away keeps its own line. If the coach settles on `changeable`, the flow takes Lesson 8's rule and line.
    - The readout keeps the kit's `nameHtml` ("do is E3", every sign spoken), as Lesson 6's readout does.
    - The quick check's storage keys are the page's, passed in main.ts as every lesson does.
    - Question 3 prints curly quotes, as Lessons 6 and 7 do; its test compares LESSON.md with the quotes made alike.
    - No labels for the guide or the ring beyond the kit's: the spec words none.
    - M4d (rest not sticky while the lock holds) is an equivalent mutant; the sticky ORs stay for a lifted lock.
    - Decision 20 applied: the three feature messages drop "PLAN Pn" and "decision 7".
22. **The app copy, done by the lead** (25 October; feat/lesson-10-app-copy dfde08a58 on origin/main 2404b342e, worktree lesson-tour; both builder slots were busy and the task is small). One commit, as one task:
    - The chapter's six cited lines change in place, none added or removed, so every citation of `walkthrough.ts` holds: the intro loses "create different moods"; C major loses its mood words; "Best for: Beginners" loses "optimistic melodies"; natural minor's mood line becomes LESSON.md Step 4's tendency ("many Western listeners", and its tempo, rest-of-the-music and upbringing sentence); "relative major (Eb Major)" in the chapter's own ASCII flats; and minor's mood "Best for" line becomes the three notes C minor lowers from C major (Eb, Ab, Bb), read off the chapter's two note lists.
    - Drone Intonation (decision 15): the idle line and the help summary say the targets are equal-tempered; the help's first two paragraphs lose "lock together and stop beating" and "smooth", which ask for a beatless, just tuning (FACTS 49 groups them with the promise), and say the targets use the app's twelve equal steps (Lesson 2 FACTS 29a). No claim about just thirds: FACTS reads no source on them. The help's third paragraph and the menu card stay; neither promises a tuning.
    - Left: `scale-data.ts`'s unrendered mood descriptions (FACTS 55 keeps them listed), and MASTER-PLAN § 7's App content row, a task list for the track.
    - Docs in the same commit: FACTS 48, 49, 55 and the Unverified note, LESSON.md's practice-card note, and WEB-SPEC's App content item now describe the corrected copy. plan-cites stays 157.
    - Tests: `src/types/walkthrough.test.ts` (new, colocated) and a Drone case in `exercise-help.test.ts`; five mutations (A Major back, "cheerful" back, no tendency, "pure intonation" back, "stop beating" back) each fail one.
    - A PR once gated (the owner, 25 October: open PRs for the rest of the lessons and kit, merge none); it merges only on the owner's go after the tag, with the held PRs.
    - It conflicts with #1213 (drill v2) only in the three Lesson 10 doc passages both edit: FACTS 49 (one line), LESSON.md's practice-card note and WEB-SPEC's App content item; the code merges clean (`git merge-tree`). So it merges after #1213, rebased onto main then, the passages merged word by word: the score tops out at 80 (#1213) and the copy now says equal-tempered (this branch).

## Before the page's first run (27 October 2026, after v0.9.23)

23. **The page branches from main**, not from `feat/lesson-09-page`: Lesson 9's page (#1229) and the kit's K1 to K5 are on main (K1 a802a0df3, K2 3ae3050be, K3 de1f2a69b, K4 10000616d, K5 5b3b4e2d4). `feat/lesson-10-page` is origin/main 367592574 plus P1 to P10, cherry-picked by the lead in task order (P1, P2, P3, P7, P4, P5, P8, P6, P9, P10) without their map commits, their trees unchanged (lead/l10-page-picked-76ac3ae1d is the first pick, same tree); four messages reworded under decision 20 (P1, P2, P3, P7 named "PLAN Pn"). The pattern for P11 is Lesson 9's shell, 3e3f4a514, not Lesson 8's 1108914f8: it already made the next card, explorer and lesson menu specs find the first lesson with no page, and it put the run recorder beside kit/run.ts (`kit/run-recorder.test-fixtures.ts`).
24. **K1's syllables replace the literals** now that K1 is in the base (FOLLOWUPS, chords run; decision 19): `lines.ts`, `sing-guide.ts` and `hero-marks.ts` read `MAJOR_SOLFEGE` and `MINOR_SOLFEGE` by degree, each as a fixup of its own module's commit.
25. **First paint while the page is built** follows Lesson 9's decision 30: the shell and each toy raise Lesson 10's ceilings to the smallest whole KB above the measure, with the measure and the cause in the comment, so each raise stays a tripwire; P22 sets the tables' rule, the measure plus about a quarter. The plan's P11 line ("the measured size plus a quarter") is superseded.
26. **The practice card ships as WEB-SPEC's Practice links has it today**: Drone Intonation at `/pitch-training?lesson=10`, then Stack. `/exercises/thirds-on-a-drone` (#1224) is in the app, and the card, the rest card and the footer switch to it "once this page is live" (LESSON.md's editorial note). The page goes live by the console, without a release, so the switch needs a decision before Lesson 10 is published: for R1 and the owner. The season's `pr.link` is decision 3's Stack.

## After the page's first run (27 October 2026)

27. **The first run is accepted** (lead review at max; `feat/lesson-10-page` 0c4e9fa5c after the fold, pushed as a backup with no PR; tag lead/l10-page1-gated; the pre-fold head lead/l10-page1-prefold 289885fb6 has the same tree). The three syllable fixups folded into the lines, sing guide and hero marks commits, and the shell's into the shell. The one fix folded: lesson-10.css's comment on the hero plays no longer says Play the chord is on a phone's first screen. Checked by the lead:
    - Every line of LESSON.md's learner part is on the page, quizzes and the recall aside (the kit renders those from their modules). The words the docs do not have are listed in 29.
    - Lessons 1 to 9 link the same stylesheets, in the same order, as main. `reveal-B96lFMqx.css` is `predict-B96lFMqx.css` under another name, with the same content hash. The kit's guide, voice and ear-game sheets come in by lesson-10.css's `@import` (MISTAKES.md's entry), and each moves back to main.ts with the module whose chunk it shares.
    - Three mutations, each caught: the drafts line, the worker's path and a practice link.
    - Gates on the folded head: docs index, plan-cites 156 (as main), pr:validate, and Lesson 10's unit tests (29 of 29). The builder's build, browser runs and the rest stand, since the only change since is a CSS comment.
    - **`Names.set('flats')` waits for the cold open's run.** Only the spiral modules read Names (`kit/spiral.ts`, `spiral-draw.ts`, `spiral-keys.ts`), and the beads spell through `spellOn`, so the shell would load names.ts for nothing. That run puts it in main.ts before the cold open mounts, as the plan's boot order has it, and fixes main.ts's header to match.
    - The gate's one-width rule stands: Lesson 10's gate is 114 px in both states at 1440 x 900, as Lesson 9's is (FOLLOWUPS has the kit-wide version).
    - The Lesson 3 and Lesson 4 raises stand, with their comments: 132 and 130 KB. Both come back once the cold open and the quizzes load the kit's predict, quiz and hero sky.
28. **Play the chord at 390 x 844** sits at 908 to 952 px, 108 px below the first screen. Lesson 9's is below too, at 1025 px; Lesson 6's is on it, at 784 to 828 px. The cold open's run decides, with the spiral drawn and measured by `learn-cold-open-fold.spec.ts`. The choices: a shorter phone stage or ring (264 px now), or the meta chips on fewer rows. The spec's "should" stays the target.
29. **Copy the builder wrote**, for the owner's copy pass and P22's spec corrections:
    - the five figure labels (steps.ts `FIG`);
    - the ear games' play labels, "Play a pair" and "Play a chord", which also have no ask line yet;
    - the spiral's screen-reader description;
    - "Free play: try every control of the chord beads in one place".
30. **Lesson 5's first-paint headroom is 483 bytes.** The next change that grows every lesson page raises its ceiling, under decision 25's rule.
