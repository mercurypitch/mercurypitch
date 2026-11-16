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
