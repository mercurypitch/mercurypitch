Lesson 10 ("Major and minor") plays one sound at a time, rests page-wide, and shares the names switch with Lessons 4, 6 and 12. This adds what it needs to the kit. No new page uses it yet.

## What changes

- **The spiral plays through a page's sound owner.** `SpiralOptions.owner` takes the page's one-sound owner (`now-playing.ts`). With one, a note played on the spiral is a voice the page can stop:
  - it claims the owner, which stops the sound before it;
  - it fades out in 0.08 s when another sound claims the page.

  Without an owner nothing changes. Lessons 1 and 2 pass none.
- **The spiral rests when nothing on it moves.** It asks for a frame only while something it shows moves, or after something changed since its last frame.
  - A page's own drawing asks for frames through `overlayWants`.
  - Lesson 2's copies say nothing, so they keep drawing as before.
  - Lesson 1's spiral rests when it is still. Its sky keeps drawing, so neither page rests page-wide.
- **Move do keeps focus at its ends.** At an end the button takes `aria-disabled="true"` instead of `disabled`, so a keyboard user's focus stays on it.
  - Lessons 4, 6 and 8's handlers return first at an end, so a press there neither moves do nor stops what plays.
  - `clampMove`, `nextShift` and `setMoveEnds` take a reach for each side. It is four semitones both ways by default; Lesson 12 will pass four lower and three higher.
- **Names modes in the kit** (`kit/names-modes.ts`): Lesson 4's three modes, the two that Lessons 6, 10 and 12 offer, `MAJOR_SOLFEGE`, and the do-based `MINOR_SOLFEGE`. Lessons 4 and 6 import them. Nothing either page shows changes.
- **Plan citations** that these changes moved are re-anchored and checked against the code they cite.

## Commits

1. `feat(lessons): play the spiral's own notes through a page's sound owner`
2. `docs(find-your-pitch): re-anchor citations to the spiral`
3. `feat(lessons): let the spiral rest when nothing on it moves`
4. `docs(find-your-pitch): re-anchor citations to the spiral`
5. `feat(lessons): Move do keeps focus at its ends, with a reach for each side`
6. `feat(lessons): names modes and their syllables in the kit`
7. `docs(agent): regenerate the module map`

## First paint

These figures were measured per commit, before the rebase onto `9c68c53cc`:

| Lesson | Growth | What it pays for |
| --- | --- | --- |
| 1 | about 1,022 bytes | the spiral's sound owner and its rest |
| 2 | about 1,022 bytes | the spiral's sound owner and its rest |
| 4 | about 202 bytes | Move do's ends (138) and the names modes (64) |
| 6 | about 251 bytes | Move do's ends (140) and the names modes (111) |
| 8 | about 140 bytes | Move do's ends |

No ceiling moves. Lesson 2 kept 4,646 bytes under its ceiling at `5e08dd4a3`, and main has since cut every lesson page by 1,160. The lesson tour then added 1,773 to Lesson 2, leaving 4,796, so this branch's 1,022 would leave about 3,770. CI builds and measures again here.

## Tests

- The spiral:
  - its sound owner, in `spiral.test.ts`;
  - its rest, in a new `spiral-frames.test.ts`, kept separate so `spiral.test.ts` stays under the 600-line cap.
- Move do:
  - the kit's reach cases;
  - the kit's tests, Lesson 4's page test and Lesson 8's sing test check `aria-disabled` at each end, and that neither button is `disabled`;
  - in Lessons 6 and 8, a press at the lowest do during the sweep or the guide leaves it running, with do and the focus where they were.
- In the browser, Lessons 4, 6 and 8 by keyboard:
  - the focus stays on the button at the lowest do;
  - Chromium's accessibility tree reports it disabled, focusable and focused, read by a new helper, `src/e2e/helpers/ax-state.ts`.
- The names modes: the kit's lists, and Lesson 10's syllables under Major and Minor.

## Checks

Rebased onto `{{MAIN}}` on 26 October, after v0.9.22 was tagged and #1208 merged. In Lesson 9's FACTS.md, #1199 and #1208 had re-anchored citations on the line after the one where the Move do commit re-anchors `kit/move-do.ts`; both edits are kept, and the branch's own edits are unchanged. The module map was regenerated. On the new base:

- `pnpm check`: {{CHECK}}
- Unit tests for `src/features/lessons/kit` and Lessons 4, 6 and 8: {{UNIT}}
- `pnpm test:scripts` ({{SCRIPTS}}), `pnpm pr:validate` and `pnpm metrics:check` (no regressions): pass.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

CI runs everything again here, the browser specs and the first-paint budgets among them.

On the previous base, `7b7a666e7`, after the lesson tour merged on 25 October:

- The browser specs for Lessons 4, 6 and 8 took `test` from the tour's `helpers/lesson-page.ts`, which writes the tour's record before each page loads, beside this branch's `axState` helper.
- One citation line each in Lessons 9 and 14's FACTS.md carried the tour's anchor and this branch's.
- The module map was regenerated.

There, `tsc --noEmit` passed, the three specs passed Prettier, `pnpm docs:index:check` was up to date and `plan-cites check` gave 157 findings, the same as main.

Before that, on `9c68c53cc`:

- `pnpm check`: no errors and the 11 warnings main already has. It changed no files.
- Unit tests for `src/features/lessons`: 133 files and 1,244 tests pass. In the full run, two files could not load because the build machine's disk filled for a moment (`ENOSPC`); run again on their own, both pass.
- `pnpm pr:validate`: passes.
- `pnpm metrics:check`: no regressions.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.
- The browser specs for Lessons 1, 2, 4, 6 and 8 and the first-paint budgets passed on each commit's own branch before the rebase onto `9c68c53cc`.

## Merge

v0.9.22 is tagged. This merges after #1208, by rebase, once CI is green here. The next lesson PR is then rebased onto main and regenerates the module map.
