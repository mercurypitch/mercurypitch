Six fixes to onboarding, the plan, the Map and Home, from the owner's walk-through and a local browser walk, for 0.9.22. Nothing is cut: every button and card the plan had is still there.

## What changes

**A range read that is not clean is not a narrow range.** A steady tone reads 0 semitones. The twin already said Merc couldn't get a clean read, yet the plan sent the read to the range stop ("There's more voice up there than you're using"), Keep showed "A3 to A3" and the twin's card drew A3 and A3. There is now one rule, `isCleanRange` / `cleanRange` beside `singerForRange` in `src/lib/mirror/singer-match.ts`: a read is clean when its span names a voice type. `pickFirstStop`, Keep, the twin's stat card, the voiceprint share and the twin all read it, so an unclean read counts as not measured. `computeRange` and the Voice Mirror's own screens are unchanged.

**The plan's main button starts the first stop.** The big button is "Start here", the card's own kicker, and opens the stop exactly as its card does: the same funnel event, no tour. "Show me around" stays as the second button and still enters Start here with its room's tour; "See every room" stays the quiet link, and Not now stays in the corner. On a phone the main button is full width with the other two under it; on a wide screen the three share a row. Both hosts get it: First Light's plan and the plan layer over Home.

**With a voiceprint, Start here keeps its answer.** For "Telling if I'm getting better", the voiceprint's card now ends with "Every take lands in Progress, so you can watch the line move." where that is true: Exercises and the Ascent, whose runs land in Progress. Karaoke Night writes no session record, so its card makes no Progress promise. The 'what' and 'tune' picks already read as answered and are unchanged.

**Home's Lessons link opens the visitor's current lesson.** It opens the first lesson released as built that this browser has not marked done (the lesson pages' own `fyp-done` list), and the hub once both are: `/learn/01`, then `/learn/02`, then `/learn/`. Never a draft: the app shell does not know the admin console's state, so it offers what every environment serves. The helper is `src/lib/current-lesson.ts`; the done list's key and parse move to `src/lib/lesson-done.ts`, which the lesson pages' `kit/progress.ts` now imports, so no cross-feature import is added.

**The Map shows the lessons.** "And also" gains a Lessons door with its own event, and a Lessons section under the account line names the current lesson by its title, shows its cover whole and links it. Web only: neither shows in the native build. This is the Map that "See every room" opens and `#/map` replays.

**The Learn card's cover shows whole, and the plan uses a tablet's width.** A lesson's cover is its share image, with the title written in it. The side cards cut it to a strip as tall as the card: "at is a no" on a phone, and a 158x356 slice beside Start here on a landscape tablet with a voiceprint. Under 900 px the cards also kept a phone's 440 px column. A lesson's cover is now contained at its own shape (`data-cover="whole"`, from `coverHasWords`): inset beside the words on a phone, 200x105 on an upright tablet, and over the words in the right-hand column from 900 px. From 600 px the column and the main button are 640 px wide, and Start here keeps its own height. Room covers still crop. Home's plan card has text-only tiles and was not affected.

## Words

No new sentences. Reused: "Start here" (`KICKER`), "Lessons" (Home's label) on the door and as the section's kicker, the season's lesson titles, Home's link title "Find Your Pitch: free lessons on notes and singing", and plan-copy's "Every take lands in Progress, so you can watch the line move."

## Privacy

One new funnel name, `onboarding_map_door_lessons`, sent as the other Map doors' names are (`src/lib/funnel-event-catalog.ts`; the DB worker's allowlist follows that file).

## Checks

On the builder's head, on main cddefd571:

- `pnpm check`: 0 errors, 11 warnings (as on main). Unit: 968 files, 13339 passed, 1 skipped (onboarding, plan, home, pages, lib, tests). `pnpm test:scripts` 255; `pnpm pr:validate`; `pnpm metrics:check` no regressions; `pnpm docs:index:check` current; plan citations 157 findings, as on main.
- `build:e2e` to the Glassworks LFS step (expected in this checkout). First-paint budgets pass, none changed: the app's entry documents +967 bytes of JavaScript (one more chunk), lesson pages +224 to +266; draft lessons shown as expected.
- Browser, `--retries=0`: onboarding, onboarding-mic, onboarding-plan-keyboard, onboarding-viewports, walkthrough, stage-and-tour-focus, learn-lesson-01 and accessibility-axe, 49 passed and 1 skipped (a conditional skip, as on main).
- Tours: 144 desktop and 127 phone steps, 0 without a spotlight.
- Mutations, each caught: an unclean read sent to the range stop; the stat card, Keep or the share showing an unclean range; the main button entering with the tour, or Show me around removed; the Progress answer dropped, or given to Karaoke Night; the helper returning a draft, or `/learn/01` after Lesson 1; the door or the section in the native build; a lesson cover cropped again, or the 440 px column back.

On this head, rebased onto main b8479306a (#1216 merged), checked again:

- `pnpm check`: 0 errors, 11 warnings (as on main), nothing rewritten. Unit: the 19 test files #1216 and this branch touch, plus `src/tests`: 629 files, 8898 passed, 1 skipped. `pnpm test:scripts` 255; `pnpm pr:validate`; `pnpm metrics:check` no regressions; `pnpm docs:index:check` current; plan citations 157 findings, as on main.
- `build:e2e` to the Glassworks LFS step. First-paint budgets pass with #1216's lesson-page CSS and this branch's JavaScript together, none changed; the least room left is Lesson 3's 520 bytes of JavaScript (a draft). Draft lessons shown as expected.
- Browser, `--retries=0`: onboarding, onboarding-mic, onboarding-plan-keyboard, onboarding-viewports, learn-lesson-01, learn-ways and learn-lesson-tour, 77 passed and 1 skipped (Lesson 1's "nothing to watch" test, which skips while the film has its sources).

## Notes

- The released lessons are listed in `src/lib/current-lesson.ts` as well as in the season data and the drafts list, since `src/lib` cannot import a feature. `current-lesson.test.ts` fails when they disagree, so releasing a lesson as built updates all three.
- On a phone the fifth door wraps to a second row of "And also".
- Keep's feature line "Your voiceprint and range, saved" still shows after an unclean read; only the range card goes.
