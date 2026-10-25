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
