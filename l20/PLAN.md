# Lesson 20 page plan (lead-only), branch feat/lesson-20-page on feat/lesson-18-page (69f2d7ed6)

Stacked: L16 (#1406) -> L18 (#1407) -> L20. L20 uses L16's kit (five stairs, keys under stairs, staff options).

## Commits
- C1 shell + registrations (learn/20.html, og card, main.ts, css, page test, e2e shell spec, drafts 20 line,
  season-2 minutes 15 page, sw-runtime, budgets placeholder, menu/tour/sound-gate/frame-loop/next-card specs,
  unit registrations, LESSON-TOUR counts). Gates: $S/l20/g/gates-a.sh c1a, gates-b.sh c1b (specs: learn-lesson-20,
  menu, tour, sound-gate, frame-loop -g "Lesson 20", next-card).
- C2 kit: readTake options {attackSec, steadySec}; LadderOptions passes them (take.ts) + take-ladder tests
  (0.6 s steady in 0.75 slot reads; 0.4 s not; octave down folds within 50; defaults unchanged).
- C3 kit: Lesson 9's Sing it into the kit with a plan (refactor, L9 behaviour unchanged):
  kit/ladder-flow.ts (from lesson-09/ladder-flow.ts; ids 'full' | 'smaller' stay the kit's; plan in the visit:
  reach by voice), kit/ladder-take.ts (from sing-take.ts; plan: notes, labels, slotSec, read opts, said noun),
  kit/ladder-sing.ts (from sing.ts; plan: consumer, warm-up key, chart, lines, again names, merc notes).
  Lesson 9 keeps its plan; its tests run against the moved code. Check every L9 test file still passes.
- C4 kit: the flow's faster pass (plan.faster): offer once after Easy/Workable, unscored guide at 0.45 s with the
  count-in, no mic, feelings again, "That's the run, faster."; sound off = hint, not spent; cut = undone.
  + Move do reach per voice, shift clamped on voice change.
- C5 kit: staircase scales (kit/stairs-scales.ts pure + core degrees + draw numbers/two names/houses + toy
  switches five/mode + labels "Stair 2, me, E flat 3" + polite lines + summary).
- C6 kit: band-chart-rungs bead style (bead at slot start on the steady line, string bead to bead, short staccato
  rungs, illustration line from a contour) + tests.
- C7 L20 steps: staircase Steps 1-2 (inline plays major-five 7.7 s, both 6.8 s, on-c 3.15 s), run toy Steps 3-4
  (tempo notches, Play the run, Play it smudged, staccato/legato, staff switch), lesson-20/run-toy.ts, sounds.ts.
- C8 L20 cold open (pitch line + fast/slow plays + research predict + holdTour), four words, recall + quick check.
- C9 L20 Sing it (plan for the kit card: runs, 0.75 s slots, reader options 0.15/0.45, reach {0,3}/{0,4},
  faster pass, chart in bead style, no-mic sweep).
- C10 L20 Wrap (practice card, tease still ring+keyboard, free play both toys).
- C11 e2e (page + fake-mic take), tour FIRST_CHOICE [20,'time'] + LESSON-TOUR hold list (add 18's and 20's),
  sitemap /learn/ fingerprint, As built + Length, ceilings.

## Open notes
- LESSON-TOUR.md line ~247 hold list lacks 18's (L18 added FIRST_CHOICE): fix with L20's.
- Length: package 2,226; built ~2,377 per spec; named cuts: Step 1 drawer's last sentence (10), Step 2 Blues
  drawer (23), Step 4 whole (91).
