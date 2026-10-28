# The lesson page tour

A first visit's welcome tour on a lesson page (`/learn/NN`), as built on 24 October 2026 on the
branch `feat/lesson-page-tour`, and changed on 25 October at the owner's word: the page glides to
each step, and nothing counts as read while it does; a question mark at the masthead's right end
plays it again from anywhere; and on Lessons 1 and 2 the page holds still while Merc and Tavi land,
then the tour starts. It opens on the stage where Merc and Tavi drop in, spotlit, then walks the
page in four more steps, with an X and a Skip for people who know their way around.

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
- On Lessons 1 and 2 it waits for the opening shot to end, both characters landed and both
  bubbles up, with the page held still meanwhile, and 6 s after the page started at the most (see
  [The opening hold](#the-opening-hold-lessons-1-and-2)). On Lessons 3 to 9 it opens as soon as
  its chunk arrives. It never waits on the live renderer: the stills are there when there is no
  live Merc.

## Steps

One list serves every lesson. A step whose targets are all missing or hidden on a page is left out
there, and the count follows ("1 of 4"). Every target of a step that shows is lit together. All
eleven pages show all five steps, at 390 px and at 1440 px.

| #   | Lights                                                                                                             | Title              | Words                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `#heroStage`                                                                                                       | Meet Merc and Tavi | They teach every lesson. Listen to them sing, then sing along with them when it's your turn.                                                                                                                       |
| 2   | `#stepsStage`                                                                                                      | One step at a time | Each step has a figure to play with and something to try. The arrows move between the steps, at your own pace.                                                                                                     |
| 3   | `#sing`                                                                                                            | Your turn to sing  | Merc sings first, then you sing, wherever your voice feels easy. Stop if anything feels uncomfortable.                                                                                                             |
| 4   | `#graph` (wide), `#exList` (phone)                                                                                 | The season, mapped | Every lesson in the season, and how each one builds on the ones before. Pick a lesson to see what it covers and what it builds on.                                                                                 |
| 5   | `.lm-btn`, `#mastNav` and `.lm-tour` (wide), `.lm-btn` and `.lm-tour` (phone, where the menu carries the sections) | Find your way      | From up here you can jump to any part of this lesson, or open the lesson menu for every lesson in the season. Tour this page, in that menu, shows you this tour again. So does the question mark at the top right. |

On Lessons 3, 5, 7 and 9, whose Sing it listens once the viewer chooses to sing, step 3 adds: "If
you choose to sing, it listens through your microphone and shows what it heard. Nothing is recorded,
kept or sent."

The card's own words: "1 of 5", Back, Next (Done on the last step), Skip tour, and the X, named
"Close tour". All of the tour's words are in `src/features/lessons/kit/tour-copy.ts`, except the
menu's "Tour this page", which also names the question mark: both are drawn on first paint in
`lesson-menu.ts`.

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
- The page glides to bring each target into view, and back to where it was on close; the
  spotlight and the card glide with it. A target that already shows whole is not scrolled to. The
  masthead's step scrolls nothing.
- Nothing counts as read while the tour is up. A glide passes every step on its way, so from the
  moment the tour opens until the page has come to rest after it, `<html>` carries the class
  `touring`, which the kit reads (`dom.ts` `touring`) before it counts anything: the step deck
  holds its step, so the lesson menu's ring, "You are here" and step ticks stay put, and
  `rememberSteps` writes nothing to `fyp-pos`. A class on the page is the one signal both sides
  can read without the chunk importing the kit. It lifts on every way out (Done, Skip tour, the X,
  Escape, and `closeTour()`, as a page leaving calls it) once the page is at rest after the glide
  back: five still frames where it was going, half a second still anywhere else (a viewer's own
  scroll stopped it), or 3 s at the most, since a hidden page draws no frames and `scrollend` is
  not everywhere. A tour that throws as it opens takes itself down, gives the page back with
  nothing inert, lifts the class and writes no record, so another page offers it. Nothing else
  records reading from the scroll: `fyp-done` is written only by the quiz and the explorer card,
  and a section's reveal persists nothing.
- Merc and Tavi keep moving under step 1's spotlight.
- The card is a dialog (`role="dialog"`, `aria-modal="true"`, labelled by its title, described by
  its words). Focus moves onto Next; Tab and Shift+Tab stay in the card; Enter (off a card button)
  and the right arrow go forward, the left arrow and Back go back; Escape closes it as Skip does.
  Each step's words are in a polite live region. On close, focus goes back to where it was and the
  page to where it was scrolled.
- Reduced motion, or the page's animations paused with its motion switch (`fyp-motion`, which
  marks `<html>` `motion-paused`): the page, the spotlight and the card move at once; nothing
  glides.
- The lessons' own tokens. The lesson pages have one dark theme, so the tour has one; a browser set
  to light shows the same dark page and card.

## Replay

Two ways, both starting the tour at step 1 whatever the record says, its close writing the record
again and giving focus back to the button pressed:

- "Tour this page" in the lesson menu's foot (the masthead's "Season 1 · Lesson 01" button, a sheet
  under 821 px) closes the menu and starts the tour.
- A question mark at the masthead's right end, on every lesson page: a 44 px button, the menu
  button's height, named "Tour this page", drawn from a sprite symbol each page carries (`i-help`),
  with the kit's focus ring. From 1181 px it sits in the masthead's row after the switches, where
  every lesson's row has at least 34 px more than it needs. Narrower, the row has no room at most
  widths, 6, 46 and 1 px to spare at 320, 360 and 390 px and none at 821 and 1021 px, against the
  50 to 62 px a button and its gap need, so it hangs under the masthead's right end as a 36 px disc
  in the same 44 px target, and stays with the masthead as the page scrolls. The top right covers
  the ragged ends of lines rather than their starts, keeps clear of the toast and the tour's docked
  card at the foot, and sits beside the masthead the tour's last step lights. From 961 to 1180 px,
  where the step stage sticks 18 px under the masthead with its step arrows at its top right, the
  disc moves out into the gutter, over the stage's rounded corner, and its target clears theirs. It
  hangs from the masthead itself, since the masthead's backdrop-filter makes it the containing
  block of anything fixed inside it.

## The opening hold (Lessons 1 and 2)

On the visit that offers the tour, and only when the opening plays, Lessons 1 and 2 hold the page
still until Merc and Tavi have landed and both bubbles are up, then start the tour, so step 1 lights
two characters at rest with their words showing. Before, a viewer could scroll away at once, miss
the shot, and the tour then gave up, the page no longer at the top.

- Each lesson's `entrance.ts` builds a promise for the end of its opening from the landing and
  bubble animations' own `finished`, not a timer, and hands it to `kit/opening-hold.ts`. A
  cancelled animation ends it too.
- The hold is the lesson menu's scroll lock, `overflow: hidden` on `<html>` (`html.tour-wait`
  beside `html.lm-open` in `lesson-menu.css`): the wheel, a swipe, the keys and the scrollbar all
  leave the page where it is.
- It is first-paint code, never the tour's, with its own cap: it lifts as the tour opens or gives
  up, 6 s after the page started whatever the tour is doing (`HOLD_CAP`, which also lets the tour
  go), at once when the tour's chunk fails to load (offline), when a dialog opens (the lesson menu
  works as ever, and the tour follows once it closes, if the page is still at the top), when a film
  plays or anything goes full screen, when the page itself moves (a section link), and when the
  page is hidden.
- The gate keeps it small (`holdTour` in `tour-gate.ts`): the tour's chunk still loads as the page
  starts, so the card comes up as the shot ends. A replay from the question mark or the menu opens
  at once and lets the page go; a first visit's tour that then finds the tour closed gives up.
- Lessons 3 to 9, deep links, reduced motion, a page already scrolled and return visits hold
  nothing and wait for nothing.
- On Lesson 1 at 1440 x 900 on the dev server the hold ran from 0.9 s to 4.9 s, and the card came
  at 4.9 s with nothing still moving; on Lesson 2 from 1.2 s to 5.2 s. In emulated touch, a swipe
  during the hold left the page at the top, and the lesson menu opened and closed during it with
  the tour following at 5.0 s.

## Code and bytes

- `kit/tour-gate.ts`, on first paint: the rule above, the dynamic import, and `holdTour`, through
  which Lessons 1 and 2's opening holds a first visit's tour. Every lesson page runs it from
  `initMasthead` (`page-chrome.ts`), after the lesson menu's button is in place.
- `kit/opening-hold.ts`, on first paint on Lessons 1 and 2 only (their `entrance.ts` imports it):
  the hold and its cap.
- The question mark: a few lines in `lesson-menu.ts` and its rules in `lesson-menu.css`, on first
  paint on every lesson page, and the `i-help` symbol in each page's sprite.
- The pause on reading: `touring` in `kit/dom.ts`, read by `kit/step-deck.ts` and
  `kit/position.ts`; the tour writes the class itself.
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

The 25 October changes, against the branch at `0e9caecb2`, both built the same way with
`build:e2e` (all 26 documents within budget, no ceiling raised, and no document but the eight
lesson pages moved):

| Lesson | JS before | JS after | Change | Ceiling | Room left | CSS change | HTML change |
| ------ | --------- | -------- | ------ | ------- | --------- | ---------- | ----------- |
| 1      | 142,693   | 144,003  | +1,310 | 158,720 | 14,717    | +785       | +217        |
| 2      | 162,834   | 164,164  | +1,330 | 168,960 | 4,796     | +785       | +217        |
| 3      | 131,883   | 132,340  | +457   | 133,120 | 780       | +785       | +217        |
| 4      | 130,761   | 131,215  | +454   | 132,096 | 881       | +785       | +217        |
| 5      | 136,828   | 137,285  | +457   | 139,264 | 1,979     | +785       | +217        |
| 6      | 141,101   | 141,558  | +457   | 159,744 | 18,186    | +785       | +217        |
| 7      | 134,015   | 134,472  | +457   | 164,864 | 30,392    | +785       | +217        |
| 8      | 151,084   | 151,536  | +452   | 185,344 | 33,808    | +785       | +217        |

On every page the JavaScript is the question mark, the pause's two reads and the gate's
`holdTour`; Lessons 1 and 2 add the hold and their entrances' promise. The CSS is the question
mark's rules and the hold's selector; the HTML is the `i-help` symbol. Lesson 3 has the least room
left, 780 bytes.

## Tests

- `kit/tour-gate.test.ts`: the first-visit rule with storage absent, present and throwing (on
  reach, read and write), the hash and scroll rule, and the record written on each way of closing;
  a first visit's tour held until what it waits for settles and then calling back, nothing held on
  a visit with no tour, a replay opening at once while a first visit waits and the first visit then
  giving up, and the call back when the chunk fails to load.
- `kit/tour.test.ts`: steps left out for missing and hidden targets, the listening line, Enter,
  Next and Back, Escape, Tab wrap, focus return, the page made inert, the spotlight following a
  target that moves on its own, the wait for a dialog or a film, the placement rules, and the
  tour's copy of the record and the top rule against the gate's; the glide to a step and back, and
  at once under reduced motion; `touring` from the moment the tour opens, lifted on each way out
  only once the page is at rest (moving, not yet moving, stopped short by the viewer, and the 3 s
  cap with no frames), and a tour that fails as it opens.
- `kit/position.test.ts`: a step the deck moves to while the tour is up is not remembered, and the
  next one after it closes is. `kit/step-deck.test.ts`: the deck holds its step under `touring`
  and follows the scroll again after.
- `kit/lesson-menu.test.ts`: the question mark ends the masthead, is named "Tour this page", draws
  `#i-help` and plays the tour from step 1 on a browser that has closed it; every lesson page's
  sprite has the symbol.
- `kit/opening-hold.test.ts`: the hold on a first visit until the opening ends, then the tour and
  the page let go; nothing held for a visit with no tour or for a replay; and each way it lifts:
  the cap (and the tour then opens), an opening that fails, a chunk that fails to load, a dialog, a
  film, full screen, the page moving and the page hidden, but not a box scrolling inside the page.
- `src/e2e/learn-lesson-tour.spec.ts`: a first visit opens on the stage and Next lights every step
  at 390x844 and 1440x900 with no sideways scroll; the card docks on a phone with each target above
  it; the dim and cutout take no presses; Done, Skip, the X and Escape close it for good across a
  reload; walking it on a wide screen glides (each Next leaves the page where it was in its own
  task), marks no step reached, keeps the deck on step 1, and once the page is at rest the viewer's
  own scroll to step 3 is remembered; Tab stays in, Escape closes and focus returns to the menu
  after a replay; the question mark plays it from step 1 on a return visit, at 390x844 and
  1440x900, as tall as the menu button, and takes the focus back; a deep link skips it and the next
  page offers it; all eleven pages offer five steps, and Lesson 10's and Lesson 12's light their
  targets at 390x844 and 1440x900; on Lesson 1's first visit the wheel and the keys leave the page
  at the top with no scrollbar, and the card comes with nothing moving, before the cap, as the hold
  lifts; Lesson 3 never holds; under reduced motion nothing glides.
- Each test added on 25 October was checked by mutation: with the behaviour it covers taken out,
  it fails.
- Every other learn spec imports `test` from `src/e2e/helpers/lesson-page.ts`, which writes the
  record before each document loads, so they never meet the tour.

## Departures from the lead's plan

- Step 2 lights `#stepsStage`, not `#lesson`. The section is the whole step column, thousands of
  pixels tall on a wide screen, so its cutout was the whole screen and the card had nowhere beside
  it. The stage is the deck itself: the counter, the arrows and the figure.
- Step 3 no longer says it listens and shows how close you are. Lessons 1, 2, 4, 6 and 8 never
  listen, and Lessons 5 and 7 show drift and a lit band, not closeness. The microphone line is
  added on 3, 5, 7 and 9 only (`LISTENING_LESSONS`), in the pages' own words.
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
- As first built, the page jumped to each target instead of scrolling there smoothly. On a wide
  screen the step deck follows the scroll and the kit keeps the furthest step reached
  (`kit/position.ts`), so a smooth scroll from the deck to Sing it passed every step, and the page
  remembered Lesson 1 read to step 6 of 6 for a visitor who had read none: "Continue: step 6" in
  the menu and on the map. The jump marked nothing: walking Lesson 1's tour to Done from a clean
  browser left `fyp-pos` empty at 1440 x 900 and at 390 x 844, three walks each (on a phone the
  deck does not follow the scroll at all). It glides now, with reading paused while the tour is up
  (see Look and behaviour), and an end-to-end check holds both.
- The question mark is not in the masthead's row under 1181 px: the row has no room for it at 320,
  360 and 390 px, so it hangs under the masthead's right end there (see Replay).
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
- Where the replay sits: the lesson menu's foot, beside "See the season map", and the question
  mark at the masthead's right end, hanging under it below 1181 px. At 390 px, on a page at the
  top, the disc covers the end of the hero's kicker line ("LESSON 01"); the bottom right corner is
  the other place it could go, at the cost of the toast and of step 5 lighting it with the
  masthead.
- The motion switch's "Pause animations" now stops the tour's glides too, as reduced motion does.
  No other scroll in the kit asks it (the step deck's own scrolls read reduced motion alone), so a
  viewer who paused animations still sees the deck's arrows glide.
- The Contracts of Lessons 9 to 14, not built yet, list what each page stores and do not name
  `fyp-tour`; each page's builder adds it beside `fyp-pos`.
