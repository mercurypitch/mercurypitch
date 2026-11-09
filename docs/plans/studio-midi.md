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

## 4. Where A1 lives

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
