# Studio MIDI — data, rendering and the note editor

Owner-approved plan, 9 November 2026: MIDI moves into the song document, a
MIDI clip plays audio rendered from its notes, and a note editor opens on a
MIDI clip, for the piano and then for the drum kit. Five pull requests, A to
E; A, the foundation, ships in two parts and changes nothing on screen.

## Owner's decisions (9 November 2026)

The owner approved this plan and its mockups
(https://claude.ai/artifact/YLZ2pjYiNo2jddpwP8xcR5) on 9 November, with these
decisions:

- **Compatibility does not matter.** The Studio is unreleased, so MIDI
  belongs in the song if that is the right design. In the owner's words:
  "make sure to use proper store of the notes, edits etc… we didnt release
  studio at all yet, so i dont care about compatibility… make it future proof
  so that adding new midi abstractions or expanding it doesnt need complete
  refactor".
- **Build for what comes later.** New MIDI abstractions (controllers, pitch
  bend, linked clips, expression, sound banks, tempo maps) must not need a
  rewrite. Model it on how REAPER, FL Studio, Ableton and Bitwig/DAWproject
  do it (section 3).
- **Drag notes on touch.** On tablets and phones, a note is tapped, then
  dragged up, down, left and right.
- **Ship it.** Build it all, merge it, and tell the owner when it can be
  tested on dev.

## 1. Decisions

1. **Content apart from placement.**
   - MIDI content is a `StudioSequence` in `project.sequences`.
   - Placement is a `StudioClip` on a lane that names it: `clip.midi.sequenceId`.
   - Several clips may share one sequence: split halves, loop passes,
     duplicates and pastes. This is the pooled source of REAPER, the pattern
     of FL Studio and the content reference of DAWproject.
2. **Editing shared content makes it the clip's own first** (copy on write).
   - **The rule.** If other clips share the edited clip's sequence, the edit
     gives the clip a copy with a new id, inside the same command.
   - **What a user sees.** Duplicates, pastes and split halves behave as
     independent: editing one never changes another. That matches REAPER,
     where a split never pools, and Ableton's copies. Storage is shared until
     the first edit.
   - **Linked editing comes later.** FL Studio's patterns, REAPER's pooled
     MIDI and DAWproject's `reference` can become a `clip.midi.linked` flag:
     edits then go to the shared sequence, and "Make unique" copies it. The
     model already holds shared sequences.
   - **Orphaned sequences are dropped by the command that orphans them.**
     After every command, sequences no clip names are removed. Sequences live
     inside the song, so undo brings them back with the clip.
3. **Musical time.**
   - Notes are in ticks at 960 PPQ (REAPER's default), counted from the
     sequence's start. Tick 0 is frame 0 of its rendered audio.
   - Each sequence keeps the tempo its ticks were laid on (`tempoBpm`). A later
     change of the song's tempo does not move MIDI that is already placed, just
     as audio stays put.
   - A tempo map, with clips in beat time, is a later migration.
   - **Conversions:**
     - recording: `tick = round(frames / 48000 * bpm / 60 * 960)`;
     - render and editor: `frames = ticks / 960 * 60 / bpm * 48000`.
   - A clip's window in ticks comes from `sourceInFrame` and `sourceOutFrame`
     through the sequence's tempo.
4. **A note.** `{ id, pitch, startTick, lengthTicks, velocity, releaseVelocity?, channel? }`.
   - `id` is an integer, unique within its sequence and never reused; the
     sequence's `nextNoteId` hands out the next one. This is Ableton's
     `note_id`; REAPER and FL Studio address notes by index, which shifts as
     notes are sorted.
     - Selection, undo and future per-note expression attach to the id.
     - A copied sequence keeps its notes' ids. An import creates ids.
   - **Velocity is normalized, 0 to 1** (a float kept to 4 decimals, greater
     than 0), as in DAWproject and FL Studio. The port already gives 0..1, so
     MIDI 2.0's 16-bit velocity fits later. The UI shows `round(v × 127)`.
   - Ranges:
     - pitch 0–127;
     - startTick an integer ≥ 0;
     - lengthTicks an integer ≥ 1;
     - releaseVelocity 0–1 (absent means 0.5);
     - channel 0–15 (absent means 0).
   - Fields that hold their default are left out.
5. **Room to grow, without guessing.**
   - Optional fields are validated when present, and the validator stays
     strict: it refuses unknown fields. A song is either understood fully or
     refused, never half-read.
   - **Every addition** bumps `STUDIO_SCHEMA_VERSION` and adds a pure,
     ordered step to `migrations.ts`, with a fixture and a test for each
     version. Additions named by the research (each with its source in
     section 3):
     - controller lanes, `sequence.lanes: [{ id, target, points: [{ tick, value, interp: 'hold'|'linear' }] }]`,
       with targets named after DAWproject's ExpressionType values:
       channelController, pitchBend, channelPressure, polyPressure,
       programChange;
     - per-note `expressions` timed from the note's start, so they move and
       stretch with the note;
     - `muted`, `probability`, and `cents` for micro-pitch, which suits sung
       pitch;
     - a lane's `sound` (bank id, bank hash, preset);
     - a tempo map with a meter, plus MIDI clips placed in ticks (per-clip
       timebase, as REAPER does).
   - **Migration on read:** old songs are migrated as they are read, from
     storage, from backups and from copies. Before a stored song is migrated
     for the first time, its original record is kept in
     `studioProjectSnapshots` (by project id and old version), so a bad
     migration can be recovered.
   - **Refusal of newer songs:** a build refuses a song from a newer version,
     in plain words ("This song was saved by a newer MercuryPitch. Update the
     app to open it."). DAWproject requires its version, and Ableton refuses
     Sets it cannot overwrite.
   - All tick and frame arithmetic lives in one module
     (`src/lib/studio/midi/time.ts`), so the tempo map changes one place.
6. **Where it lives.**
   - Sequences live in the song document, as MIDI lives in every DAW's
     project file. They are validated and saved with it, and covered by
     undo/redo, backups and song copies.
   - Audio (takes and renders) stays in asset storage, as now.
   - The device-only `studioTakeNotes` store from #1402 goes away: Dexie v16
     deletes the table, and its service, its tests and its writes go too.
7. **The render cache.**
   - **What plays.** A MIDI clip plays audio rendered from its sequence
     (`clip.assetId`).
   - **The key.** `clip.midi.renderKey` names what that audio was rendered
     from: a stable hash of the notes, `ppq`, `tempoBpm`, `lengthTicks`, the
     lane's sound kind (`piano` or `drums`) and `MIDI_RENDER_VERSION`.
   - **A stale key means "render me".** Audio recorded live counts as the
     first render: its key is the key of its notes.
   - **When rendering happens:**
     - While the note editor is open, renders are ephemeral: in memory,
       debounced about 250 ms, and played through a hook on
       `readCanonicalAsset` and a preview snapshot. The transport then plays
       the edited notes through the lane's real chain.
     - A render is persisted as an asset when the editor closes, when a song
       opens, before export or freeze, and after an undo or redo that lands on
       a stale clip (debounced about 1 s). Persisting swaps every clip on that
       sequence with a stale key to the new audio, without a history entry
       (`amendStudioPresent`).
   - **Engines:**
     - The drum kit renders through its existing `offline` mode.
     - The piano renders through the router: the sampled grand when it loads
       within a timeout, else the synth. Offline renders lift the
       instruments' live voice caps.
   - **The asset.** The render goes through the same import path as a take
     (`studioTakeImport`-like), with provenance `recording`.
   - **Freeze semantics,** as in REAPER and Ableton: MIDI is the source of
     truth, and its audio is derived and replaceable.
8. **One undo history.**
   - Each finished gesture is one undo step (drag: draft, then one commit).
   - The editor's Undo and Redo are the Studio's.
   - Undo restores the notes together with the audio that matched them.
9. **The editor edits only inside the clip's window.**
   - Notes outside the window stay in the sequence but are not heard. The
     editor dims them, as in the mockup.
   - Lengthening a clip past its render comes later.

## 2. Pull requests

Each passes `pnpm check`, `pr:validate`, `metrics:check` (800 lines,
complexity 15), both typechecks, vitest, the index check, the first-paint
budgets and a local e2e run. New UI loads lazily.

- **A. Foundation**, in two parts.
  - **A1, the model** (`feat/studio-midi-model`):
    - schema v2 with `sequences` and `clip.midi`, migrations, and
      validation;
    - `time.ts` (tick/frame conversion) and `render-key.ts`;
    - commands: `add-sequence`, and `set-sequence-notes` with its fork id.
      `split`, `duplicate`, `paste`, `move` and passes carry `midi`;
    - history: `amendStudioPresent`;
    - unreferenced sequences are pruned at song open and after every
      command;
    - recording: a kept MIDI take adds its sequence and its clip in one
      batch. `studioTakeNotes` is removed (Dexie v16).
  - **A2, the note core** (`feat/studio-midi-notes`):
    - pure note operations: add, move (dTick, dPitch), resize, delete,
      velocity, transpose, quantize, duplicate, and copy/paste;
    - bounds, and selection helpers;
    - roll geometry and hit tests, adapted from `transcription-roll.ts` to
      ticks, which moves to `src/lib/` and serves the Lab too.
- **B. Rendering.**
  - The offline sequence renderer, with drums and piano.
  - The render service: stale detection, debouncing, persisting and amending.
  - The ephemeral render cache, with the `readCanonicalAsset` hook and the
    preview snapshot API for the editor.
  - Export and freeze wait for pending renders.
- **C. The glass lane preview and opening the editor.**
  - Notes drawn behind the waveform in the clip's canvas, never as one DOM
    node per note, and with no animation loop.
  - The glass body of a MIDI clip, a `MIDI · PIANO` / `MIDI · KIT` chip, and
    drum rows.
  - Double-click, or a hand-made double-tap on touch, opens the editor.
    Clip details gets an "Edit notes" button, and the keyboard gets a way in.
  - On a phone, a MIDI clip opens its editor even though other clip editing
    is for tablets and computers.
  - Moved here from D, so the notes can be seen before they can be edited:
    the editor's drawer and full screen, and a read-only roll with the keys,
    the ruler, the velocity lane and the playhead, drawn by a function D
    feeds its gestures through.
- **D. The note editor, piano.**
  - **Where it opens:** a drawer under the lanes, like the mix desk, that can
    be resized and expanded. On a phone it is full screen.
  - **What it draws:** a canvas with the roll, the keys, the velocity lane and
    the ruler.
  - **Tools:** Select and Draw.
  - **Gestures**, the same on touch as with a mouse:
    - tap or click selects;
    - dragging moves a note on both axes;
    - a resize handle on the right edge;
    - a marquee with a mouse;
    - a drag in Draw sets the new note's length;
    - dragging in the velocity lane sets velocity.
  - **Scrolling on touch:** one finger on empty grid pans; two fingers pan;
    a pinch zooms.
  - **Edits:** snap, quantize, transpose, duplicate, delete, and copy/paste.
  - **Keys:** arrows, Shift for an octave, Delete, Ctrl/Cmd+D, A, C and V,
    and Escape.
  - **Sound:** every touched note plays through the lane's instrument. The
    playhead follows the transport, and Play plays the preview renders.
- **E. The drum editor.**
  - Named GM rows; hits; tapping in Draw toggles a hit; dragging moves it
    between rows and steps; velocity.

### Design decisions made while building A1

- **A paste carries a copy of its clip's sequence.** The clipboard keeps the
  sequence as it was copied. A paste shares the song's sequence while the
  song holds it unchanged, and otherwise brings the copy in under a new id:
  a clip deleted after its copy took its sequence with it, and notes edited
  since the copy are not the notes copied.
- **Note ids start at 1.** An empty sequence's `nextNoteId` is 1, and a note
  new to a sequence must take an id the sequence has never handed out
  (`set-sequence-notes` refuses one below the old `nextNoteId`).
- **Defaults written out are refused.** `releaseVelocity: 0.5` and
  `channel: 0` are refused, not read as their defaults, so one song has one
  spelling and its render key one input.
- **The render key hashes what changes the sound.** Each note's pitch, start,
  length, velocities and channel, with left-out defaults filled in, sorted by
  start, pitch and then id; ids order ties but are not hashed. The key is 16
  hex digits: two 32-bit multiply-xorshift lanes over the canonical text.
- **A MIDI lane's take always plays a sequence**, an empty one when no note
  was played, so a clip recorded on a MIDI lane is a MIDI clip. A lane
  armed on a microphone after its MIDI arm drops the MIDI arm's note log, so
  its take is plain audio.
- **A recorded sequence covers its whole take.** `lengthTicks` is the fewest
  ticks whose render holds the stored audio's frames, so a render of it is
  never shorter than the take its clip windows.
- **Release velocity is not recorded yet.** Most keyboards send a note-off
  velocity of 0, which would fill songs with a value that is not a release
  velocity; the field waits for a keyboard that sends one on purpose.
- **A song's kept records go with it.** Deleting a song deletes its
  `studioProjectSnapshots` rows.

### Design decisions made while building A2

- **An edit returns the selection after it**, beside the new sequence: an
  added, duplicated or pasted note is selected in place of the notes it came
  from, a deleted one leaves none, and every other edit keeps its selection.
- **A selection moves as a group.** A move or a transpose that would take
  one selected note out of the clip's window or off the keyboard stops the
  whole selection at that edge, so a chord or a run keeps its shape.
- **Quantize snaps starts, to a grid with an offset.** The song's bars need
  not fall on the sequence's tick 0 (a take's first sample is its count-in),
  so the grid's lines can sit on any tick; lengths are left as they are.
- **A full sequence takes no more notes.** An add, a duplicate or a paste
  that would pass 10,000 notes returns null, for the editor to say so.
- **The roll picks only what the clip plays.** A note starting outside the
  clip's window is drawn dimmed and never picked, and the roll's zoom and
  pan stay inside the window, a zoom closing in to a sixteenth note.

### Design decisions made while building C

C took the editor's host and a read-only roll from D, so the owner can open
a clip and see its notes before the editing lands. D adds its gestures,
tools and keys on top without changing what C draws with.

- **The roll is one drawing function over one input.** The input already
  carries a selection, a gesture's drafts (a draft with a stored note's id
  stands in for it, which fades to a ghost), a marquee, the hovered note and
  edge, and the playhead, and the header keeps a place for the tools
  (`data-studio-note-tools`). It draws in two layers: the base when the
  notes, the view, the size or the theme change, and the overlay (hover,
  drafts, marquee, playhead) on its own canvas, so a drag or a playing song
  redraws only the overlay.
- **Mix and the note editor take turns under the lanes.** Both are drawers
  in one place, and two at once would leave no lane in view on a laptop.
  Opening the notes closes the desk; Mix and X close the notes. A panel that
  covers the lanes closes too; one beside them stays.
- **E opens the notes**, of the clip with the focus, or else of the
  selected clip. The app's keys are M, V, R, P, Space and Home; the
  Studio's S, M, X, Z, =, -, Delete, the arrows and the Ctrl chords. While
  the focus is in the editor, =, - and Z zoom the roll instead of the lanes.
- **Two taps are counted by hand**: a second tap on the same clip within
  300 ms and 24 px, from the clicks of a finger or a pen. A mouse opens the
  notes on dblclick, and a dblclick that follows two taps is ignored, so
  two taps open once. An audio clip's double-click still opens its details.
- **A phone opens a MIDI clip's notes** although it edits no other clip:
  by two taps, or the Notes button that replaces "Edit clips on a tablet or
  computer." in the clip's note. The editor fills the screen above the
  transport, the song's bar stepping aside, until Done.
- **The lane draws the notes in the clip's own canvas**, over its waveform
  faded to 30 %. What a clip draws is worked out once per sequence, window
  and sound and kept until the sequence changes (at most eight windows a
  sequence, so a trim's steps do not pile up); a redraw finds its first
  note by a binary search and shares a few fills among all its bars. The
  playhead never redraws a clip.
- **Brightness is velocity.** In a lane, five strengths from 0.6 to 1; in
  the roll, 0.55 + 0.45 × velocity, as the mockup has it. A note starting
  outside the window draws at 0.22.
- **A piano clip's rows fit its pitches** with a semitone of air, seven rows
  at the fewest; a drum clip draws a row per part of the kit it plays
  (cymbals and hi-hats, other percussion and toms, snares and claps, kicks).
- **The roll's rows keep a readable height**: 12 to 26 px with a mouse, 18
  to 34 px on a touch screen, scrolling by whole rows when more are wanted.
  A kit's rows are the usual kit (crash, ride, the two hi-hats, two toms,
  snare and kick) and every key played, cymbals on top, named as General
  MIDI names them; a key outside General MIDI gets a row below the kick.
- **The bars are the song's.** Bar and beat lines come from the song's
  tempo over the sequence's ticks (`studioSongBeats`, in `time.ts` with the
  rest of the tick arithmetic), four beats to a bar as the Studio's ruler
  counts. A later change of the song's tempo moves the lines and leaves the
  notes. A view that starts inside a bar names that bar and beat, as 1.3.
- **The roll's colours are the Studio's tokens.** They are custom
  properties on the editor, built from the Studio's tokens and the lane's
  colour; a canvas cannot read `var()`, so each is read through a probe's
  computed colour when the theme or the lane's colour changes.
- **The drawer opens at 56 % of the arrangement**, between 220 and 560 px,
  and leaves the ruler and one lane in view at its tallest. A height chosen
  on its top edge is kept on the device; Expand is not, so the editor always
  opens as a drawer.
- **The editor loads on its first open.** The roll, its drawing and the
  General MIDI names load with `import()`. Every page's first paint is
  main's, byte for byte but for the build's id: the editor names its notes
  itself (`notes/note-names.ts`), because two exports of `lib/note-utils`,
  a chunk the rooms load before their first paint, grew it by 49 bytes
  when the editor first used them.
- **The focus follows the editor**: into it on open, back to the clip on
  close, unless it went somewhere on purpose. Escape closes it only while
  the focus is inside it.
- **A selected MIDI clip says how to open it**, "Double-click to edit
  notes" or "Tap twice to edit notes", for four seconds, as the mockup's
  tooltip does.
- **C's rows sit beside D's engine's.** D's engine merged first, with
  `roll-rows.ts` panning and zooming a piano's rows in fractions of a
  semitone. C's read-only roll counts whole rows, a kit's included, in
  `roll-keyboard.ts`, under names of its own (`scrollStudioRollRows`,
  `studioRollShownRows`), with the engine's `StudioRollRowLimits` for its
  row heights. Wiring the engine in, D2 chooses which of the two moves the
  rows.

### Design decisions made while building D's engine

The engine (`src/features/studio/notes/edit-*.ts`) is pure: an input and
its context in, a state and its effects out. Its scripts are the tests.

- **A press on a note acts at once.** No long press: a finger on a note
  drags it, with the selection when it was selected and alone when it was
  not, and a tap selects it alone. This is the owner's ask after trying the
  mockups.
- **Resizing is the grip's.** A selected note shows a grip on its right
  end, inside a note 24 px wide or more and beside a shorter one. Its zone
  is 20 px wide for a finger, so a short note's body always moves it. A
  finger resizes only a selected note; a mouse also resizes any note from
  its last 6 px.
- **A finger reaches 12 px.** It picks the note under it, else the nearest
  one within reach, so a note a few pixels tall is still a target. A tap
  or a drag is told apart by the Studio ruler's slop: 4 px, and 10 px for a
  finger.
- **A drag snaps where the note lands.** The pressed note stays put for
  half a grid step, so a drag up or down keeps the time it was played at,
  then its start goes to the nearest line; the rest of the selection moves
  by as much and keeps its offsets. Alt places freely.
- **The rows move too.** roll.ts fits the rows once; `roll-rows.ts` pans
  and zooms them in fractions of a semitone, between notes 0 and 127. One
  finger on empty grid pans both ways in Select, and draws in Draw; the
  wheel scrolls rows and Shift with it time.
- **A pinch zooms each axis by the fingers' spread along it**, about the
  point between them: sideways for time, up and down for rows. An axis the
  fingers are not spread along keeps its zoom, and a row stays from 14 to
  48 px, so a pinch at a slight angle cannot make notes too thin to touch.
- **A second finger takes over.** It undoes the first finger's drag and
  the two pinch; a cancel undoes too. A mouse or a pen ignores other
  pointers while down, so a palm cannot undo a pen's drag.
- **A drag held at an edge scrolls**, toward the side it went, on each
  animation frame the host sends while the engine wants them.
- **One commit a gesture or a key press.** A held Delete or Ctrl+D acts
  once. Undo and redo stay the Studio's. (D2 made a held arrow one commit
  too: see D2's decisions.)
- **A duplicate or a paste must land inside the clip.** One whose notes
  would start past the clip's end is refused with a reason to announce.
  A paste goes to the playhead over the clip, else after the selection,
  else to the clip's start.
- **Drawn notes take the velocity of the last note pressed**, 100 of 127
  until one is, so a note added to a soft take sounds like its neighbours.

### Design decisions made while building D2

D2 makes the editor edit: D's engine drives a piano's roll (C's), each
edit is one `set-sequence-notes` (A's), and a draft is heard through the
render service (B2's).

- **A piano's rows are the engine's.** The piano roll pans and zooms its
  rows in fractions of a semitone (`roll-rows.ts`) and draws every row it
  shows in part (`rowSpan`). A kit keeps C's whole rows
  (`roll-keyboard.ts`) for the drum editor. The engine takes a piano's
  pointers and wheel (`note-roll-pointers.ts`); a kit's keep C's
  navigation, and the zoom buttons and keys zoom both.
- **One model, converted in one place.** The engine's marquee and grips
  come back in the grid's pixels and become the canvas's in `edit-host.ts`.
  The velocity lane's geometry (`velocity-lane.ts`) is read by its drawing
  and its picking alike, so a lollipop is taken where it is drawn.
- **A pointer counts from the surface it pressed**, the grid or the
  velocity lane, and keeps counting from it while captured. A lost capture
  cancels, and a blur or a hidden page lets everything go, undone. A finger
  the roll no longer captures is cancelled before the next press, so a
  finger the browser forgot cannot turn the next press into a pinch.
- **A held arrow drafts, and commits once when let go.** Its repeats move
  a draft, and the release keeps the whole move as one undo step. A press,
  a command or another key commits it first; Escape and a lost focus put
  the notes back.
- **Each commit is one `set-sequence-notes`** with a fork id of its own,
  so a sequence another clip shares is copied for this one, in one undo
  step. A refused commit says "This edit could not be applied. The notes
  are unchanged."
- **B switches between Draw and Select.** V is voice control's key across
  the app (`useVoiceToggleKey`), so B does both ways.
- **The engine's state lives with the open editor; the clipboard with the
  editor's state**, so notes copied in one opening paste in the next, in
  the same clip or another.
- **While the song cannot be edited, the editor edits nothing.** Its tools
  say why, and a gesture under way is let go.
- **A touch screen opens a piano on rows of 24 px, a mouse on the notes
  fitted.** A drawer resized or filled out keeps its rows' height and its
  top row.
- **A note sounds through its lane's instrument**, on the Studio's clock.
  A press makes or resumes the clock inside the gesture, so a note sounds
  before the song was ever played. A note holds 0.28 s, and the one before
  it stops as it starts.
- **A draft goes to the render service as its notes change, and null once
  its commit is dispatched**, so the committed notes keep the draft's
  render. However the editor closes, the service hears of it and keeps the
  renders. The header says "Rendering…" once a render takes a moment, and
  "Couldn't render" when one failed.
- **A phone's toolbar** has the tools on a row of their own under the
  names, and the selection's edits in a bar over the status line, in a
  thumb's reach, each target 44 px.
- **A MIDI lane's header says what it plays**, MIDI · Piano or MIDI · Kit,
  rather than where its render's file came from.

### Design decisions made while building B

The render service (B2):

- **A clip is stale when its key no longer names its notes on its lane's
  sound** (`clip-keys.ts`). What a lane plays MIDI as moved to
  `src/lib/studio/midi/lane-sound.ts`, so an arm, a render, a key and a
  command read it in one place. A lane renamed or given a drum instrument
  makes its MIDI clips stale, as a move to a drum lane does.
- **Keys are hashed once per content, not once per object.** Every command
  and every undo hands back a whole new song, because validation clones it,
  sequences included. Keys are cached per sequence object (a WeakMap), and a
  new object that holds the same notes as the last one seen under its id
  takes that one's keys after a plain comparison of fields. The last object
  per id is held weakly. An edit elsewhere in a song with a 10,000-note
  sequence hashes nothing again.
- **A draft is hashed once it rests.** `preview()` may come with every
  pointer move; its key is computed only when no draft has come for a
  quarter second, and the render starts then.
- **`set-midi-render` swaps only stale clips.** It names an asset and a
  key. A clip whose audio already matches its notes keeps it, so a take
  recorded live is never replaced by a render of the same notes. A clip
  whose notes changed while the render ran keeps its audio, and an
  amendment that changes nothing keeps no asset. The validator refuses a
  render shorter than a clip's window or passes.
- **A preview is prepared as the asset it becomes.** The same loudness gain
  a take of those samples gets (`sourcePreparation`), a hashed float32
  canonical copy, and the id `midi-render-<key>`, so keeping it changes
  nothing heard. The transport's graph holds buffers by asset id, so an id
  is never used again for other audio. A preview holds its bytes and each
  read gets a Blob of them; the encoder hands them over so the hash reads
  them in place.
- **The transport follows the song by object, not by revision.** A preview
  landing changes the transport's song without an edit. A run cannot
  replan onto audio it does not hold, so it hands over to a run built with
  the preview, on the same frame, about a build after the render.
- **A render is kept the way a take is kept.** A 16-bit WAV goes through
  the importer's preparation with `recording` provenance and its storage
  choice, takes its turn with imports (one preparation runs at a time), but
  shows no import notice and does not hold editing. Identical audio reuses
  its asset. The asset keeps its clip's name, so the clip keeps its label.
- **A song opening keeps what it was left stale with,** not an edit made a
  moment later, which waits for its own moment.
- **A render is cut at the Studio's longest take,** five minutes. A take
  can be that long, and keeping a render with its tail past it would be
  refused; the cut is past every clip's window.
- **Failure.** A key is tried at most twice a session (the page's), the
  second time only when a keep asks for it or when a clip wants the key
  again after letting it go. The lane says, for example, "Keys still plays
  its earlier audio: Studio couldn't render the new notes. Studio couldn't
  start the drum kit for this render." A refusal by the memory budget is a
  failure like any other.
- **An export keeps first.** It waits for the keeps before it takes the
  song, says "Rendering edited MIDI clips first…", and takes the revision
  the keeps leave. Cancel works while it waits.
- **The lane freezer leaves a waiting lane alone.** A lane whose MIDI clip
  waits for its render to be kept is not rendered ahead until it is kept,
  and the Sound panel says how many lanes wait.

## 3. How the big DAWs do it (research, 9 Nov 2026)

|                       | REAPER                                        | FL Studio                                | Ableton Live                    | DAWproject (Bitwig, Studio One)                  |
| --------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Content and placement | An item over a MIDI source                    | Patterns, placed by pattern clips        | The clip holds its notes        | A Clip contains or references a content timeline |
| Sharing               | Pooled MIDI, opt-in; a split never pools      | Clips share their pattern; "Make unique" | Copies are independent          | `reference` makes linked clips                   |
| Time base             | Ticks, default 960 PPQ                        | Ticks, default 96 PPQ per project        | Float beats                     | Beats or seconds per timeline                    |
| Note identity         | By index                                      | By index                                 | `note_id`                       | None (ids are created on import)                 |
| Velocity              | 0–127                                         | 0–1                                      | 0–127                           | 0–1                                              |
| Controllers           | A raw event stream                            | Event data and automation clips          | One envelope per controller     | `Points` with an ExpressionType target           |
| Storage               | In the project file (`.RPP`); audio outside   | In the `.flp`; samples outside           | In the Set; samples referenced  | `project.xml` in a ZIP, with a version           |
| Render                | Freeze replaces with audio; unfreeze restores | Consolidate to audio                     | Freeze writes a sample per clip | —                                                |

What this design takes from them:

- **Ticks at 960 PPQ.** REAPER's default. FL Studio's 96 is too coarse, and
  lowering PPQ later moves notes.
- **Content apart from placement, with sharing.** REAPER's pools, FL Studio's
  patterns and DAWproject's `reference`.
- **Stable note ids.** Ableton's `note_id`.
- **Normalized velocity.** DAWproject and FL Studio, with MIDI 2.0 in view.
- **Controllers as lanes of points named by ExpressionType.** DAWproject's
  shape, so a DAWproject export maps across almost directly.
- **MIDI inside the project document, audio outside.** All four.
- **Versioned documents that refuse newer versions.** DAWproject and Ableton.
- **The render as a replaceable cache of MIDI that stays the source.**
  REAPER's and Ableton's freeze.

Not taken:

- **Raw event streams** (REAPER): a wire format, awkward to edit as JSON.
- **Keeping unknown fields:** this codebase's strict validator refuses them,
  and versioning covers growth.

Sources:

- REAPER User Guide 7.85: https://dlx.reaper.fm/userguide/html/
- ReaScript API: https://www.reaper.fm/sdk/reascript/reascripthelp.html
- FL Studio manual:
  - piano roll: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll.htm
  - playlist: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist.htm
  - piano roll scripting: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_scripting_api.htm
- Live Object Model, Clip: https://docs.cycling74.com/apiref/lom/clip/
- Ableton manual:
  - MPE editing: https://www.ableton.com/en/live-manual/12/editing-mpe/
  - managing files and Sets: https://www.ableton.com/en/live-manual/12/managing-files-and-sets/
- DAWproject: https://github.com/bitwig/dawproject (Project.xsd, Reference.html)
- MIDI 2.0 UMP specification: https://amei.or.jp/midistandardcommittee/MIDI2.0/MIDI2.0-DOCS/M2-104-UM_v1-0_UMP_and_MIDI_2-0_Protocol_Specification.pdf

Unconfirmed from primary sources: REAPER's exact `.RPP` MIDI event layout, and
whether Ableton or Bitwig link clips natively. Nothing in this design depends
on either.

## 4. Where A lives

| File                                        | What it answers                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/model/types.ts`             | `StudioSequence`, `StudioNote`, `StudioClipMidi`, `project.sequences`, `clip.midi`, `STUDIO_PPQ`, and `STUDIO_SCHEMA_VERSION` 2.                                       |
| `src/lib/studio/model/migrations.ts`        | One pure step per version, run by every read; a newer song refused as `StudioNewerSongError`.                                                                          |
| `src/lib/studio/model/validation-midi.ts`   | Sequences, notes and `clip.midi`, every field and range; at most 10,000 notes a sequence.                                                                              |
| `src/lib/studio/model/sequences.ts`         | Finding a sequence, the clips on it, whether two hold the same notes, and pruning the ones no clip names.                                                              |
| `src/lib/studio/model/sequence-commands.ts` | `add-sequence` and `set-sequence-notes`, copy on write.                                                                                                                |
| `src/lib/studio/model/history.ts`           | `amendStudioPresent`: the present changed without an undo step.                                                                                                        |
| `src/lib/studio/midi/time.ts`               | Every tick and frame conversion, a sequence's length for its audio, and a clip's window in ticks.                                                                      |
| `src/lib/studio/midi/render-key.ts`         | `studioMidiRenderKey` and `MIDI_RENDER_VERSION`.                                                                                                                       |
| `src/lib/studio/record/take-notes.ts`       | A MIDI lane's note log, and a take's notes and sequence in ticks.                                                                                                      |
| `src/features/studio/controller/imports.ts` | A MIDI take's sequence added in the edit that adds its clip, with its render key.                                                                                      |
| `src/db/services/studio-service.ts`         | Reads migrate; a stored song's record kept in `studioProjectSnapshots` before its first migration, and deleted with the song; a newer song refused as `newer-version`. |
| `src/db/adapters/dexie-adapter.ts`          | Version 16: `studioProjectSnapshots` added, `studioTakeNotes` deleted.                                                                                                 |
| `src/lib/studio/midi/notes.ts`              | A2: the note edits over a sequence and a selection of ids, the selection helpers, and the velocity rule.                                                               |
| `src/lib/studio/midi/roll.ts`               | A2: the note editor's roll in ticks over a clip's window: its viewport, zoom, pan, hit test and the point under a pointer.                                             |
| `src/lib/roll-geometry.ts`                  | A2: a piano roll's geometry in the caller's time unit, moved from the Lab's `transcription-roll.ts`, which the Lab's bench now draws with in seconds.                  |

## 5. Where C lives

| File                                                     | What it answers                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/midi/preview.ts`                         | What a MIDI clip draws in its lane: its window's notes by start on rows of its height, kept per sequence.             |
| `src/features/studio/timeline/clip-notes.ts`             | The lane's notes drawn in the clip's canvas, over its waveform faded back.                                            |
| `src/features/studio/timeline/double-tap.ts`             | Two taps on one clip within 300 ms and 24 px.                                                                         |
| `src/features/studio/timeline/StudioMidiClip.module.css` | A MIDI clip's glass body, chip, count, editing mark and hint.                                                         |
| `src/lib/studio/midi/time.ts`                            | C adds `studioSongBeats`: the song's beats over a clip's sequence, for the roll's bars.                               |
| `src/lib/studio/midi/drum-rows.ts`                       | A drum editor's rows: the usual kit and every key played, named as General MIDI names them.                           |
| `src/lib/studio/midi/roll-keyboard.ts`                   | The roll's rows, piano or kit, kept between a least and a most height, and a scroll by whole rows.                    |
| `src/features/studio/notes/note-editor-state.ts`         | Which clip's notes are open, expanded or not, the drawer's height; closes when its clip or song goes.                 |
| `src/features/studio/notes/note-editor-keys.ts`          | E on the focused or selected MIDI clip.                                                                               |
| `src/features/studio/notes/useStudioNoteEditor.ts`       | The workspace's note editor: opening from every way in, and Mix giving way.                                           |
| `src/features/studio/notes/StudioNoteEditorHost.tsx`     | Where the editor mounts, loaded with `import()` on its first open.                                                    |
| `src/features/studio/notes/StudioNoteEditor.tsx`         | The drawer or full-screen editor: header, tools slot, resize, expand, Done, Escape, focus.                            |
| `src/features/studio/notes/StudioNoteRoll.tsx`           | The roll's canvases, its view, the playhead following the clock, and the wheel, a finger and a pinch.                 |
| `src/features/studio/notes/note-roll-draw.ts`            | The roll drawn from one input: notes, selection, drafts, marquee, hover and playhead, in a base and an overlay layer. |
| `src/features/studio/notes/note-roll-geometry.ts`        | The draw's input, where each part of the roll sits on the canvas, and where a tick, a row and a grid line fall.       |
| `src/features/studio/notes/note-roll-frame.ts`           | The roll around its notes: rows, grid, keys or kit names, the bar ruler and the velocity lane.                        |
| `src/features/studio/notes/note-roll-theme.ts`           | The roll's colours read from the editor's stylesheet.                                                                 |
| `src/features/studio/notes/roll-navigation.ts`           | The wheel, a trackpad, one finger and a pinch over the roll.                                                          |
| `src/features/studio/notes/note-editor-words.ts`         | The roll's text alternative and the status line.                                                                      |
| `src/features/studio/notes/note-names.ts`                | A pitch as the editor names it, kept out of the rooms' first paint.                                                   |

## 6. Where D's engine lives

| File                                                         | What it answers                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/studio/midi/roll-rows.ts`                           | The roll's rows panned and zoomed between notes 0 and 127, the pitch under a point, and the window's notes cached. |
| `src/features/studio/notes/edit-engine.ts`                   | `stepNoteEditor` and `createNoteEditState`: one input and its context in, a state and its effects out.             |
| `src/features/studio/notes/edit-view.ts`                     | `noteEditView`: the notes, selection, grips, marquee, hover, readout and cursor to draw.                           |
| `src/features/studio/notes/edit-pointer.ts`                  | Presses, drags, taps, a second finger's pinch, cancels, edge scrolling and hover.                                  |
| `src/features/studio/notes/edit-press.ts`, `edit-drag.ts`    | What a press starts, by tool, pointer and what is under it, and what a drag drafts.                                |
| `src/features/studio/notes/edit-pick.ts`, `edit-velocity.ts` | The note, grip or lollipop a press takes, sized for a finger, and velocity in 127 steps.                           |
| `src/features/studio/notes/edit-snap.ts`, `edit-viewport.ts` | The grid in ticks, and how fingers, the wheel and edges move the roll.                                             |
| `src/features/studio/notes/edit-commands.ts`, `edit-keys.ts` | The toolbar's edits and the keys that call them.                                                                   |

## 7. Where B lives

| File                                                    | What it answers                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/features/studio/midi/render/render-studio-midi.ts` | B1: a sequence rendered offline through its lane's own sound, as the audio its clip plays.                |
| `src/lib/studio/midi/clip-keys.ts`                      | B2: which MIDI clips are stale, and each sequence's key, hashed once per content.                         |
| `src/lib/studio/midi/lane-sound.ts`                     | B2: what a lane plays MIDI as: the kit or the piano.                                                      |
| `src/lib/studio/model/midi-render-commands.ts`          | B2: `set-midi-render`: a kept render swapped into the stale clips with its key.                           |
| `src/features/studio/controller/edit-commits.ts`        | B2: commit, amend, undo and redo; undo and redo counted.                                                  |
| `src/features/studio/controller/imports.ts`             | B2: `addRender`: a render kept as a take is, in the imports' turn.                                        |
| `src/features/studio/midi/midi-render-service.ts`       | B2: previews, debouncing, aborting, keeping, failures and the transport's snapshot.                       |
| `src/features/studio/midi/midi-preview-audio.ts`        | B2: a render held in memory as an asset the transport plays.                                              |
| `src/features/studio/midi/midi-preview-snapshot.ts`     | B2: the song as the transport plays it, stale clips on their previews.                                    |
| `src/features/studio/midi/midi-render-editor.ts`        | B2: the note editor's API: `preview`, `editorClosed`, `renderState`, and its context.                     |
| `src/features/studio/midi/useStudioMidiRenders.ts`      | B2: the service on the open song: the transport's song and reader, the export's wait, the notice, a hook. |

## 8. Where D2 lives

| File                                                | What it answers                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/features/studio/notes/edit-host.ts`            | The browser's events as the engine's inputs, and its view, drafts and commits as the roll and the song take them. |
| `src/features/studio/notes/useStudioNoteEditing.ts` | The open editor's engine: each input's context, the effects carried out, its frames and its drafts heard.         |
| `src/features/studio/notes/note-roll-pointers.ts`   | A piano roll's pointers and wheel to the engine: capture, the surface each counts from, fingers forgotten.        |
| `src/features/studio/notes/StudioNoteTools.tsx`     | The toolbar: Select and Draw, snap, quantize, transpose, duplicate, delete and velocity.                          |
| `src/features/studio/notes/note-audition.ts`        | A note sounded through its lane's instrument on the Studio's clock.                                               |
| `src/features/studio/notes/velocity-lane.ts`        | Where a lollipop stands, for the lane's drawing and its picking.                                                  |
| `src/features/studio/notes/edit-hold.ts`            | A held arrow: its repeats drafted, one commit when let go.                                                        |
| `src/e2e/studio-note-editing.spec.ts`               | Fingers on a phone and a tablet, a mouse and the keys on a computer, each edit read back from the saved song.     |
