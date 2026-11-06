# Lesson 19's page (lead-only; agents off until 12 Nov 01:00Z)

Branch feat/lesson-19-page in W (l10-page) from main 4f8c9b3ec. Spec: lessons/19-threes-offbeats/
(digest l19/SPEC-NOTES.md). Pattern: Lesson 17's page (#1366) for everything shared, its commit
shape (l17/PLAN-B.md). Drop nothing on main; INDEX regenerated last.

## Calls made (lead, recorded in the spec as built at C14)

- The hero is Toy 1's six pads in the rhythm bar's compact scene, nothing written, as Lesson 17's
  hero drew its four pads with the rhythm bar, not kit/beat-strip.ts (spec item 5 names the strip).
- The take's flow stays in the page (lesson-19/take.ts), as Lesson 17's does; what both share is
  the kit's already (tap-judge.ts lineUp/pulseSamples, tap-pad.ts, judgeTake imported). The spec's
  item 7 asks for it in the kit: two takes that differ in passes and backing; moved when a third
  page taps (Lesson 21).
- Model units stay quarter notes: 6/8 is a bar of 3 quarters whose beat is 1.5, played at 90
  quarter-BPM (an eighth a third of a second, a 6/8 beat 1 s, a 3/4 beat 0.67 s, both bars 2 s).
- Subdivide's bars are imported (METRE_PATTERNS 'metre:6-8:a' in threes and Step 1's 6/8,
  'metre:6-8:b' QC2); in twos and Step 1's 3/4 follow its rule, built here. Levels 1 / 0.7.
- Held counts are drawn one under each held beat, the 3/4 tune's last bar "1 (2) (3)" where FACTS 28
  writes "1 (2 3)" in prose: the kit writes every held beat in its own brackets (Lesson 17's whole
  rest "(1) (2) (3) (4)").
- Lighting moved from the clock's beats to pad hits (C4), which also lights the first pad of each of
  Lesson 17's halvings and Step 3's count bars on their first beat (dark until beat 2 before).
- Teases: L19 "Same six notes, same speed. Only the accents move." + alt 'written'; L20 "Merc sings
  a run of nine notes, five every second." + alt 'plan' (FACTS 5, 5b), as the spec has them.
- Switches never play (Toys 1), in the steps and in free play too, where Lesson 17's free play plays
  each change: on this page a switch regroups or swaps what is shown, and Play plays it.
- The take's figure is the second time through's beats, four bars of numbered pads over the strip
  (rhythm bar, notation false), and nothing on it lights while a take runs: the judged pass is the
  beat held, and a lit pad would be a click to follow.
- The other-metre clause's N counts the taps that fell at the other metre's places (FACTS 34's
  example lines: all the extras there); the line says either that clause or "between", never both.
- The four words' ticket rules moved from lesson-17.css into kit/lesson-rhythm.css as .rb-words, which
  both pages' tickets carry; Lesson 19's figures are 76 px tall (no strip). The accent's first pad
  lights larger by a 1.08 scale (its "lit larger"). Each word says a line of its own once heard.
- The tease still is drawn in the markup, as Lesson 10's; the explorer card's figure is a new Season 2
  kind 'pads', six numbered pads, all one size and numbers alike, nothing written (FACTS 1a).
- The recall's "Try Lesson 17, Step N again" links only where Lesson 17 is live (the kit's linkAway);
  on a page that holds Lesson 17 back its words stay with no link.
- FACTS 70's 44 px is the drawn pad's width, as its arithmetic reads ("a pad, less the gaps"), though
  the page taps no pad: a pad an eighth wide gives up its 4 px of room, to half a pixel, before it
  draws under 44 (kit/rhythm-layout.ts padSpan), so the six are 44 px from 344 px up; C3's test
  had measured the column (46 px there), and the pads drew 41.6 (found by C11's 344 px check).
- The kit's figureSize measures inside the figure's border: the stage's .viz has 1 px above and below,
  so every rhythm figure there (Lesson 17's too) was drawn 2 px too tall and scaled 0.992 to fit,
  its pads 43.6 px at 344 px. Lesson 15's staff-draw.ts figureSize reads the border box too: left
  as a follow-up (Lesson 15's page), named in the PR.

## Commits, in order (each with its tests; gates per commit: pnpm check, units of what changed;
## build:e2e + first paint at C1, C7, C11, C14; e2e at C12)

C0. Baseline: build:e2e on main 4f8c9b3ec, first paint of every page (l19/base/fp-main.tsv,
    mods-main.json), plan-cites on main.
C1. Shell: learn/19.html (head: title "6/8 time, triplets and syncopation explained | MercuryPitch",
    description (159 chars), og:title "Threes, offbeats and syncopation · Find Your Pitch", share
    card public/learn/lesson-19-og.jpg, Article + breadcrumb, timeRequired PT12M; masthead Season 2
    · Lesson 19, anchors Lesson / Tap the beat / Explorer; hero, stage, sound gate, predict, recall,
    words, 4 steps, #tap, quiz, wrap, explorer, footer), lesson-19/main.ts + lesson-19.css +
    page.test.ts + page-dom.test-fixtures.ts; drafts 19; season-2.ts entry (minutes 12, page; fig at
    C11); lesson-copy teases (19 + alt 'written', 20 + alt 'plan') + TEASE_NOTES; sw-runtime paths;
    both budget tables; test shifts (publish, season-2, explorer, admin, hub, gate, lesson-copy, menu,
    next-card, tour, frame-loop, sound-gate); learn-lesson-19.spec.ts boot; LESSON-TOUR count; tour
    copy for a page with nothing sung (kit item 13: SILENT_LESSONS [19], the body; "Your turn to
    tap" on #tap).
C2. Rhythm model past 4/4 (kit/rhythm-model.ts): Metre (4/4, 6/8, 3/4, 2/4: bar, beat, digits),
    triplets (Written.triplet: an eighth a third of a beat, tuplet 3), placeBars by metre, beams by
    the metre's beat, counts by metre ("1 and a", "1 and", "trip-let"), held counts bracketed.
    Tests 1.
C3. Rhythm drawing past 4/4 (rhythm-layout/-draw/-glyphs): the metre's digits, bar lines by bar,
    beat lines by beat, pads by a pad unit (six a bar) with beat 1 of each group marked, arcs under
    each group (drawn when the group's first note sounds), the triplet's 3 over its beam, a
    pads-only scene (hero), staff rows of two bars.
C4. Rhythm bar past 4/4 (rhythm-bar.ts): bars cut by the metre, clicks on the metre's beats or none,
    drums per sound (kit/drum-hits.ts: triggerDrumVoice into the run's bus, Subdivide's levels),
    arcs lit as heard, a cue booked early before chosen sounds (the hops), tests.
C5. Steps 1-4 (lesson-19/steps.ts + rhythm-views.ts): Step 1 six pads 6/8 · 3/4 on drums; Step 2
    the two tunes on the staff (Count, 6/8 · 3/4, Clef, pitch line; one system wide, two on a
    phone); Step 3 Eighths · Triplet; Step 4 On 3 · On 2 and; Tavi's Step 1 line, mix-up card, Go
    deeper.
C6. Hero (six pads compact, three plays, arcs, hops via merc-hop at 0.6 s lead) + predict.
C7. Recall (l17 Q3, Q2 imported) + quick check (4 Qs; Q2 plays metre:6-8:b two bars).
C8. Four words (accent on pads; offbeat, triplet, syncopation written as they play).
C9. Checkpoint #tap: two Start buttons, two passes (click then none), tune as backing, line-up and
    judge (judgeTake, 120 ms), lines incl. the other-metre clause, ticks, status lines, edge cases.
C10. Wrap: practice card, free play (six pads 6/8 · 3/4; staff with both tunes), tease still (L20's
     nine beads), next card; explorer fig (six pads ungrouped).
C11. e2e learn-lesson-19 + shared specs; phone checks at 390 and 344 (six pads >= 44 px).
C12. chore(seo) sitemap only if /learn/ changes (as L17's f5a28e5b0).
C13. Final: ceilings, spec as built, plan-cites, LESSON-TOUR; INDEX last.
Then: 2 lead review rounds at most, PR mirroring #1366 (no footer), CI green, rebase merge,
verify-rebase-merge, dev check, owner report.
