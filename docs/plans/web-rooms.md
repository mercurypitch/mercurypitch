# The exercise rooms on the web

**Status:** in progress. Seven rooms open from the web's Exercises tab (15 Nov 2026): Long note,
Echo, Lip roll, Ng slides, Home note, Leap and Harmony. The web's eighteen own drills run on one
stage with Merc beside it (15 Nov 2026, "The stage the web's own drills run on"). First note, the
Warm-up and the new drills follow (see "What follows").

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

## The stage the web's own drills run on

The drills that are not rooms share one shell (`src/features/exercises/ExerciseShell.tsx`), so
one change restaged all eighteen of them (`src/features/exercises/stage/`), and a drill written
since stands on the same stage: Read the Note, the nineteenth
(`src/features/exercises/note-reading/`), Name the Cadence, the twentieth
(`src/features/exercises/cadence/`), and Sing It in Time, the twenty-first
(`src/features/exercises/sing-in-time/`). The shell kept every class it
had, so each drill's own styles, the tests and the tours find what they looked for.

- **The booth behind, a sheet of dark glass in front.** The shell's root is a dark stage in either
  app theme (`mp-dark-stage`): the pitch tracker's canvas was always dark, and a light card around
  it was the odd one out. The backdrop is cut from the Jam room's singer painting
  (`public/jam/room-singer.webp`), softened and dimmed, so the sheet needs no backdrop blur.
- **One Merc beside the sheet, for the whole visit** (`stage/StageCoach.tsx`). His bubble holds the
  drill's brief (its `idlePlaceholder`) until a run starts and the run's instruction (its
  `activePhase`) while it lasts; both used to sit inside the card. He listens to a run and cheers
  one graded S or A (`stage/stage-pose.ts`). He stands above the sheet on a phone and in a rail
  beside it from 1440px, where he costs the sheet no height.
- **The mic.** Start is a pill with a microphone on it. On a phone it holds to the sheet's foot,
  so a tall setup or a result never puts it a scroll away.
- **The result.** The grade in a ring of its own ink and the score as one large number, over the
  drill's own summary line.
- **The take notice** (15 Nov 2026). Whether to keep a run's voice take is no longer a block in the
  result card, with Keep Take and Discard over Try Again. It is a notice that pops out of Merc's
  bubble, with Merc beside it as an iOS banner has its app's icon beside it
  (`stage/TakeNotice.tsx`, its words by state in `stage/take-notice.ts`, the keep in
  `stage/useTakeNotice.ts`). It lies over the bubble, out of the flow, so the sheet does not move
  when it comes or goes and it covers no control. It asks ("Keep this take?", Keep, a close that
  discards), says it is keeping, then "Take kept", which leaves by itself after 4 s, or offers a
  retry when keeping failed; it says all of that in one place, so a keep raises no toast. "Hear it
  first" has the bubble while it plays. A take that was never recorded is not a notice: the card
  says so in one quiet line at its foot.

- **Hear it first.** Under Start, a drill can offer one example of what it asks for
  (`ExerciseShell`'s `demo`): Merc takes his singing pose, his bubble says what it is ("Listen: E3,
  then B3. That is a Perfect 5th."), and the example gives way to a run the moment one starts. The
  line lies over the brief inside the bubble, which keeps the brief's size, so the sheet does not
  move while an example plays, and it stays up for at least two seconds, since some examples are
  over sooner than their line can be read. Fourteen drills have one. Twelve play a row of notes
  (`stage/note-demo.ts`): Interval Trainer, Scale Runner, Long Note, Pitch Hold, Arpeggio Jumper,
  Chord Stacker, Staccato Precision, Drone Intonation, Siren, Slide, Dynamic Swell and Call &
  Response. An example says what it is and what it is not: Slide and Siren play the two notes a
  voice glides between, and Dynamic Swell plays the note alone, since the app's instrument holds one
  loudness. Name the Cadence plays a perfect cadence in C (`cadence/cadence-demo.ts`) on the figure
  its setup screen shows, a round's three tiles: each lights as its chord sounds, and the ending's
  two say what they are once it has been heard. Sing It in Time plays the tune on its sheet in time
  with the click, the staff's cursor moving with it. Chord Stacker plays the first chord of the set
  its setup has chosen, and Drone Intonation, in its Pure tuning, the pure interval over the drone.
  cursor moving with it.
- **The answer after a miss.** In Interval Trainer a round with a missed note is answered before
  the next: the pair plays once more under its name ("That was B3, a Perfect 5th above E3.
  Listen."). Read the Note and Name the Cadence do the same in their own way.

Not yet, and drill by drill from here: an answer after a miss for the other drills; Merc's own
sung voice for the examples (they sound in the app's instrument); one figure per drill that is
itself the feedback; and one line of words per note. Six microphone drills have no example, each
for its own reason: Mirror the Melody and Sight-Singing play or show their melody as the run
itself, Pitch Pursuit is a chase with no fixed note, Routine Runner is a row of other drills and
Guided Warmup a row of its own steps, and Vibrato's words are the coach's to write.

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
2. Season 2's drills are on the stage (the vocal booth, a glass sheet holding the drill's one
   figure, Merc beside it): note reading as Read the Note, cadence types as Name the Cadence and
   sight-singing in time as Sing It in Time (`docs/plans/find-your-pitch/SEASON-2.md` § 5.2 items
   9, 19 and 11). The harmony line is the Harmony room, which differs from the lesson plan's drill
   in three ways (the same plan, § 7 item 14).
3. The web's eighteen old drills, now on the stage above. Where a room covers the same skill it
   takes the drill's place on the tab (Long Note, Call and Response, the Warm-up). The others get
   Merc's example, the answer after a miss and a figure of their own, Interval Trainer first.
4. Season 2's modes (`SEASON-2.md` § 5.2 items 10, 12, 15, 18, 19, 20), and the lessons' practice
   cards re-pointed as each lands.
