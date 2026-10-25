# The lesson page tour

A first visit's welcome tour on a lesson page (`/learn/NN`), as built on 24 October 2026 on the
branch `feat/lesson-page-tour`. It opens on the stage where Merc and Tavi drop in, spotlit, then
walks the page in four more steps, with an X and a Skip for people who know their way around.

## When it starts

- On the first lesson page this browser opens at the top, with nothing after the `#`. Not on the
  hub (`/learn/`).
- A deep link (`/learn/03#sing`, a share, a practice link back) or a page already 40 px or more
  down skips it this time and records nothing, so the next lesson page opened at the top offers it.
- Offered once. Done, Skip tour, the X and Escape all close it and write `fyp-tour` = `1` to local
  storage. A later tour with more to show raises the version (`TOUR_VERSION`) and asks again. The offer itself writes `0`, so storage that reads but will not write gets no tour: it
  could never record the close, and the tour would come back on every page. Storage that throws
  (site data blocked) gets no tour either.
- It waits while another layer is up: an open dialog (the lesson menu), a film playing, or
  anything full screen. If the page has left the top by the time the layer closes, it waits for
  another page. A lesson page has no consent banner of its own, and it asks for the microphone only
  from a press on Sing it, which a page still at the top has not had.
- It opens as soon as its chunk arrives, which on a normal connection is before Merc and Tavi
  drop (0.4 s at the earliest, on Lessons 1 and 2), so step 1 shows the drop. On a slow one it
  opens on them once they have landed. It never waits on the live renderer: the stills are there
  when there is no live Merc.

## Steps

One list serves every lesson. A step whose targets are all missing or hidden on a page is left out
there, and the count follows ("1 of 4"). Every target of a step that shows is lit together. All
eight pages show all five steps, at 390 px and at 1440 px.

| #   | Lights                                                                            | Title              | Words                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `#heroStage`                                                                      | Meet Merc and Tavi | They teach every lesson. Listen to them sing, then sing along with them when it's your turn.                                                                           |
| 2   | `#stepsStage`                                                                     | One step at a time | Each step has a figure to play with and something to try. The arrows move between the steps, at your own pace.                                                         |
| 3   | `#sing`                                                                           | Your turn to sing  | Merc sings first, then you sing, wherever your voice feels easy. Stop if anything feels uncomfortable.                                                                 |
| 4   | `#graph` (wide), `#exList` (phone)                                                | The season, mapped | Every lesson in the season, and how each one builds on the ones before. Pick a lesson to see what it covers and what it builds on.                                     |
| 5   | `.lm-btn` and `#mastNav` (wide), `.lm-btn` (phone, where it carries the sections) | Find your way      | From up here you can jump to any part of this lesson, or open the lesson menu for every lesson in the season. Tour this page, in that menu, shows you this tour again. |

On Lessons 3, 5 and 7, whose Sing it listens once the viewer chooses to sing, step 3 adds: "If you
choose to sing, it listens through your microphone and shows what it heard. Nothing is recorded,
kept or sent."

The card's own words: "1 of 5", Back, Next (Done on the last step), Skip tour, and the X, named
"Close tour". All of the tour's words are in `src/features/lessons/kit/tour-copy.ts`, except the
menu's "Tour this page", which is drawn with the menu's other links in `lesson-menu.ts`.

## Look and behaviour

- The page dims around a rounded cutout over the target: one element whose box-shadow is the dim,
  placed from the target's box and moved on scroll and resize. After each step change it follows
  the target every frame until the target holds still, because a section's reveal plays as it
  scrolls in and moves the target with nothing to say so. A tall target is lit as far as it shows
  on the screen.
- A transparent sheet under the card takes every press on the page, the cutout included, and the
  rest of the page is `inert` while the tour is up. Only the card answers.
- On a wide screen the card sits beside its target where there is room (right, then left), under
  it where the target and card fit the height together, and at the foot of the screen where there
  is none. Under 640 px it docks at the foot, full width, and the target scrolls into the room
  above it. No sideways scroll at 390 px.
- The page jumps to bring each target into view, and back to where it was on close; the spotlight
  and the card glide to their new places. A target that already shows whole is not scrolled to.
  The masthead's step scrolls nothing.
- Merc and Tavi keep moving under step 1's spotlight.
- The card is a dialog (`role="dialog"`, `aria-modal="true"`, labelled by its title, described by
  its words). Focus moves onto Next; Tab and Shift+Tab stay in the card; Enter (off a card button)
  and the right arrow go forward, the left arrow and Back go back; Escape closes it as Skip does.
  Each step's words are in a polite live region. On close, focus goes back to where it was and the
  page to where it was scrolled.
- Reduced motion: the spotlight and the card jump too; nothing glides.
- The lessons' own tokens. The lesson pages have one dark theme, so the tour has one; a browser set
  to light shows the same dark page and card.

## Replay

"Tour this page" in the lesson menu's foot (the masthead's "Season 1 · Lesson 01" button, a sheet
under 821 px) closes the menu and starts the tour at step 1, whatever the record says. Its close
writes the record again and returns focus to the menu's button.

## Code and bytes

- `kit/tour-gate.ts`, on first paint: the rule above and the dynamic import. Every lesson page runs
  it from `initMasthead` (`page-chrome.ts`), after the lesson menu's button is in place.
- `kit/tour.ts`, `kit/tour-copy.ts` and `kit/lesson-tour.css`: one chunk, loaded when the tour
  starts. The stylesheet travels inside the chunk as a string (`?inline`): a stylesheet file of its
  own would give each lesson page a list of two files to fetch with the tour, where it has none.
  The chunk imports only its copy. It does not
  import the gate either: anything it imports that the page has already loaded makes it import
  the page's shared chunk and that chunk's own imports, and each page then lists four files to
  fetch with the tour where it lists none: 89 bytes on every lesson page (measured on
  `5e08dd4a3`), where a copy in the chunk costs first paint nothing. So `tour.ts` keeps its own
  copy of the record's name and version and of the top rule, and `tour.test.ts` holds the copy to
  the gate's values.

First paint, bytes of JavaScript, on main at `9c68c53cc`, where Lessons 1 and 2 play their films,
and with the tour, both built the same way:

| Lesson | Before  | After   | Ceiling | Room left |
| ------ | ------- | ------- | ------- | --------- |
| 1      | 142,250 | 142,693 | 158,720 | 16,027    |
| 2      | 162,391 | 162,834 | 168,960 | 6,126     |
| 3      | 131,440 | 131,883 | 133,120 | 1,237     |
| 4      | 130,318 | 130,761 | 132,096 | 1,335     |
| 5      | 136,385 | 136,828 | 139,264 | 2,436     |
| 6      | 140,658 | 141,101 | 159,744 | 18,643    |
| 7      | 133,572 | 134,015 | 164,864 | 30,849    |
| 8      | 150,641 | 151,084 | 185,344 | 34,260    |

The tour adds 443 bytes to every lesson page, and no ceiling rose. Render-blocking CSS grows by 3
bytes on each page (the menu's foot rule names its buttons, not only its links).

## Tests

- `kit/tour-gate.test.ts`: the first-visit rule with storage absent, present and throwing (on
  reach, read and write), the hash and scroll rule, and the record written on each way of closing.
- `kit/tour.test.ts`: steps left out for missing and hidden targets, the listening line, Enter,
  Next and Back, Escape, Tab wrap, focus return, the page made inert, the spotlight following a
  target that moves on its own, the wait for a dialog or a film, the placement rules, and the
  tour's copy of the record and the top rule against the gate's.
- `src/e2e/learn-lesson-tour.spec.ts`: a first visit opens on the stage and Next lights every step
  at 390x844 and 1440x900 with no sideways scroll; the card docks on a phone with each target above
  it; the dim and cutout take no presses; Done, Skip, the X and Escape close it for good across a
  reload; walking it on a wide screen marks no step of the lesson as reached; Tab stays in, Escape
  closes and focus returns to the menu after a replay; a deep link skips it and the next page
  offers it; all eight pages offer five steps; under reduced motion nothing glides.
- Every other learn spec imports `test` from `src/e2e/helpers/lesson-page.ts`, which writes the
  record before each document loads, so they never meet the tour.

## Departures from the lead's plan

- Step 2 lights `#stepsStage`, not `#lesson`. The section is the whole step column, thousands of
  pixels tall on a wide screen, so its cutout was the whole screen and the card had nowhere beside
  it. The stage is the deck itself: the counter, the arrows and the figure.
- Step 3 no longer says it listens and shows how close you are. Lessons 1, 2, 4, 6 and 8 never
  listen, and Lessons 5 and 7 show drift and a lit band, not closeness. The microphone line is
  added on 3, 5 and 7 only, in the pages' own words.
- Step 4 lights the map itself (`#graph`, or `#exList` under 860 px), not the whole section, for
  the same reason as step 2.
- Step 5 lights the lesson menu's button with the section links, since the claim "or to another
  lesson" is the menu's. On a phone the links are hidden and the menu's sheet carries them.
- Step 1's words say what the hosts do on every page; no claim about a tap on Merc, which does
  nothing.
- The menu's "Tour this page" is not in the copy file: that file loads with the tour, and the menu
  is drawn on first paint.
- The lessons have no light theme, so "light and dark" is one dark tour, checked under both
  colour-scheme settings.
- The page jumps to each target instead of scrolling there smoothly. On a wide screen the step deck
  follows the scroll and the kit keeps the furthest step reached (`kit/position.ts`), so a smooth
  scroll from the deck to Sing it passed every step, and the page remembered Lesson 1 read to step
  6 of 6 for a visitor who had read none: "Continue: step 6" in the menu and on the map. That
  happened on 3 runs in 3 at 1440 x 900 and never with a jump. The spotlight and the card still
  glide, so the eye can follow, and an end-to-end check holds it.
- The record is `fyp-tour`, not `mp.learn.tour`: every key a lesson page stores starts `fyp-`
  (`fyp-pos`, `fyp-motion`, `fyp-done`), the pages' Contracts list them by name, and Lesson 7's
  end-to-end check fails on any key outside its list. Lessons 7 and 8's Contracts now name it, and
  that check lists it with the kit's `fyp-pos`.

## Not in this PR

- Anonymous, consent-gated tour events (finished, or skipped at step n).
- A tour on the `/learn/` hub.
- Lesson-specific extra steps (Lesson 9's ladder, for example).

## For the owner

- The copy, in one file, and the number of steps (five).
- Where the replay sits: the lesson menu's foot, beside "See the season map".
- The Contracts of Lessons 9 to 14, not built yet, list what each page stores and do not name
  `fyp-tour`; each page's builder adds it beside `fyp-pos`.
