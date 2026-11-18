# Lesson 21's page (lead-only; agents off until 12 Nov 01:00Z)

Branch feat/lesson-21-page in W (l10-page) from main after #1393 (kit stairs) merges.
Spec: docs/plans/find-your-pitch/lessons/21-keys-circle/ (WEB-SPEC 585, LESSON 475, FACTS 153 lines).
Theory lesson with an unscored sing-along: a DRAFT until the vocal coach's look at Sing it.
Model page: Lesson 15 (learn/15.html, lesson-15/*), "Lesson 15's look, unchanged".

## Already on main

Season 2 data: lesson 21 entry (no minutes/page yet), TOPICS T17/T18/T29, EDGES [6,21] [15,21];
lesson-copy teases for 21 and 22 (check); lesson marker 1-28 (check lesson-gate bounds for 21);
staff toy (kit/staff*.ts) both clefs, house, pitch line, key strip; sing flow (kit/sing-flow.ts);
predict (kit/predict.ts) with data-free + revealAfter 'all'; words strip; quiz; next card;
Lesson 6 q2 (lesson-06/quiz-questions.ts) and Lesson 15 q2 + slot (lesson-15/quiz-questions.ts);
the kit staircase (after #1393): range {lo, hi} within an octave from C; core.play(events, audible, look).

## Kit work

K1 stairs: core `setRange(range)` (Step 1 starts on G2 or G4 by the clef, which the voice choice
   can change during the visit); tests. Step 1 plays at 0.4 s a note, 0.35 long (FACTS 63) through
   core.play with the page's own events (kit stairs-plays `run`-like at its pace) -> maybe a pace
   parameter on stairs-plays' builders.
K2 staff key signatures (Toys 2): Scene.key {kind 'sharps'|'flats', count 0..3, fresh?: index of the
   newest sign (outlined, fades in 0.12 s)}; places per FACTS 21 (treble F#5 top line(8), C#5 third
   space(5), G#5 space above(9), Bb4 middle line(4), Eb5 top space(7), Ab4 second space(3); bass each a
   line lower = place - 2); spacing as the app's notation library (find it: VexFlow? check FACTS 21);
   notes covered by the signature draw no sign; StaffState.key; toy setKey(key, opts) + live line
   "Key signature: two sharps, F sharp and C sharp" / "No key signature"; Mark.outline (Spell it's
   two As, a note outlined); noClef unaffected. Scores/runs measured: `across` gains the signature's
   width. Tests: places for 1-3 sharps/flats both clefs; bass one line lower; no sign under signature.
K3 circle toy (Toys 3): kit/circle-geometry.ts (pure: chromatic/fifths order, bead angles, key names
   incl. the bottom three's two names, parts {sharp: C..A, flat: Eb..C, free: Eb..A}, pure walk
   frequencies (FACTS 31) and the 23.46-cent gap), kit/circle-draw.ts (SVG ring: chrome beads, ink when
   lit, black-key beads dim unless the key's (sign in ink), thread bead to bead, house, gap arc dashed
   ink-2 labelled "23.46 cents", signature beside it is the staff toy's job), kit/circle.ts (mount:
   arrangement 'chromatic' | 'fifths' with the move between (reduced motion: jump), beads in the step's
   part as HTML buttons >= 44 px named "G major, one sharp", Left/Right arrows step back/round,
   Step round/Step back with aria-disabled at the part's ends, group description naming the five
   past three, play scale on step (0.3 s/0.27 s, FACTS 63), Pure/Equal walk 0.45/0.4, last 1.0, +0.2
   start C 1.0 = 7.6 s, end announcements). Decision: SVG drawing after the spiral's top view, not the
   canvas spiral (beads must be 44 px buttons, the ring re-threads by fifths): record in As built.
K4 two-run sing-along: in the page controller (sing flow unchanged): count-in on so, sweep 4 notes in
   C, 2.0 s gap (signature gains F#, house to G; second count-in on the new so in the gap's last
   second), sweep 4 notes in G; 13.8 s; Merc's notes 12.8 s (FACTS 56, 64).

## Commits (draft order; re-read each spec section before its commit)

C0 baseline: main's build after #1393 (fp.tsv, css lists, plan-cites).
C1 shell + registration: learn/21.html whole markup from LESSON.md (Lesson 15's skeleton), lesson-21/
   {main.ts, lesson-21.css, page.test.ts, page-dom fixtures}, e2e boot, season entry minutes 15 +
   page /learn/21 under the drafts comment, drafts line 21 "the vocal coach's look at Sing it
   (MASTER-PLAN § 12 item 8)", vite input, sw-runtime, budgets, og card learn/lesson-21-og.jpg (how
   did L24 make its card? check), LESSON-TOUR, tests' shifts, head (title "Key signatures and the
   circle of fifths | MercuryPitch", PT15M, teaches x4).
C2 K1 stairs setRange (+pace).   C3 K2 key signatures.   C4 K3 circle toy.
C5 steps 1-5 (staircase + staff; circle + staff sharp side; flat side + Spell it; Find do; walk).
C6 hero + cold open predict (ring chromatic + key strip D4-A5, D major lit; Play D major free;
   A with D#/G# + small staircases; revealAfter 'all'; holdTour).
C7 recall (l06-q2, l15-q2 + slot) + quick check (l21-q1..q4).
C8 four words (small ring; small staff G major sharp; small circle of four beads; 13 tiles).
C9 Sing it (K4).   C10 wrap + free play (circle E-flat..A) + tease still (L5 band, waving line).
C11 e2e + phone checks (390/344, targets).   C12 chore(seo) /learn/ fingerprint -- DO NOT FORGET.
C13 Length count (+ the named cut if over), ceilings a quarter over, As built, plan-cites, INDEX.
Then <= 2 review rounds, PR (no footer), CI, rebase merge, verify, dev, owner report.
