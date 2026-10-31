# The Ear Lab's native look: the mock-ups, built into the room

Status: approved by the owner, 30 Oct 2026 ("stunning", "make sure they look
the same"). Phase 1 in progress.

The reference is the mock-up page,
[Ear Lab Native Rooms](https://claude.ai/artifact/UyQuWVUVYnKrq9FEjaiDeJ):
twenty phones at 390 by 844, every basic drill looping its listen, answer and
reveal beats, then the shared parts and the build notes. Its CSS and drawing
code are the source for every value below; read the page with the Artifact
tool rather than guessing from a screenshot.

## What changes, and what does not

The native drill room (`merc/MercDrillRoom.tsx`, behind `EAR_LAB_WITH_MERC`)
trades its brass, parchment and paintings for the native app's language: the
dark stage, glass chips and buttons, Merc's violet, blue and cyan, teal for
the answer and red for a miss. Each instrument is redrawn as lit glass that
fills most of the screen and moves with the sound.

Nothing else moves:

- **The drills' logic.** Every drill keeps composing `PlayPad`, `Pads`,
  `StagePad`, `TapPad` and its instrument with the props it passes today.
- **The web.** The bench (`BenchStage`) and its instruments keep their look.
  The new parts live in the room's lazy chunk (`merc/`), which only a build
  with the Ear Lab with Merc loads.
- **The rules.** The eye never sees the answer before the reveal; a state is
  never colour alone (a check or a cross, and "Your pick" or "The answer");
  nothing under 13 px; no target under 44; reduced motion draws stills.

## The seam

The room already swaps the console's parts: `ROOM_SKIN` (`merc/skin.tsx`)
reaches the drills through `StageSkinContext`, and Hairline asks the skin for
its loupe (`skin?.VernierLoupe ?? VernierLoupe`). The instruments follow the
same road:

1. `StageSkin` gains `instruments?: Partial<InstrumentSkin>`, one entry per
   instrument, each typed by the web instrument's own props.
2. Each instrument module wraps its export once,
   `export const BeatPendulums = skinnable('BeatPendulums', WebBeatPendulums)`,
   so a drill that renders `<BeatPendulums …/>` gets the room's version under
   the room and the web's everywhere else. No drill file changes.
3. The room registers its lit instruments in `merc/lit/`, one file each.

The context moves to a module of its own if importing it from the
instruments would close an import cycle (`pnpm metrics:check` counts them).

## Phases

Each numbered item is one PR, merged before the next starts, each with
screenshots of the drills it touches at 390 by 844, beside the mock-up's
frames for the same beats.

### Phase 1: the room's skin (the brass comes off every drill)

1. **Tokens.** The `.room` block in `merc/room.module.css`: stage ink, the
   glass recipe from `mobile-kit.css`, lit violet `#9a87f0`, the filled
   violet `#7c4dff`, teal `#2ee6c9` and red `#ff6a5c`, Inter for every word.
   Each station gets a lit pair (`a`, `b`) as each premium room has its
   `--mic-lit`: Resolution violet and blue, Time cyan and blue, Colour orchid
   and violet, Shape blue and cyan, Function lavender and orchid, Wild cyan
   and violet.
2. **The shell.** The painting and its lamp crop go; the stage is the dark
   ground with the station's glow and grows to most of the screen. Close and
   "?" take the shell's glass round buttons; the drill and its run sit beside
   them. Merc and his bubble stand at the foot of the stage.
3. **The run chip** (`RunLine.tsx`): the room kit's violet chip, centred under
   the bar: a staircase's level, about how many are left and its sparkline; a
   rated run's rounds as dots; a calibration's track.
4. **Merc's bubble:** the kit's glass bubble in Inter 500, its aside in lit
   violet, its hint in grey.
5. **Pads and keys** (`skin.tsx`, `room.module.css`), the same `data-look`
   states in new paint: resting, waiting (a violet edge that breathes),
   pressed, your pick right, the answer (dashed teal), your pick wrong,
   stepped back, and none to ask. The shapes: two up, a row, three by two,
   four by three, the degree keys whose tops rise with the scale, Gravity's
   octave, and one full-width tap pad.
6. **The lead pads and the pinned row:** filled violet for the one main
   action and glass outline for the rest; Hear it again and Compare in the
   rooms' glass pill, the run's words to their right.
7. **The sheets** (help, End the run, before you start, the sound stopped):
   the same words on the dark glass sheet.

### Phase 2: the instruments, a station at a time

The first PR adds the seam and the lit kit (`merc/lit/kit.ts`): the two-stroke
glow, the orb and lens gradients, the pulse ring, the label halo `CrestNote`
already uses, and the room kit's `frame-loop.ts` for anything drawn while it
sounds, idle otherwise. Then one PR per station:

| Station    | Drill     | Today's instrument       | Lit instrument                                                                          |
| ---------- | --------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Resolution | Hairline  | `RoomLoupe`              | A lens over two level hairlines, the cents rail beside it, the tones as pulses of light |
| Resolution | Beat Hunt | `BeatPendulums`          | Two strings of light; the beating one swells and fades at the reveal                    |
| Time       | The Grid  | `EscapementLattice`      | Six glass rods; the off click slides out of line at the reveal                          |
| Time       | Drift     | `MetronomeColumn`        | A pendulum over eleven beads; the last six move and the tempo line bends                |
| Time       | Pulse     | `RhythmDrum`             | Blank paper, beat lamps and a sweep; the call is written over the taps at the reveal    |
| Time       | The Chart | `RhythmDrum` (score)     | The bar written from the start, each note lit as the sweep passes                       |
| Time       | Subdivide | `MetreLattice`           | Hits on three lanes with no bar lines; the reveal drops them in and groups the bar      |
| Colour     | Colour    | `MixingDesk`             | Six channel strips; the reveal raises an EQ bell over the boosted band                  |
| Colour     | Stack     | `GearTrain`              | Four ghost discs; the reveal settles the real tones on a semitone rule                  |
| Colour     | Cadence   | `ProgressionTrain`       | Four chord orbs that strum in turn; the reveal lifts them to their roots                |
| Colour     | Bassline  | `BeadChain`              | Roots over the held tonic's glow, dropped onto a seven-rung ladder at the reveal        |
| Shape      | Span      | `BeadChain`              | Beads with their heights hidden, dropped onto Do to Do′ at the reveal                   |
| Shape      | Echo      | `BeadChain`              | Cadence lamps, then the phrase; the reveal rings the slips in red                       |
| Shape      | Contour   | `StylusTrace`            | A pen draws the first tone and waits; the reveal draws the second                       |
| Shape      | Leap      | `IndexArc`               | A twelve-semitone arc whose needle hunts until the reveal sweeps it home                |
| Function   | Home      | `TuningFork`             | Cadence lamps, the note out of a glass orb, the scale beside it lit at the reveal       |
| Function   | Gravity   | `TuningFork` (chromatic) | The same over the twelve; a miss lets the note fall home to Do                          |
| Function   | The Pull  | `PullBeam`               | A beam of light with a pan for each note; the reveal tips it                            |

The other drills that draw one of these instruments (Critique and Weight on
the desk, the Wild drills on the bead chain, the progression train and the
fork) take the lit version with it, and their screenshots go in the same PR.

The bead chain landed with Colour (Bassline's ladder of roots), so Span and
Echo took the lit ladder there too, Echo with its cadence lamps. Time,
Colour, Shape and Function went in one PR after Resolution's, a commit each.

Every reveal is drawn whole within about a second: the room holds a reveal
1.5 s by default and 1 s at the least, against the mock-ups' longer beats,
so a name or a fall that came in at two seconds would never be seen.

A station's PR also brings its drills' pads to the mock-ups where the room's
skin left them. The Time PR did it for every station: each pad but the big
pair stands with its words centred, The Grid's four in one row, Drift's with
its three icons, and Pulse's and The Chart's tap pad stays on at the reveal
as the verdict, teal or red.

### Phase 3: the Field Book and the plate

1. **The Field Book** (`FieldBookPage.tsx`, `FieldBookView.tsx`,
   `FieldBookCard.tsx`): the song's timeline as it is read (the phases and
   percent, landings, phrases, root motions), the key settling into the chip,
   the three drills as glass tiles; Wild keeps the glasshouse, at night.
2. **The plate** (`MercPlate.tsx`, `plate.module.css`, `Glass.tsx`): the
   number counted up from the last while its trace draws; a rated run's round
   dots and "Where it slipped" with Practise; the sealed face raising the
   mercury from the old mark to the new. A staircase's slips are read off its
   trace, each step back up a miss.

As built, both in one PR:

- The plate stands on the stage without a card, the kicker at the left and
  the run's badge at the right. A practice run's staircase draws on a log
  scale, each turn and miss lit as the line reaches it, while the number
  counts along it and then settles on the reading. Its misses are the
  verdicts the trace now keeps (`TracePoint.correct`), "7 misses, none above
  10.4 ¢" on a pill. Its glass gives way to the staircase, as the mock-up
  draws it: the bench keeps the glass and its practice line.
- A rated run's dots fill in order while the number moves from the rating
  the run found, its move written beside it once they have. Practise is
  offered under the slip that happened most, as the mock-up has it.
- A seal counts from the old mark as the mercury rises, and draws its three
  tracks from the calibration's own trace, each named with its reading. It
  ends on Done, with what the Index counts under it.
- The Field Book is the Wild's room, the glasshouse at night faint behind it.
  Its key sits on the chip, its drills are glass tiles with a chevron, dashed
  while there is nothing to ask, and the page is the song's timeline:
  landings, phrases and root motions by time, counted, over its minutes. The
  mock-up's line of the voice is left out: drawn from the book it would show
  each phrase's shape and each landing's height before the drills ask them.

### Phase 4: the device pass

iPhone SE to Pro Max and a small Android, reduced motion, VoiceOver and
TalkBack, and the short-phone media query the rooms already carry.

Begun with phase 3's PR. At 375 by 667 and 360 by 640 an instrument ran
under Merc's row and the console: neither the stage nor the instrument's
figure had a track of its own size, so the instrument's `max-height: 100%`
resolved to nothing. Both have one now. The instrument scales down to the
stage and the plate scrolls inside it, and under 700 px the plate's number
and staircase are smaller. Still to do: the devices themselves, VoiceOver
and TalkBack.

A design review against the mock-ups (30 Oct) found these, now fixed:

- **The reveal no longer moves the instrument.** The instrument stands at
  the top of the stage, as the mock-ups place it, and Merc's bubble grows
  into the room under it. Where a phone leaves no room under it, a tall
  verdict still makes the instrument smaller by up to a tenth, which only
  a smaller instrument at rest would avoid: the owner's call.
- **Hairline's reveal is the mock-up's.**
  - The higher line runs across the whole glass, named under it: "The
    second, higher".
  - The rail reads 50 cents either way, labelled at its ends, its marks
    glowing pills.
  - The lens magnifies that rail by what it says, so a 12.5 cent gap reads
    x4 where the mock-up wrote x8.
- **Nothing under the plan's floors.** "Your pick" and "The answer" are
  13 px on every pad. Span's and Echo's eight keys stand edge to edge, 44
  px or more on a 360 phone.
- **The phrase strip:**
  - "Take one back" is a room control on a small glass pill, not the web's
    link.
  - The strip never grows when it comes.
  - Bassline's strip says "Your roots".
- **The plate:**
  - The sealed glass's scale is the room's grey and Inter.
  - A staircase stops short of its scale's values.
  - A miss's dot is crossed as well as red.
  - The plate fades at the stage's edge while more lies below.
- **Small fixes:**
  - Compare has its icon and lit edge.
  - Hear it again's arrow turns clockwise.
  - The tap pad's word and its line stand together.
  - Contour says "That was the same."

And the review's minor items (31 Oct):

- Merc asks the question whenever an answer is due, the first one too, and
  his ears ripple beside him while a question plays.
- The run chip hugs its words until the staircase has a line to draw, and
  a level that stays says so: "Gap holds at 50.0¢".
- The Field Book's Echo and Bassline tiles have icons of their own (a
  phrase, roots in steps), and the rule under its heading stays once read.
- The Chart's stems are sturdier; Color's bell rises from the line at the
  lane's ends, and "EQ" stands under the line, clear of it.
- The practice plate's main button stands over one row: Calibrate, Run
  again and Done.

Answering by voice (31 Oct), brought forward from "Left for later":

- Home, Echo, Span and the Wild Echo, answered by singing, take the room
  kit's mic in place of the keys. It is still while the question plays
  ("Listen first"), lit with rings that move with the voice in the answer
  window ("Your turn"), and an outline once the window closes ("Closed").
  A press on the lit mic closes the answer, as Done does.
- The choice of Tap or Sing or play is asked on the station's sheet, before
  the run (the owner's call, below). It used to ride on the idle console,
  which a station row's run never draws: the run starts as the room opens,
  before the room's chunk has loaded. So on the phone it was never offered.
- Echo, Span and the Wild Echo remember the choice, as Home always has, and
  a row's run starts in it.

On a tablet (31 Oct, the owner's Galaxy Tab S9+, about 1280 by 800 on its
side): the phone's layouts stretched. The bench's hero, drawn in shares of
the tab's width, lost Merc and his line below its cap, and its glass grew a
thumb thick; two answer pads were 600 px wide each; First note stood Merc
taller than the room. Now:

- The bench is a column of 560 px in the middle of the screen. Its hero and
  glass are drawn to the column, and the painting fades into the night at
  its sides.
- The drill room's lower half (Merc's line, the console, the pinned row)
  and its sheets keep a 600 px column under the instrument. So do the
  station sheet and the day's close.
- First note sizes Merc by the room's shorter side: its width upright, its
  height on its side.
- The Ear rooms' Level and Songs sheets, the setup before a run, keep a
  640 px column in the middle of a wide screen, as every sheet in the app now
  does (the shared mobile `Sheet`).

## How each PR is checked

- The repo's checks: `pnpm check`, the native app's `check`, `pnpm arch`,
  `pnpm pr:validate`, `pnpm metrics:check`, and the Ear Lab's tests.
- The room's tests keep their hooks (`data-look`, `data-merc`, the test ids),
  so they test behaviour, not paint. A new test pins that the room's tokens
  carry no brass, parchment or serif.
- Screenshots in Chromium of the native shell at 390 by 844, each drill at
  its listen, answer and reveal beats, beside the mock-up's frames.
- The web bench's screenshots before and after are the same.

## The bench, in the same light (31 Oct)

The Ear Lab tab, the station sheet and the day's close, drawn from the
owner-approved mock-ups,
[Ear Lab Native Bench](https://claude.ai/artifact/3AtwJJfqhUqE49e4BRssXw):

- **The Regulator Room at night**, as the Wild keeps its glasshouse: the
  painting greyed and laid under the room's indigo in CSS (no new art), the
  lamp's light the kit's pale violet, Merc in his own light, his line in the
  room's glass bubble.
- **The Mercury Index as the sealed plate draws it**: the kicker and its
  Sealed badge, the number in 700 with its move from the seal before (teal
  when it rose), the bench's words under it, the same glass and a lit-edge
  Calibrate. Before a seal, the bench's own headline stands in the number's
  place.
- **Glass cards**: Today with the plate's rings (the next violet, the done
  teal and ticked) and the violet Start; the Ear rooms tiles, each in its
  room's light; the Ear Path's orbs; the Ear Report.
- **Each station in its own two lights**, the ones its drill room is lit by,
  on its tile and on its sheet's icon (`room-look.test.ts` checks they
  match).
- **The station sheet is the room's sheet**: grabber, round close, glass rows
  with lit start discs, the Answer by switch in violet, a row to be sung on a
  violet mic.
- **The day's close**: Merc celebrating in his light, the moves ticked
  teal, the orb lit today haloed, the reminder switch, and the Ear Report as
  the one filled button. Done stays under it, quiet, for the thumb on a tall
  phone; the mock-up closes on the X alone.
- The bench's two stylesheets join the room's in the look test: no brass,
  parchment or serif.

## Decided after the review (owner, 31 Oct)

- **Tap or sing is asked on the station's sheet, before the run**, not
  under "?" mid-run. Where a station has drills that can be sung (Function:
  Home and Gravity, which share Home's choice; Shape: Echo and Span; the
  Wild: Echo in the Wild), its sheet asks "Answer by: Tap, Sing or play",
  says which drills take the voice, and the rows to be sung start on a mic.
  The choice is remembered per drill (`merc/answer-choice.ts`). The sheet
  keeps its brass until the bench is redrawn; "?" no longer offers it.
- **Subdivide shows the eye no more than the ear hears.** The bar's length
  names the metre: the room's lanes drew the two bars' whole row at the
  answer beat, and the web's lattice drew one pallet a step before the
  sound. Now the room's hits land at a "now" line and pass left, fading,
  like tape, with the lanes empty before the sound and while the answer is
  due; the web's lattice stands at seven pallets whatever the metre, its
  lamp running on round them across both bars. Both lay the bar out at the
  reveal.
- **The meaning line under a threshold plate's number stays out**, as the
  mock-ups have it.
- **The reveal's step down on a phone with no room to spare** is decided on
  the devices, in the device pass: a smaller instrument at rest is the
  only cure.
