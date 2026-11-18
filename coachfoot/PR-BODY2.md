At 320x568 the Sing tour's bubble docks at the top of the screen, capped at 45dvh, and it scrolled as a whole. Once Play the note adds its line on how to hear the note, the words and the buttons together are 302 px in a 254 px box: Back and Skip this step show 8 of their 44 px, the count is hidden, and nothing says they are there. Done shows 6 px at the last stop, and 14 and 34 px in Show me more's two rounds. The hear line and Show me more are new in 0.9.24, so this is fixed before its tag. Larger text does the same on any phone.

The words now scroll in a row of their own above the buttons, under the same cap, so the buttons, the count and End tour stay whole and on top wherever the bubble stands. While some words are below the fold their foot fades, and each step starts its words at the top. With focus on the bubble, the arrow, Page, Home, End and Space keys scroll the words, as they scrolled the bubble before. The words' box adds no Tab stop, and a press on it still focuses the bubble.

## What changes

- `CoachLayer.module.css`:
  - The bubble's grid gives the words a row (`1fr auto`). It takes what the buttons leave under the cap, and never less than Merc.
  - The words' box scrolls (`max-height: 100%`, `overflow-y: auto`). It has 4 px of padding, taken back by a margin, so a focus ring stays inside its clip and no word moves.
  - Its foot fades while there is more below (`.bubble[data-more] .content`), and `scroll-padding` keeps a focused control clear of the fade.
  - The X stays over the faded box (`z-index: 1`).
  - The 45dvh cap is unchanged. Only a row of buttons taller than the cap still scrolls the whole bubble.
- `CoachLayer.tsx`:
  - `data-more` is set from the words' scroll position: on scroll, on the layer's 300 ms check, when a step adds a line, and on the hand-over card.
  - Each step's words start at the top.
  - The scroll keys work from the bubble.
  - The words' box gets `tabindex="-1"`, and a press on it hands focus back to the bubble. Without it, Chromium makes a scroll box with no control inside a Tab stop: in Show me more, an unnamed one between End tour and Done.
  - The file is 797 lines, under the 800 that `metrics:check` holds files to.
- Tests: `CoachLayer.words.test.tsx` (19 tests), and a 320x568 touch case in `coach-tours.spec.ts`.
- `dev-changelog.md`, in a commit of its own: 0.9.24's notes take this fix, Lesson 12's page (#1242) and #1240's `.gitignore` line, and now count 67 commits from 10 PRs. The release steps say the site worker holds `/learn/12` back as it holds `/learn/10`, and that `og:versions` stamped its 13 cards with no change; Lesson 12's new card is outside that set, as every lesson's card is.

## Before and after

Measured on a production-like build in Chromium. The phone sizes and 844x390 ran with touch and a phone user agent.

**Where everything fits, nothing moves.** At 375x667, 390x844, 844x390, 1024x768 and 1440x900, all 56 moments the walk stops at match `main` to 0.01 px. That covers the bubble, its title, body and lines, every foot control's box and hit test, the X, the aria attributes and where focus is. The only difference: the words' box's scroll height is 8 px larger, its new padding.

**At 320x568,** the bubble's box is the same at every moment:

| Moment | Words, scroll height / visible | Foot on `main`, px shown of 44 | Foot here |
| --- | --- | --- | --- |
| Sing, step 2, after the note | 222 / 222, now 230 / 182, faded | Back and Skip 8.3, and a tap at their middle misses; the count hidden | all whole and on top |
| Sing, step 4 | 173 / 173, now 174 / 130, faded | Done 5.6, and a tap misses | whole and on top |
| Show me more, round 1 | 217 / 217, now 225 / 182, faded | Done 14, and a tap misses | whole and on top |
| Show me more, round 2 | 197 / 197, now 205 / 182, faded | Done 33.6 | whole and on top |
| Sing, steps 1 to 3 before the note; Karaoke, stops 1 to 3 | fit | whole | the same |

**Doubled text.** With the root font at 200%, a stand-in for large-text settings, at 390x844: `main` hid foot buttons at 6 of 7 moments and cut the X at 2. Here every one is whole. At 1440x900 the cap is never reached, and nothing changes.

**Keyboard.** The Tab order matches `main` at every moment checked, and a press on the title still focuses the bubble. At 320x568, ArrowDown twice now scrolls the words (0 to 48), where on `main` it scrolled the bubble.

## Checks

Rebased onto `main` `9fd052508`, after #1242, as `db4b7dce0`: the fix's patch and message are unchanged (`git range-diff`), and #1242 touches none of its files. The notes commit makes the head `07dd214f3`. On that head: `pnpm check` gives no errors and the 11 warnings `main` has, and changes no files; the coach's unit tests (9 files, 139 tests), `pr:validate`, `metrics:check` and `docs:index:check` pass; `og:versions` changes nothing.

Before the rebase, on `aab3508e6`, on `main` `866e53c30`. `pnpm check`, the build and the browser runs ran just before a trim of this commit's own comments, which builds to the same code byte for byte. The unit tests, `pr:validate`, `docs:index:check`, prettier and eslint ran again on the final commit.

- `pnpm check`: no errors and the 11 warnings `main` has. It changed no files.
- The coach's unit tests (`src/components/coach/`): 9 files, 139 tests, all pass.
- `build:e2e`, then its first-paint asserts: 28 documents, all pass. The coach loads lazily, so no lesson's first paint changes.
- In the browser, with no retries: the coach-tours, sing-show-more, karaoke-tour, tour-chip-floats, header-touch-targets, stage-and-tour-focus and small-help-targets specs. 81 tests, all pass.
- The new 320x568 case, run with `main`'s stylesheet under this branch's script, fails at the note stop: "Back: 255 to 299, the bubble 8 to 264", Back and Skip covered at their middles, the count at 270 to 285.
- The guided tours walk on `build:tours`: 144 steps on desktop and 127 on a phone. None is without a visible spotlight, and none is wide but the known ones.
- `pnpm pr:validate`, `metrics:check` and `docs:index:check`: pass.

## Left open

- **Play the note at 320.** Once the note has played, the new line pushes the button under the fold, beneath the fade. It is one swipe or one Tab away, and Tab brings it into view with its ring whole. The hear line could go after the button, or the button into the foot.
- **Karaoke's last stop at 320, after Back,** stands at the bottom, unringed, for less than a quarter of a second while Add a song scrolls into view, then settles at the top with its ring. No placement code changes here, but this was not sampled on `main`.
- **Not checked:** WebKit, Firefox and real phones. That includes whether `tabindex="-1"` keeps Firefox and Safari from making the words' box a Tab stop, and whether older Safari fades with `-webkit-mask-image`. Screen-reader output itself was not checked either; the aria attributes and focus moves are unchanged.
