# Lesson 17 part B: the page (lead-only; agents off until ~12 Nov, seven_day allowed_warning)

Branch feat/lesson-17-page in worktree l10-page, on main 091326d9d (part A: 90944a556 tap judge,
8025a9fe8 woodblock, fa650d2df rhythm model, ca0bbebbf INDEX; pushed). Briefs: l17/BRIEF-page.md
(calls already made), pages/BRIEF-COMMON.md (scope, rules, gates). Spec: lessons/17-note-lengths/.
Pattern: Lesson 15's shell fce1d0008 (registration), Lesson 8's page (beat row, take, sing),
learn/15.html (markup). Drop the INDEX commit and regenerate it last.

## Commits, in order (each with its tests)

B0. Baseline: build:e2e on part A, first paint of every lesson page, stylesheet links per page
    (l17/page/base/). Main's numbers = #1362's "here" column plus the announcer's byte; re-measure
    main only for the PR table if needed.
B1. Shell: learn/17.html (head: title "Note values: whole, half and quarter notes | MercuryPitch",
    description from item 2, og/twitter, share card public/learn/lesson-17-og.jpg, Article +
    breadcrumb, timeRequired PT16M, no datePublished; masthead Season 2 · Lesson 17, anchors
    Lesson / Tap it / Explorer; hero, stage, sound gate, predict, recall, words, 5 steps, #sing,
    quiz, wrap, explorer, footer), lesson-17/main.ts + lesson-17.css + page.test.ts +
    page-dom.test-fixtures.ts; drafts line 17 (brief's wording); season-2.ts entry (minutes 16,
    page, fig later); lesson-copy tease + alt `shapes` + L18 tease; team-notes sig + TEASE_NOTES;
    sw-runtime paths; both budget tables; lesson-pages.test; publish/season-2/explorer/admin/hub/
    gate/lesson-copy test shifts; e2e list specs; learn-lesson-17.spec.ts boot; LESSON-TOUR count.
B2. Rhythm bar drawing (kit): one line + staff (staff toy options: A3/A4, stems/ties/dots by FACTS
    29, rests, flags, beams, hollow heads), written as it sounds; tests (Tests 2).
B3. Stopwatch strip drawing (kit): cells, readings, runs "4 × 0.25 s", second row; tests (Tests 3).
B4. Rhythm bar toy (kit): pads, Play, playback on beat clock + woodblock + notes (bookNote), the
    controls (halvings, Halve/Join + hints, Note · Rest, rest strip, Count + fade, Tempo, Play both,
    Dot/Tie/Clef, pitch-line view), live region lines.
B5. Steps 1-5 (lesson-17/steps.ts) + Step 5's lift; Go deeper drawer.
B6. Hero compact pads + cold open predict.
B7. Recall (l08-q2, l08-q4) + quick check (l17-q1..4, Q4 play).
B8. Four words.
B9. Checkpoint part 1: tap take (kit tap judge + lines table) + Hear the bars.
B10. Checkpoint part 2: sung bars on kit/sing-flow + Move the note.
B11. Wrap: practice card, free play (two figures), tease still (L18 line on bass staff), L18 tease
     on the next card; explorer fig 'rhythm' (item 12).
B12. e2e: learn-lesson-17 + shared specs; mobile/layout checks.
B13. chore(seo) sitemap dates (production build) if /learn/ changes.
B14. Final: ceilings, spec as built, plan-cites re-anchor, LESSON-TOUR; INDEX last.
