# Lesson 23's page (lead-only; agents off until 12 Nov 01:00Z)

Branch feat/lesson-23-page in W (l10-page) from main ff9782d38. Spec: lessons/23-perfect-tritone/
(WEB-SPEC 788, LESSON 490, FACTS 262 lines; 2,048 words, cap 2,379). Pattern: Lesson 15's page
for the staff toy, Sing it and a recall from a Season 1 lesson; Lesson 10's for the recall of Lesson
6's own questions; Lesson 19's for the commit shape (l19/PLAN.md). INDEX regenerated last.

Already on main: Season 2's entry for 23 (no minutes/page/fig), EDGES_2 [6, 23], the lesson
marker to 28, the kit's sing flow (restAfterEffort always), the staff toy, PitchLine, predict
onChoice, holdTour, next-card slot, words strip.

## Calls made (lead, recorded in the spec as built at the last commit)

- The interval state lives in the kit as its own toy on the staff toy's parts, not inside
  kit/staff.ts (595 lines): kit/intervals.ts (pure: number, semitones, quality, name, upside down,
  the signs a letter takes, the readout's words), kit/staff-interval.ts (the toy) and its drawing.
  It draws its staff with staff-draw's engraving and its own upright pitch line beside it.
- The ring is a flat ring of twelve beads drawn in the toy's SVG in the pitch line's colours, C at
  the top, not the kit's spiral (a canvas control with its own slider and turning): the spec leaves
  it to the lab.
- PAIR and pair move to kit/pair.ts; Lesson 6 imports them from there (examples.ts, game-rounds.ts,
  tests). Lesson 10's WORD_PAIR, the same numbers, takes the kit's PAIR too.
- The page turns the pitch-line switch on before any toy mounts (PitchLine.set(true)): the steps'
  toy, free play and Sing it's staff all follow the one switch.
- Play ti and fa lights its two pairs on a small staff of its own in "Then just listen", in the
  learner's clef, written as they sound, the house on D: it shows in every ending, where Your turn's
  staff does not.
- Before any sound the readout is empty; each sound writes "C up to E" over "3 letters · 4
  semitones · a major third" (two lines on a phone), the "·" hidden from screen readers with a
  comma for them.

## Commits, in order (each with its tests; gates per commit: pnpm check, units of what changed;
## build:e2e + first paint at C1, C8, C12, C14; e2e at C12)

C0. Baseline: main ff9782d38 = l19/r1cx2's tree, copied to l23/c0 (fp-main.tsv, mods-main.json,
    plan-cites-main.log, css-NN.txt).
C1. Shell: learn/23.html (head per spec Sections 2; masthead Season 2 · Lesson 23, anchors Lesson /
    Sing / Explorer; hero, stage, sound gate, predict; recall; words; 4 steps with the interval toy
    figure; Sing it; quick check; wrap; explorer; footer), lesson-23/main.ts + lesson-23.css +
    page.test.ts + page-dom.test-fixtures.ts; drafts 23; season-2.ts entry (minutes 14, page);
    lesson-copy teases (23 + alt 'hold', 24 + alt 'fifths') + TEASE_NOTES + SIGNATURES; sw-runtime;
    both budget tables; share card public/learn/lesson-23-og.jpg; test shifts; learn-lesson-23.spec
    boot; LESSON-TOUR.
C2. kit/pair.ts: Lesson 6's PAIR and pair, Lesson 6 and Lesson 10 importing them.
C3. kit/intervals.ts + tests (spec Tests 1 to 3).
C4. kit/staff-interval.ts (+ draw, CSS): two notes, Step up/down, places and arrows, Sharp/Flat by
    the rule, readout and live line, plays of pairs and chords, held back until unlock() (white
    lanes only, E♭'s own lane), lanes drawn in at 0.4 s.
C5. Fold (gold bracket, sums, 0.6 s) and the B lane with Curl into a ring (0.8 s), cross-fades
    under reduced motion.
C6. Steps 1-4 (lesson-23/steps.ts + sounds.ts): states, plays, the toy held until the choice.
C7. Hero (lesson-23/cold-open.ts): the upright line, three plays, lanes and counts, predict with
    onChoice unlocking the steps' toy, tour hold, Mercs.
C8. Recall (l06-q3, l06-q4 imported, Lesson 6's plays) + quick check (Q4 plays B3+F4 1.5 s).
C9. Four words: small staves in the learner's clef, written as they sound.
C10. Sing it: Lesson 15's flow with this page's line, do so / so do in D, the listening pair.
C11. Wrap: practice card (Leap) and its rest line, free play (a second toy, all open), the tease
     still (drone band and a line above it), next card.
C12. e2e learn-lesson-23 + shared specs; phone checks at 390 and 344; stage-fit.
C13. chore(seo) sitemap only if /learn/ changes.
C14. Final: ceilings, spec as built, plan-cites, LESSON-TOUR; INDEX last.
Then: 2 lead review rounds at most, PR mirroring #1368 (no footer), CI green, rebase merge,
verify-rebase-merge, dev check, owner report (with the Lesson 21 question: its spec moves Lesson
4's staircase into the kit, a Lesson 4 change the owner gave the other agent).
