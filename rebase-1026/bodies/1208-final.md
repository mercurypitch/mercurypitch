Lesson 9 ("Landing a leap") draws Merc's ladder on the band chart and reads a sung ladder against it. This adds what its page needs from the kit and the browser-test helpers. No page uses it yet; the Lesson 9 page will.

## What changes

- **Rungs on the band chart** (`kit/band-chart-rungs.ts`). Each of Merc's notes becomes a rung: the kit's band at its cents from do. A rung sits over its own time slot, so a phrase reads as a staircase, or runs across the plot, so the ladder reads as rows.
  - A rung glows while its note sounds.
  - Its edge lights ("IN THE BAND") while the singer's line sits inside it.
  - It is drawn faint before its turn.
  - A page passes the painter in through `BandChartOptions`, so Lessons 3 and 5 never download it.
- **Merc's arcs** (`kit/band-chart-arcs.ts`). A leap draws as an amber arc from the end of one band to the start of the next.
  - An arc can draw part of itself, so it can draw as the second note sounds.
  - It can carry a number.
  - `columnArcs` lays out Step 4's five leaps in equal columns.
- **Rung names** (`kit/band-chart-names.ts`). The notes axis can name each rung's row in words ("so · A3") instead of lettering every row. The gutter widens to fit. A chart without names is unchanged.
- **The octave tag moves into the kit.** `octaveTag` and `octavesOf` move unchanged from `lesson-03/sing-take.ts` to `kit/band-words.ts`, so Lesson 9's take can draw Lesson 3's "octave lower" tag too.
- **`writeStepsWav`** for the browser tests. It makes a fake microphone that waits, then sings a stepped ladder, so Lesson 9's 4-of-4 take can run end to end. `fakeMicArgs` takes `{ loop: false }`.
- **Tests that needed a lesson with no page** now ask `lessonWithNoPage()` (`kit/season.test-fixtures.ts`) instead of naming Lesson 9 or 10. They would otherwise break when those pages land.
- **Plan citations** that these changes pushed down are re-anchored and checked against the code they cite.

The first commit records, mark by mark, what the band chart paints for Lessons 3 and 5. Those charts paint the same at the end of the stack.

## Commits

1. `test(lessons): Record what the band chart paints for Lessons 3 and 5`
2. `feat(lessons): Paint rungs on the band chart for Lesson 9`
3. `docs(find-your-pitch): re-anchor the citations the rungs moved`
4. `feat(lessons): Draw Merc's arcs and name the rungs on the band chart`
5. `docs(find-your-pitch): re-anchor the citations the arcs and names moved`
6. `refactor(lessons): Move the octave tag into the kit's band words`
7. `test(e2e): writeStepsWav for stepped fake-mic takes`
8. `test(lessons): find a lesson with no page instead of naming Lesson 9`
9. `docs(agent): regenerate the module map`

Each commit's message says what it adds, which tests pin it, and what it costs on first paint.

## First paint

These figures were measured per commit, before the rebase onto `9c68c53cc`:

- Lesson 3 grows by about 194 bytes: 26 for the rungs' hook, 134 for the names' hook and the letters flag, and 34 for the octave tag.
- Lesson 5 grows by about 160 bytes.
- Every other page is unchanged.
- No ceiling moves. The lesson tour has since left Lesson 3 780 bytes under its ceiling, so these 194 would leave about 590.
- The arcs and names modules are in no bundle yet.

CI builds and measures again here.

## Tests

- In the kit: `band-chart.test.ts` (the recorded charts), `band-chart-rungs.test.ts`, `band-chart-arcs.test.ts`, `band-chart-names.test.ts` and `band-words.test.ts`.
- `src/tests/e2e-tone-wav.test.ts` reads the stepped file back:
  - each step's pitch, within a cent;
  - the joins, to a tenth of a millisecond;
  - the fades and the rests;
  - both forms of the flags.
- The seven test files that the last test commit changes still pass with pages added in HANDOFF's suggested order (9, 10, 12, 11, 13). Once Lesson 14's page, the last, lands, the nine tests that ask `lessonWithNoPage()` fail with a message that every lesson now has a page.

## Checks

Rebased onto `46827ea18` on 26 October, after v0.9.22 was tagged and #1199 and #1207 merged. In Lesson 14's FACTS.md, #1198 and #1199 had re-anchored citations to `slug-map.ts` and `kit/take.ts` on the lines where the octave-tag commit re-anchors its `kit/band-words.ts` ones; both sides' edits are kept, and that commit's own edits are unchanged. The module map was regenerated where the branch touches it. These checks ran on the same tree, stacked on #1207 before it merged:

- `pnpm check`: no errors and the 11 warnings main already has; it changed no files.
- The 14 test files this branch changes: 196 tests pass.
- `pnpm test:scripts` (255 of 255), `pnpm pr:validate` and `pnpm metrics:check` (no regressions): pass.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

CI runs everything again here.

On the previous base, `a6f839e14`, the 0.9.22 release commit: #1216 had re-anchored citations to `src/seo/entry-pages.ts` and `kit/lesson-base.css` on the lines next to the octave-tag commit's `kit/band-words.ts` anchors in Lesson 14's FACTS.md; both sides' edits are kept. That commit differed only in those neighbouring lines, and the other eight, the module map's among them, kept their patch-ids. There:

- `pnpm check`: no errors and the 11 warnings main already has. It changed no files.
- The 14 test files this branch changes: 196 tests pass.
- `pnpm test:scripts`, `pnpm pr:validate` and `pnpm metrics:check` (no regressions): pass.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

On the base before that, `7b7a666e7`, after the lesson tour merged on 25 October: the tour had re-anchored citations on the same lines of Lesson 9's FACTS.md as this branch's two re-anchor commits, so each of those lines carries both, and the module map was regenerated at each commit that touches it. The map was up to date, `plan-cites check` gave 157 findings, the same as main, and the test files this branch changes, with the band chart's and the band words', passed: 11 files and 162 tests, the lesson menu's among them, which the tour also changed.

Before that, on `9c68c53cc`:

- `pnpm check`: no errors and the 11 warnings main already has. It changed no files.
- Unit tests, the full run: 143 files and 1,359 tests. 1,324 pass. The other 35 hit the 5 s limit while the build machine ran two other builds: every test in `AdminLessonsPage.test.tsx` and `AdminLessonsPage.publish.test.tsx`, and one each in `beat-layout.test.ts`, `lesson-06/steps.test.ts` and `lesson-07/sing.test.ts`.
  - Run again on its own, `lesson-06/steps.test.ts` passes.
  - The other four files pass in full (64 tests) with a 20 s limit. When they pass, the admin tests take about 2 to 5 s each on this machine.
  - This branch changes only the expected values in one admin page test. Giving the admin page's tests their own time limit was separate work, since done in #1211.
- `pnpm pr:validate`: passes.
- `pnpm metrics:check`: no regressions.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 157 findings, the same as main.

## Left for later

- One `AdminLessonsPage.test.tsx` test looks for its own planned lesson. It fails with a TypeError once Lesson 14's page lands.

## Merge

v0.9.22 is tagged and #1207 has merged. This merges by rebase once CI is green here. The next lesson PR is then rebased onto main and regenerates the module map.
