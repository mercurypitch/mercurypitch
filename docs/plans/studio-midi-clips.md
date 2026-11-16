# Studio MIDI clips — new clips, longer clips, and MIDI files

Follows the Studio MIDI series (`docs/plans/studio-midi.md`, A to E), which
stores notes in the song, renders them through the lane's sound and edits
them in the note editor. That series left three gaps:

- **A MIDI clip only comes from recording a keyboard or pads.** There is no
  way to make an empty clip and draw into it, so anyone without a MIDI
  keyboard, which is most phone and tablet users, cannot use the editor.
- **A MIDI clip cannot grow.** Its window stays inside the audio it was
  recorded or rendered as (decision 9 of the series: "lengthening a clip past
  its render comes later").
- **The Studio cannot read or write a MIDI file.** Drum Night and Guitar
  Night read them; the Studio does neither.

## The owner's request (16 November 2026)

> "plan and implement 1 and 2 and 3 too thanks, ping me when all is reviewed
> and merged and ready on dev domain to test"

1. Draw a MIDI clip from scratch.
2. Lengthen a MIDI clip.
3. Import and export `.mid` files in the Studio.

## 1. Decisions

### 1.1 A MIDI clip may run past its audio

This is the one change to the song's rules, and the rest builds on it.

- **The rule.** A MIDI clip's source window ends at or before its
  sequence's end, `studioTicksToFrames(sequence.lengthTicks,
sequence.tempoBpm)`. Its audio may end before its window does. Every frame
  of the window past the audio plays as silence. An audio clip's window stays
  inside its audio, as now.
- **Why.** The notes are the source and the audio a cache of them (decision 7
  of the series). Requiring the cache to cover the window before an edit
  forces a render, or a padded copy of the audio, before every lengthening.
  That either holds up the gesture or stores the song's audio twice. A window
  past the audio is silent only until the render service keeps a render that
  covers it, and a render runs past its sequence's end.
- **Where it bites.** Every reader of a clip's window against its asset must
  take a MIDI clip past its audio, each with a test:
  - `validateClipAsset` checks a MIDI clip against its sequence's end, not
    its asset's;
  - playback and the export read frames past an asset's end as silence;
  - the waveform draws nothing past the audio;
  - the trim gesture's limit (`gesture-draft.ts`) for a MIDI clip;
  - splitting, moving and fading a MIDI clip past its audio.

  `git grep normalizedFrameCount` and `sourceOutFrame` find them.

- **The render service** needs no new rule: lengthening changes
  `lengthTicks`, which is in the render key, so the clip goes stale. It is
  previewed and kept as after a note edit, and a kept render covers the new
  window.

### 1.2 Lengthening a MIDI clip

- **In the lanes.** A MIDI clip's right edge drags past its audio's end. Its
  new end snaps as the timeline snaps.
- **The command.** `trim-tail` past a MIDI clip's sequence end grows the
  sequence to cover it (`studioTicksCovering`). A sequence another clip
  shares is forked first, copy on write, as `set-sequence-notes` does.
  - Shortening leaves the sequence's length as it is. Notes past the window
    stay in the sequence and are not heard (decision 9 of the series).
  - Lengthening is one undo step.
  - A sequence runs at most 30 minutes, unless validation already sets a
    limit.
- **In the note editor.** The clip's end is a handle on the roll's ruler,
  marked End, with a target of 44 px for a finger.
  - The roll shows two bars past the end, dimmed, so the handle has room.
  - Dragging End moves the clip's end, longer or shorter, snapped to the
    editor's grid, as one `trim-tail`.
  - A press past the end draws nothing, as now.

### 1.3 New MIDI clips

- **The builder.** One function makes the edit that adds a MIDI clip on a
  lane: its sequence and its clip, and its lane when the lane is new.
  - Its audio is a short silence, a quarter second, mono, stored as a take is
    (`imports.ts`). By 1.1 the window runs past it.
  - The clip's render key is its sequence's key. An empty sequence renders as
    silence, so nothing renders until a note is drawn.
  - With notes (1.5), the clip arrives stale, and the import keeps its render.
  - The new clip, its sequence and its lane are one undo step.
- **Its length.** Four bars at the song's tempo, four beats a bar as the
  roll's bars are.
  - It starts at the bar under the press, or at the playhead's bar when it
    is made from a menu.
  - It ends where the lane's next clip starts, if that comes first.
  - It is at least one bar. With no room for one bar, nothing is made and the
    status line says why.
- **Where it is made.**
  - **New lane** offers Audio, Piano and Drums. Piano and Drums make a lane
    with that role and an empty clip at the playhead's bar.
  - A phone has no New lane today. The PR finds how a phone adds a lane and
    offers the same three there.
  - **Double-click** with a mouse, or **two taps** with a finger, on an empty
    stretch of a lane makes a clip there. This works on a lane whose role is
    piano, keys, drums or bass, or which already holds a MIDI clip. Other
    lanes behave as now. Two taps use C's `double-tap.ts`.
- **After.** The new clip is selected and its notes open in the editor, in
  Draw.

### 1.4 MIDI files out

- **Where.** The Studio's Export offers "MIDI file (.mid)" beside the audio.
  It is off, with the reason, when the song has no MIDI clip. A MIDI clip's
  Clip details offers Export MIDI for that clip alone.
- **The file.** Standard MIDI File format 1 at 960 PPQ:
  - one tempo event, the song's;
  - a 4/4 time signature;
  - a track for each lane that holds MIDI clips, named after the lane.
- **The notes.** A clip's heard notes are those starting inside its window,
  as the lane's preview draws them.
  - A note running past the window's end is cut there.
  - Each note is placed by the clip's place in the song, through frames,
    since a sequence keeps its own tempo.
- **Channels and velocity.**
  - A drum lane's notes go on channel 10 (index 9), and every other lane's
    on channel 1 (index 0), after a program change to the acoustic grand.
  - Velocity is `round(velocity × 127)`, from 1 to 127.
  - Release velocity is `round(releaseVelocity × 127)`, 64 when absent.
- **The name.** The file is named after the song's title.
- **The writer.** A pure function in `src/lib/studio/midi/`, tested by
  reading its output back with `parseMidiProject`.

### 1.5 MIDI files in

- **Where.** The Studio's import takes `.mid` and `.midi` beside audio: the
  file picker and a drop on the Studio.
- **Reading.** `parseMidiProject` (`src/features/piano-project/`), which is
  strict and bounded. A file it refuses is refused with its reason, as an
  unreadable audio file is.
- **Lanes.** One new lane for each track and channel that holds notes.
  - Channel 10 makes a Drums lane, which plays the kit.
  - Every other channel makes a Piano lane, named after the track's name, or
    after the General MIDI program when the track has no name.
- **Time.** The notes keep their times in seconds through the file's tempo
  map.
  - A sequence's ticks are laid at the song's tempo.
  - A song with no clips yet takes the file's first tempo first, so a file
    with one tempo keeps its beats on the song's bars.
- **Clips.** One clip on each new lane, starting at the song's start, its
  length the file's last note end rounded up to a bar.
- **Notes.**
  - Velocity is `v / 127`, kept to 4 decimals.
  - A note-off velocity is kept as `releaseVelocity`.
  - Each note keeps its channel.
  - Notes the validator refuses, such as two of one pitch overlapping, are
    made valid the way recording does it (`take-notes.ts`).
  - A track over 10,000 notes is left out, and the notice names it.
- **Audio.** Each clip starts as 1.3's does, stale. The import asks the render
  service to keep its renders, and the lanes say "Rendering…" until it has.
- **Undo.** The whole file is one undo step.

### 1.6 Not in this work

- Linked clips, controller and pitch-bend lanes, a tempo map, and looping
  clips.
- Sounds other than the piano and the kit.
- Time signatures other than 4/4. The Studio has none.

## 2. Pull requests

Two pull requests, each one coherent change, built in parallel and merged in
turn on the session's branch.

| PR  | What                                                     | Builds on     |
| --- | -------------------------------------------------------- | ------------- |
| 1   | MIDI clips you draw and lengthen: 1.1, 1.2 and 1.3       | main          |
| 2   | MIDI files in and out: 1.4, then 1.5 with PR 1's builder | PR 1, for 1.5 |

**What each PR shows:**

- unit tests for every command and rule;
- browser specs for every gesture:
  - a mouse, and fingers on a phone and a tablet;
  - each result read back from the saved song;
  - a file read back from its bytes;
- the changes broken on purpose that its tests catch;
- `pnpm check`, `pnpm pr:validate`, `pnpm metrics:check` and the module
  index;
- screenshots at 1440x900 and 390x844.

Each PR adds its own "Where it lives" section below.

### Design decisions made while building PR 1

- **Five minutes, not thirty.** The plan capped a sequence at 30 minutes
  unless validation already set a limit. The Studio keeps no audio longer
  than five minutes (`import-limits.ts`), and a render is cut there
  (`midi-preview-audio.ts`), so a window past five minutes could never be
  heard. A MIDI clip's window ends five minutes into its sequence at the
  most: the validator says so, `trim-tail` refuses past it, and the lane's
  edge and the End handle stop there.
- **Past its audio, a MIDI clip plays no source.** Rather than leave the
  silence to Web Audio's clamp, the arrangement plan ends a MIDI clip's
  segment where its audio ends, edged there (`heardSourceOut`), so Play
  and the export start nothing past it, and a recorded take that stops
  mid-note does not click where its audio does. The song still runs to
  the window's end.
- **A MIDI clip's fades are bounded by its sequence**, as its window is,
  not by its audio. **A MIDI loop take's clip keeps its pass's bounds**:
  its passes are audio it owns, so its end stops at its pass, as an audio
  loop take's does.
- **`trim-tail` carries an optional fork id.** A lengthening that must copy
  a shared sequence without one is refused. Every caller names one for a
  MIDI clip (`studioTrimTail`): the lane's edge, Clip details and the End
  handle. A note edit and a lengthening fork through one step,
  `withOwnSequence`.
- **The builder is pure, and the importer keeps its audio.**
  `studioNewMidiClips(project, clips, assetId, createId)` returns
  `{ command, clipIds }`: one batch, each clip on a lane of the song
  (`{ trackId }`) or a new one (`{ name, role }`), its notes given ids 1, 2,
  3... and only their fields away from defaults. The controller's
  `addMidiClips(clips)` keeps the silence as a take is and commits the
  batch, resolving with the clips' ids.
- **A clip's render key is the key of its silence**: an empty sequence of
  its length on its lane's sound. A clip made empty is then not stale, and
  one made with notes is, so it renders; keeping that render is the
  caller's to ask for.
- **The silence is stored once, with no name.** Identical audio reuses its
  asset, so every new clip plays the same one; a name on it would show on
  every clip. Each new clip shows its lane's name instead, its render is
  kept unnamed too, and Clip details calls it a MIDI clip.
- **A clip that runs into the bar under the press moves the new clip's
  start to its own end**, keeping the new clip's end on the bar line four
  bars on. The plan said nothing of a clip before the press.
- **New lane is three equal choices**, Audio, Piano and Drums, each with
  its instrument's glyph, in a group named New lane: "New audio lane",
  "New piano lane" and "New drums lane". The browser specs that made a
  plain lane with "New lane" press "New audio lane" now. A new Piano or
  Drums lane is called Piano or Drums, then Piano 2 and so on.
- **The same three choices head Add takes, on every device.** A phone
  adds its lanes there, and an empty song on a computer, which has no New
  lane row, finds them there too.
- **The End handle is a slider over the ruler**, so it takes the focus and
  the arrows (a grid step, Shift a bar, each press one commit). Its target
  is 44 px across and as tall as the ruler; on a touch screen it reaches a
  finger's height under the ruler on the dimmed side only, where a press
  draws nothing, so it takes no press from a note. A drag reads the
  pointer through the view it pressed in, and the view follows the handle
  past an edge. The end moves from where the press took the handle, so it
  never jumps to the finger. The end goes no nearer the start than a grid
  line past it.
- **The view keeps to a range, the clip to its window.** The roll's view,
  a pinch, a pan, the wheel and an edge scroll keep to the window and two
  bars past its end (the engine's context gains `view`); what a press
  picks or draws stays the window's. The velocity lane is dimmed past the
  end as the grid is, and the end is a line in the lane's colour. A clip
  shorter than the roll opens with the two bars in view, so the handle has
  its room at once; the note editor's zoom spec opens on them now.
- **A lane gesture is let go when the song changes under it**, a kept
  render included. A song opened with stale MIDI keeps its renders as it
  opens, so a drag begun at once is let go; the browser specs wait for the
  keep. This was so before PR 1.

### Design decisions made while building PR 2

PR 2's first half is 1.4, MIDI files out.

- **A phone saves a clip's file from its clip note.** A phone has no Clip
  details: the series edits clips on a tablet or a computer. The note a phone
  shows for a selected clip already holds its Notes and its Range. For a MIDI
  clip it now holds MIDI too, between them. The three keep together at the
  note's end, and the lane's name gives way first.
- **A clip's file keeps the clip where the song has it.** Its notes are
  placed as they are in the song's file. It lines up with the song's audio
  in another app, and 1.5's import, which starts a clip at the song's start,
  puts it back where it was.
- **A clip's file is named after the song and the clip**:
  `<title> - <take>.mid`, the take as the clip's band names it, so it never
  takes the song's file's name. The song's is `<title>.mid`, by the rule the
  WAV's name follows (`studioDownloadName`).
- **A pitch sounds once at a time on a track.** In most players a note-off
  ends every sounding note of its pitch, and a sequence can hold two
  overlapping notes of one pitch: a recording or an edit can make them.
  - Where they overlap, the earlier note ends where the next starts.
  - Of two starting on one tick, the longer is kept.
  - A note shorter than one of the file's ticks stays a tick long.
- **The file's beats are the song's.** Its ticks count at the song's tempo
  exactly. The tempo event holds it to the nearest microsecond a quarter,
  486,224 for 123.4 bpm, so a note on the song's beat stays on the file's,
  and the time drifts by less than a microsecond a beat.
- **Each track ends where its last clip ends**, past its last note, so a
  clip's rests at its end stay in the file. The first track ends with the
  last of them.
- **The first track names the file's sequence after the song**, as the
  format names a format 1 file's sequence. It carries the tempo and 4/4.
- **Names are UTF-8.** `parseMidiProject` reads a name's bytes as Latin-1, so
  1.5 reads a track's name as UTF-8 when it is valid UTF-8.
- **The lane's sound decides the channel.** A note's own channel is not
  written: the kit plays on channel 10 and the piano on channel 1, as the
  Studio plays them.
- **Mute, solo, gains, pans and fades belong to the mix.** Every lane holding
  a MIDI clip is in the file, and nothing in it changes with the mix.
- **Nothing waits for a render.** The WAV keeps edited MIDI clips' renders
  first. The MIDI file is written from the notes as they stand, at once,
  even while the song plays or a take records.
- **One rule for what a clip plays.** `studioTickInWindow` (`time.ts`) is the
  preview's test and the file's, so the lane and the file cannot disagree.
- **A gap in a file holds 268,435,455 ticks**, four bytes of delta time:
  about 15 hours at 300 bpm. The first track spans the song in one gap, so
  a longer song is refused, and Export says the file could not be made.
- **The take's name moved out of the clip's component.**
  `studioClipTakeName` is now in `timeline/clip-take-name.ts`. Importing it
  from the clip's component put that component's stylesheet ahead of the
  timeline's, and a MIDI clip's tags fell out of its band (MISTAKES.md).
- **Export's MIDI file stands under the WAV, a line apart**, laid out as the
  WAV is: a card, its tracks and tempo, then Export MIDI. Its button is the
  secondary one, and the WAV keeps the primary. When it is off, it says
  "This song has no MIDI clips yet."

## 3. Where PR 1 lives

| File                                                  | What it answers                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/model/midi-window.ts`                 | 1.1: how far a MIDI clip's window runs, to its sequence's end and five minutes in; a trim past it grows the sequence. |
| `src/lib/studio/model/validation-midi.ts`             | 1.1: a MIDI clip's window and fades inside its sequence, five minutes at the most.                                    |
| `src/lib/studio/model/validation-clips.ts`            | 1.1: an audio clip inside its audio; a MIDI clip's window left to its sequence; every clip's passes in its audio.     |
| `src/lib/studio/model/arrangement-plan.ts`            | 1.1: a MIDI clip's segment ends with its audio, edged there, for Play and the export.                                 |
| `src/lib/studio/model/clip-passes.ts`                 | 1.2: the source frames a clip's trims reach, five minutes of a MIDI clip's sequence.                                  |
| `src/lib/studio/model/sequence-commands.ts`           | 1.2: `withOwnSequence`, the copy on write a note edit and a lengthening share.                                        |
| `src/lib/studio/model/commands.ts`                    | 1.2: `trim-tail` with its fork id, its sequence grown first.                                                          |
| `src/features/studio/timeline/gesture-draft.ts`       | 1.2: the lane's edge to five minutes, and `studioTrimTail`, which names a copy for a MIDI clip.                       |
| `src/lib/studio/midi/time.ts`                         | 1.2: the frame a window ends on to end on a tick, and the last tick before a frame.                                   |
| `src/features/studio/notes/roll-end.ts`               | 1.2: the roll's range two bars past the end, where a drag puts the end, and the end in words.                         |
| `src/features/studio/notes/StudioNoteEnd.tsx`         | 1.2: the End handle: a drag, Escape, the arrows, one commit each.                                                     |
| `src/features/studio/notes/StudioNoteRoll.tsx`        | 1.2: the view kept to the range, the window drawn to a drafted end, the view following the handle.                    |
| `src/features/studio/notes/note-roll-frame.ts`        | 1.2: the clip's end as a line, and the velocity lane dimmed past it.                                                  |
| `src/features/studio/notes/edit-viewport.ts`          | 1.2: `noteViewRange`, the ticks the engine's pans and zooms keep to.                                                  |
| `src/lib/studio/model/new-midi-clips.ts`              | 1.3: the builder, where a clip made in a lane goes, and which lanes make one.                                         |
| `src/features/studio/controller/imports.ts`           | 1.3: `addMidiClips`: the quarter second of silence kept as a take is, and the builder's batch committed.              |
| `src/features/studio/controller/edit-history.ts`      | 1.3: Undo's words for new clips: add lane, add lanes, add clip, add clips.                                            |
| `src/features/studio/timeline/StudioNewLane.tsx`      | 1.3: New lane's three choices, and the row under the lanes that holds them.                                           |
| `src/features/studio/StudioSourcePicker.tsx`          | 1.3: the same choices at the head of Add takes.                                                                       |
| `src/features/studio/timeline/StudioTimelineLane.tsx` | 1.3: a double-click or two taps on an empty stretch of a MIDI lane.                                                   |
| `src/features/studio/useStudioNewClips.ts`            | 1.3: a lane or a clip made, selected and opened in the editor in Draw.                                                |
| `src/features/studio/notes/note-editor-state.ts`      | 1.3: the tool the editor opens in.                                                                                    |
| `src/e2e/studio-midi-clips.spec.ts`                   | Every gesture by a mouse and by fingers on a phone and a tablet, each read back from the saved song.                  |

## 4. Where PR 2 lives

| File                                                   | What it answers                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/midi/midi-file.ts`                     | The Standard MIDI File writer: format 1 at 960 PPQ, the first track's name, tempo and 4/4, then a named track a lane on one channel.     |
| `src/lib/studio/midi/song-midi-file.ts`                | A song's MIDI clips, or one clip, as the writer's tracks: the window's notes cut at its end, placed through frames, one pitch at a time. |
| `src/lib/studio/midi/time.ts`                          | PR 2 adds `studioTickInWindow`: whether a note is heard through a clip's window, for the preview and the file.                           |
| `src/features/studio/export/midi-download.ts`          | The song's file or a clip's, written and handed to the browser, named after the song.                                                    |
| `src/features/studio/export/export-download.ts`        | PR 2 adds `studioDownloadName`: a WAV's and a MIDI file's name from the song's title.                                                    |
| `src/features/studio/export/StudioMidiExport.tsx`      | Export's MIDI file under the WAV: its tracks and tempo, Export MIDI, and why it is off.                                                  |
| `src/features/studio/panels/StudioClipDetails.tsx`     | PR 2 adds Export MIDI beside a MIDI clip's Edit notes.                                                                                   |
| `src/features/studio/timeline/StudioPhoneClipNote.tsx` | PR 2 adds a phone's MIDI button for a MIDI clip, between Notes and Range.                                                                |
| `src/features/studio/studio-icons.tsx`                 | PR 2 adds `FileDown`, a page with an arrow into it: a clip's MIDI file.                                                                  |
| `src/features/studio/timeline/clip-take-name.ts`       | A clip's take as its band names it, apart from the clip's component and its stylesheets.                                                 |
| `src/tests/utils/studio-midi-file.fixture.ts`          | A file's bytes read back through `parseMidiProject`, its notes paired one sounding at a time, for the unit tests and the browser's.      |
| `src/e2e/studio-midi-files.spec.ts`                    | The song's file and a clip's downloaded on a computer, a tablet and a phone, read back from their bytes.                                 |
