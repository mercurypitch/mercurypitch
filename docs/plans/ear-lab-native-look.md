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

### Phase 4: the device pass

iPhone SE to Pro Max and a small Android, reduced motion, VoiceOver and
TalkBack, and the short-phone media query the rooms already carry.

## How each PR is checked

- The repo's checks: `pnpm check`, the native app's `check`, `pnpm arch`,
  `pnpm pr:validate`, `pnpm metrics:check`, and the Ear Lab's tests.
- The room's tests keep their hooks (`data-look`, `data-merc`, the test ids),
  so they test behaviour, not paint. A new test pins that the room's tokens
  carry no brass, parchment or serif.
- Screenshots in Chromium of the native shell at 390 by 844, each drill at
  its listen, answer and reveal beats, beside the mock-up's frames.
- The web bench's screenshots before and after are the same.

## Left for later

- **The bench** (`MercBench`, `bench.module.css`) and the station sheet are
  brass too. The same tokens apply; it is a piece of work of its own.
- **Answering by voice:** Home, Echo and Span answered by singing take the
  room kit's mic disc in place of the keys (the mock-up's shared parts).
