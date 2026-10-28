Lesson 10's interactive page, /learn/10, "Major and minor", built from its LESSON.md word for word. It ships as a draft until Lesson 6's page is live and the vocal coach has looked at its Sing it (`kit/drafts.ts`).

The kit parts it needed have already merged:
- the ear game for any number of answers, and the guide's breath mark, with Lesson 6's page (#1149);
- Move do and its count-in (#1192);
- the names modes, Move do's ends as `aria-disabled`, the spiral resting when nothing on it moves, and the spiral's own notes through a page's sound owner (#1206);
- chords on the kit's runs (#1207);
- the scales chapter and Drone Intonation's tuning promise, as this lesson's facts cite them (#1214), and `/exercises/thirds-on-a-drone` (#1224).

This PR adds the page, three small kit changes and the page's browser specs:
- the spiral takes `view: 'top'`, so the hero's copy looks down its axis from the first frame (`kit/spiral.ts`);
- `easeOutExpo` joins the kit's canvas curves, for the beads' spread and fold (`kit/reveal.ts`);
- the guide's breath word stays on the canvas when its mark comes after a top-row note: it stands beside its tick, where a word above it would leave the canvas (`kit/slide-guide.ts`). Lesson 6's mark is unchanged.

While Lesson 10 is a draft it stays out of the sitemap and llms.txt.

## What to read first

1. `docs/plans/find-your-pitch/lessons/10-major-minor/WEB-SPEC.md`: Toys 1 (the chord beads), then Toys 6 (Sing it).
2. `src/features/lessons/lesson-10/chord-beads.ts` and `chord-layout.ts`: one figure in each step's state, with 44 px targets at every width.
3. `lesson-10/sing-flow.ts`, then `sing.ts`: the Sing it rule, every branch unit-tested, and the card that draws it.
4. `lesson-10/steps.ts`, then `wrap.ts`: the steps' controls, and free play, which reuses them.

## Commits

Oldest first. The first ten are modules with their own tests and no page; the shell (11) puts every word on the page, and 12 to 24 wire it, one part at a time. 25 sets the final first-paint ceilings, 26 to 30 bring the docs up to the page, and 31 regenerates the module map.

1. feat(lessons): Lesson 10's triads and scales, spelled by letter
2. feat(lessons): Lesson 10's sounds as the kit's run notes
3. feat(lessons): Lesson 10's Major or minor? rounds, half each answer
4. feat(lessons): Lesson 10's lines for the toys, predicts and Sing it
5. feat(lessons): Lesson 10's Sing it flow, every answer walked
6. feat(lessons): Lesson 10's sing guide, do on E3 or E4 with Move do
7. feat(lessons): Lesson 10's quick check and Lesson 6 recall
8. feat(lessons): Lesson 10's chord beads layout, 44 px targets at every width
9. feat(lessons): Lesson 10's hero marks and bead slide, nothing gold before the reveal
10. feat(lessons): Lesson 10's share card
11. feat(lessons): Lesson 10's page shell, in the season as a draft
12. feat(lessons): Lesson 10's chord beads on the stage, in each step's state
13. feat(lessons): Lesson 10's cold open on the hero's spiral, and its predict
14. feat(lessons): Lesson 10's recall from Lesson 6 and its quick check
15. feat(lessons): Lesson 10's four words, each heard
16. docs(lessons): Lesson 10's spec and facts as the cold open and the beads are built
17. feat(lessons): Lesson 10's Steps 1 and 2, and the game on thirds
18. feat(lessons): Lesson 10's Steps 3 and 4, the game on chords and the pattern
19. feat(lessons): Lesson 10's Step 5, the names switch, and leaving a step stops its sound
20. feat(lessons): Lesson 10's Sing it: the comfort check, voice choice, Merc's notes and Move do
21. feat(lessons): Lesson 10's Sing it guide, "How did that feel?", leaving, and the Wrap's card
22. fix(lessons): keep the guide's breath word on the canvas after a top-row note
23. feat(lessons): Lesson 10's Wrap, with free play and the next card's tease still
24. test(lessons): Lesson 10 by keyboard, its targets, and under reduced motion
25. chore(lessons): Lesson 10's final first-paint ceilings, a quarter over the measure
26. docs(lessons): Lesson 10's next-lesson line takes Lesson 11's current hook, and the word count follows
27. docs(lessons): Lesson 10's citations read on main again
28. docs(lessons): Lesson 10's spec says what is on main now
29. docs(lessons): Lesson 10's spec and FACTS follow the page where the page decided
30. docs(lessons): two code headers count Lesson 10 in
31. docs(agent): regenerate the module map

Each message says what its commit does and why, with its tests and its first-paint numbers.

## Review fixes

The lead reviews' findings, folded into the commits they fix:

- **The rest card linked to a singing drill.** After "Just listen today", "Effortful" or "Uncomfortable", the Wrap's rest card kept Drone Intonation as a live link, though nothing may send the learner to sing then (REQ-GVC-055). Its address is now words, as on every other lesson's rest card, and Stack is the card's one link. A unit test and End to end 10 assert it (21, 24).
- **Free play's Major · Minor stopped a playing pattern**, where Step 4's switches act from the next quaver and the pattern plays on (WEB-SPEC, Toys 1). A run the page builds now plays through a change of quality; a play of the chord or the scale still stops. Two tests, each failing under its own mutant (23).
- **The guide's breath word was drawn off the canvas.** Lesson 10's breath mark comes as *so*, the guide's top row, ends, and the word went above the canvas's top edge: the tick showed with no "breathe" (FACTS 66). Fixed in the kit, with a unit test that fails without it (22).
- **A cold open test compared two real-clock readings exactly**, and failed once on 1600.0000000000005. It now compares to 6 places, as its sibling does (13).
- **Docs brought up to the page**: where Play the chord sits on a phone, and why it stays there (16); the stuck stage's measured heights, the games' eight roots and the level of two notes together (29); Lesson 11's current hook in the next-lesson line, and two of the Length's word counts (26); the spec reads main, not Lesson 6's branch, and HANDOFF records #1206 and #1207 (28); six citations read again (27).

CI found one more, folded the same way:

- **The page-wide target check measured a card mid-landing.** The Wrap's checks scroll the season map's bar into view, and the kit's reveal lands that bar from `scale(.975)` over a second (`kit/reveal.ts`), so its filter chips were measured in the first frame, 42.9 px tall; CI's Chromium read 43. Each target is now measured at rest, once the entrance its scroll started has played out (24).

## First paint (build:e2e, bytes)

| Page | Script on `main` | Script here | Ceiling | Left | CSS on `main` | CSS here | Ceiling |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /learn/01 | 145,458 | 145,853 | 155 KB | 12,867 | 78,980 | 78,980 | 80 KB |
| /learn/02 | 165,613 | 166,159 | 165 KB | 2,801 | 85,493 | 85,493 | 95 KB |
| /learn/03 | 133,668 | 133,921 | 131 KB | 223 | 86,482 | 86,482 | 96 KB |
| /learn/04 | 131,823 | 132,375 | 129 KB, 130 here | 745 | 83,335 | 83,335 | 92 KB |
| /learn/05 | 138,241 | 138,489 | 136 KB | 775 | 87,191 | 87,191 | 96 KB |
| /learn/06 | 142,329 | 143,020 | 156 KB | 16,724 | 92,420 | 92,420 | 109 KB |
| /learn/07 | 135,712 | 136,046 | 161 KB | 28,818 | 90,072 | 90,072 | 106 KB |
| /learn/08 | 152,335 | 152,586 | 181 KB | 32,758 | 98,560 | 98,560 | 116 KB |
| /learn/09 | 153,922 | 154,283 | 188 KB | 38,229 | 88,410 | 88,410 | 108 KB |
| /learn/10 |  | 172,612 | 211 KB | 43,452 |  | 90,214 | 111 KB |

Measured in `build:e2e` on `main` `d37453987` and on this branch; Left is what this branch leaves under the script ceiling. Lessons 1 to 9 gain 248 to 691 bytes of script and no CSS: 216 are Lesson 10's season entry and drafts line, which every lesson page carries, and the rest is modules Lesson 10 shares with them only in part, regrouped into chunks of their own. That puts Lesson 4 279 bytes over its 129 KB ceiling, so the shell (11) raises it to 130, with the reason in the budget file. Lesson 10's ceilings are a quarter over its measure (25).

## Checks

These ran on `71289c89f` on `main` `d37453987`: this code before its twelve `(lesson-10)` subjects were reworded, its five module-map commits were squashed into one (31), and CI's fix above went into 24.

- `pnpm check`: no errors and the 11 warnings `main` has. It changed no files.
- Unit tests for the lessons and the lesson pages: 201 files, 2,418 tests, all pass.
- `pnpm test:scripts`, `pnpm pr:validate`, `docs:index:check` and `metrics:check`: pass.
- `plan-cites check`: 151 findings, all of them on `main` too, which has 157. The six this clears are in Lesson 10's FACTS and WEB-SPEC.
- `lesson:words` on Lesson 10: 2,331 words, 48 under the series' cap of 2,379, and every step's own text 92 to 120.
- `build:e2e`: in this checkout Vite stops when it copies the Glassworks model, a Git LFS pointer here, after it has written the site, so the six bundle asserts ran on that site by hand. All pass, the first-paint budgets among them, and the drafts assert finds Lessons 3 to 10 shown by default and pages 1 to 10 built. Every lesson page's first paint is the table above, to the byte.
- In the browser, on that build: Lesson 10's four specs, the next-lesson card's and the stage-fit spec, 139 tests with no retries: all pass.

CI's fix changes one test helper and nothing that is built, and the branch now sits on `main` `68a3c40e7`, which adds #1235's worker test and changes no page. On `06f7021f0`, the fixed branch before that rebase, with the same build: `pnpm check` (no errors, the same 11 warnings, no files changed), `pr:validate`, `metrics:check`, `docs:index:check` and `plan-cites check` (the same 151 findings) pass again, and the same 139 browser tests pass with no retries.

Earlier, on the same page code (every commit since touches only `docs/` or that test helper), all 42 `learn-` specs ran on a `build:e2e`: 596 passed and 2 skipped, Lessons 1 and 2's own skips.

## Left open

- **Release order.** Lesson 6's page goes live first, since this page's recall asks Lesson 6's questions and its prerequisite chip links Lesson 6; and the vocal coach looks at Sing it ("For the vocal coach" in LESSON.md). Both are in `kit/drafts.ts`.
- **The practice card and `/exercises/thirds-on-a-drone`.** The slug is built (#1224), and LESSON.md's editorial note moves the card, the rest card and the footer to it once this page is live. A page goes live from the console, with no release, so that switch needs a decision before Lesson 10 is published.
- **Copy the docs do not word yet.** The page uses these, and the spec records each where it describes the part, waiting on the copy pass:
  - the five figure labels;
  - the ear games' play labels, "Play a pair" and "Play a chord", which have no ask line yet;
  - the spiral's screen-reader description;
  - free play's opening line and its four group labels;
  - the ring's state words and the status lines Sing it takes from Lessons 6 and 8.
- **Kit fixes coming in 0.9.24 that this page shows too:**
  - a lit primary button's dark words (free play's Play, Play the pattern, the ear games' Play);
  - the sound gate's button width: this page's `.l10-hero .gate .btn` works around it, and goes when the kit's fix lands;
  - after "Effortful", the status line sits flush under the feeling buttons, and the do readout under Play Merc's notes.
- **The trail's links are 24 px**, the kit's target size for every lesson's trail (WCAG 2.5.8), where the series' Contract asks 44 px of every target. A question for the series, not for this page.
- **On a device, by ear and eye**: the chord's three notes balance and none drowns the others; the glide is smooth, with no click where it starts; a live WebGL Merc under reduced motion.
- **Headroom.** Lessons 3, 4 and 5 have 223, 745 and 775 bytes of script left under their ceilings. 0.9.24's kit fixes reach every lesson page, so whichever of the two merges second measures them again, and may need to raise one or split a chunk.
