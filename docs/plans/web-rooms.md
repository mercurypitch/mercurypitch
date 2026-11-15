# The exercise rooms on the web

**Status:** in progress. Seven rooms open from the web's Exercises tab (15 Nov 2026): Long note,
Echo, Lip roll, Ng slides, Home note, Leap and Harmony. First note and the Warm-up follow. The web's
own drills, old and new, move onto the same kit after them (see "What follows").

**The owner's decision of 15 Nov 2026**, after the web drills' mock-ups ("Web drills: Season 2
mock-ups", a design canvas of six boards).

- Decided: the stage in the mock-ups is the web's look for its drills, and the build order under
  "What follows" stands.
- Decided: Merc and his voice come to the web. In the owner's words, "let's make the web exercises
  high quality like native, no need to save things for native only, native only has its own selling
  point beyond the exercises".
- So the rooms open on the web too, free, as the web's drills are. This takes the place of two
  earlier decisions in `docs/plans/ear-rooms.md`: "The web keeps its own interface" (29 Oct 2026)
  and "none goes to the web version yet" (3 Nov 2026). The native app's own gates are unchanged:
  its rooms still ride `PREMIUM_EXERCISES`, and a store build still carries none.

## What a room is, and why it needed almost nothing

A room is one page over a world of its own, with Merc in it: `src/features/long-note`, `echo`,
`lip-roll`, `ng-slides`, `home-note`, `leap` and `harmony`, each built on `src/components/room-kit`
and `src/components/demo-kit`. They were written for the native shell, but they are plain web code
in the shared tree: no native plugin, their art and Merc's lines beside them, a landscape painting
for the three Ear rooms. Without the native device a room makes its own audio context and takes the
microphone from `micManager` (`src/components/room-kit/useExerciseCapture.ts`).

The native shell gives a room three things, and the web now gives the same three
(`src/features/exercises/rooms/WebRoomHost.tsx`):

1. **The whole window**, on the dark stage whatever the app's theme (`src/styles/dark-stage.css`).
   The host is portalled to the body and sits over the app's header and tab bar. It sets the two
   lengths a room pads its world by, `--pushed-top` and `--pushed-bottom`.
2. **A bar over the art**: Back, the room's name, and a slot on the right. The room kit draws the
   level pill and "?" into whatever element is registered as that slot
   (`registerPushedBarEnd`, `src/stores/native-shell-store.ts`), so the host registers its own.
3. **A way out**: Back, Escape, and the room's own Done. The focus goes to the room's name on the
   way in and back to the room's card on the way out.

## Where they are on the web

- **The Exercises tab** lists them above the drills, under "Sing with Merc"
  (`rooms/RoomsStrip.tsx`): a picture cut from the room itself, and the name, the line and the best
  the native picker's card shows, from the same catalogue
  (`src/features/premium-exercises/catalogue.ts`).
- **A room's id is an exercise type**, so the tab holds it as its selected exercise and the page
  draws the host for it (`src/pages/ExercisesPage.tsx`). Nothing else in the app had to learn of
  rooms.
- **A lesson's link** can open one: a slug whose exercise is a room. `/exercises/harmony-line`
  opens Harmony, for Lessons 26 and 28.

## What keeps them out of a store build

The native app renders the web's App under its shell, so the Exercises page and its menu are in the
native bundle too. The web's way in is behind a constant of its own, `WEB_ROOMS`
(`src/lib/native-build.ts`), true in the web build alone, and both files reach the rooms only as
`WEB_ROOMS ? lazy(() => import(...)) : null`. In a native build the constant folds to false and the
import goes with the branch. `rooms/web-rooms-fold.test.ts` holds the sources to that shape on
every run, since the PR gate builds no store bundle; `apps/mercurypitch/scripts/assert-bundle.mjs`
asks the bundle itself when one is made.

A room's code, its art and Merc's renderer load when its card is pressed. The service worker
precaches the rooms' scripts and styles with the rest of the build's (about 600 KB over seven
rooms and the kit); their paintings and Merc's lines are not precached.

## Not on the web yet

- **First note.** Its songs are the native Karaoke's, and its stems and theatre art ship from
  `apps/mercurypitch/native-only`.
- **The Warm-up.** It opens the other rooms as its stops, through a helper that lives in the native
  shell (`apps/mercurypitch/src/shell/warm-up-stop.ts`); the web needs the same, shared.
- **The Ear Lab with Merc.** The web's Ear Lab keeps its bench for now
  (`docs/plans/ear-lab-native-look.md`).
- **The browser's own Back.** It leaves the tab, as it does from a drill. A room is a whole screen,
  so Back should close it; that goes through the app's hash router and is its own change.
- **A layout for a wide window.** The Ear rooms, Long note and Lip roll fill a desktop window
  already; Echo and Ng slides sit as a column in its middle. The mock-ups' desktop board (a rail
  beside the stage, a cents readout, keyboard shortcuts) is still to build.

## What follows

1. First note and the Warm-up on the web.
2. The four drills Season 2 still lacks, as rooms on the mock-ups' stage (the vocal booth, a glass
   sheet holding the drill's one figure, Merc beside it): sight-singing in time, note reading, and
   cadence types; the harmony line is the Harmony room, which differs from the lesson plan's drill
   in three ways (`docs/plans/find-your-pitch/SEASON-2.md` § 7 item 14).
3. The web's eighteen old drills. Where a room covers the same skill it takes the drill's place on
   the tab (Long Note, Call and Response, the Warm-up). The others move onto the kit, Interval
   Trainer first.
4. Season 2's modes (`SEASON-2.md` § 5.2 items 10, 12, 15, 18, 19, 20), and the lessons' practice
   cards re-pointed as each lands.
