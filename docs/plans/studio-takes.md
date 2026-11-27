# Studio takes: record over a clip, keep every take, pick one

Plan of 21 November 2026 for the next release. A take recorded over a clip
becomes another take of that clip instead of landing on a new lane. T and
Shift+T step through the takes, the clip's right-click menu lists them, a
"2/3" badge says which one plays, a lane opens out to show every take as a
row, and Crop keeps the one you chose. Loop recording already keeps one pass
per loop; its passes become takes in all of these.

**The saved-song format in section 3.2 was approved by maff, 27 Nov 2026.**

The owner asked for this in his words: "The feature to overdub recording,
not push it to new lane when it was over existing take, we should simply
have similar as reaper, you can go into circles and record N takes on same
spot, and then circle through them somehow.. right clicking maybe or
whatever, and easily see all (expand them features, or show then by pushing
other lines down and then user selects ,and when satisifed can drop the rest
and use the selected take. Basically whatever reaper has, it has a good
system so try to use that."

## 1. What REAPER does

Sources: _Up and Running: A REAPER User Guide v 7.86_ (reaper.fm, the
current guide on 21 November 2026), cited by section. One point the guide
does not cover is taken from Sound On Sound's "Takes & Items" article
(soundonsound.com/techniques/takes-items) and marked as such.

1. **Recording over an item makes takes.** The guide puts the choice on the
   Options menu, not in Preferences: "Options menu command New recording that
   overlaps with existing media, i.e. Split existing items and add takes
   (default) and Trim existing items (tape mode). A third option is to Add
   lanes (layer new lanes)" (3.23). REAPER 7 calls the menu "Overlapping
   recording behavior" and adds "Add lanes (all lanes play) or Add media
   items in layers" (3.17). Multiple takes come from "Set Options,
   Overlapping recording behavior to Split existing items and add takes",
   then "Rewind to the start then record your next take" (3.19). Punch-in is
   no exception: "By default, punch recording is not destructive: it creates
   a new take, but does not destroy the original" (3.16).
2. **What a take covers.** Every take plays over its item's span: "the Takes
   cannot extend beyond the boundaries of the Item", and "Adjusting the
   boundaries of the Item, either through fades, splitting or looping,
   affects all Takes within the Item" (Sound On Sound). Users describe the
   default as one that "auto-splits at the beginning and end of your new
   recording". A take shorter than its item leaves an empty stretch, drawn
   when "Display empty takes" is on (3.20, 8.6).
3. **Loop recording makes one take per pass.** With Repeat on over a time
   selection, "new material will be recorded within the time selection ...
   for each pass over the loop until you press Stop" (3.35). Preferences,
   Audio, Loop/Lane Recording decides when passes reach the project, "On
   stop (recommended ...)" or "At each loop", and can "Discard incomplete
   first or last takes if at least one full loop was recorded", with a
   threshold of 90 % of the loop by default (22.6.7, 3.35).
4. **The active take.** One take plays. The item's label says which: "It
   begins with the text Take 3/3" (3.19). "Next take (T): Makes next take
   the active take for all selected media items" and "Previous take (Shift
   T)" (8.7, also 3.22).
5. **Show all takes in lanes.** "Options, Show all takes (when room)", Ctrl+L,
   draws every take as a lane inside its track, so you can see "which take
   is currently selected" (3.20). To use another, "simply click on it to
   select it" (3.16). Sound On Sound: in lanes "you can select the loop you
   want by clicking with the mouse"; otherwise takes are picked from the
   right-click menu.
6. **Keep one, or spread them out.** The Take menu (8.7):
   - "Crop to active take (Alt Shift T): Removes all non-active takes from
     currently selected media items."
   - "Delete active take (X)".
   - "Explode all takes to new tracks: Copies each take to a new track." The
     original "with its three takes is still intact" (8.2), so it is usually
     muted afterwards.
   - "Explode all takes in place", where all play at once, and "Explode all
     takes (in order)".
7. **REAPER 7's fixed item lanes and comping.** A track can hold up to 256
   fixed lanes, each a recording, with comp lanes above them: "Use left drag
   to define areas to be comped", and "the material is comped into new
   items. Your original items are not modified in any way" (8.12, 8.12.3).
   Old takes convert to lanes with "Fixed item lanes (convert takes to
   lanes)" (8.12.7). Studio already comps a loop take's passes by dragging
   along rows under its lane (`StudioCompLanes.tsx`), which is the same
   gesture. Fixed lanes, comp lanes across separate takes and saved comp
   sets wait for later (section 6).

## 2. How Studio records today

- **A take over a clip goes to a new lane.** The recorder hands each lane's
  take to the importer (`useStudioRecorder.ts` to `studioTakeImport` in
  `take-import.ts`, then `addRecording` in `controller/imports.ts`).
  `importCommands` puts the clip on the armed lane only when
  `laneHasRoom`; otherwise it makes a lane of its own (`add-audio`) and the
  timeline says "No room on Phrase at 0:00. Added on a new lane."
  (`studioMissedLaneText`).
- **A punch replaces.** With Punch on, the take takes over its stretch of the
  lane as tape does: clips there are split at the range's edges and the
  middle goes (`punch-commands.ts`).
- **A loop keeps passes.** With Repeat on, the capture is stored once and
  the clip's `passes` mark whole passes as windows of that one file
  (`clip-passes.ts`). The clip plays the newest; `choose-pass` moves it to
  another, and an audio loop take can be comped, a pass for each stretch
  (`clip-comp.ts`, `StudioCompLanes.tsx` on a computer, `StudioCompSheet.tsx`
  on a phone).
- **The song and its audio.** A song (`StudioProject`, `model/types.ts`)
  holds lanes and clips. A clip names one asset and plays a window of it:
  `startFrame` on the timeline, `sourceInFrame` to `sourceOutFrame` in the
  audio, its `fades` anchored to source frames, its `gainDb`. Assets are kept
  per song, whole captures included, and count against the song's audio
  limit.
- **Edits.** Every edit is a `StudioCommand` applied by `applyStudioCommand`
  (`model/commands.ts`), which validates the whole song before and after and
  keeps comps fitted to their clips. `edit-commits.ts` keeps each command as
  one undo step with a label from `edit-history.ts`; history holds whole
  snapshots, so undo never replays a command.
- **Saving.** `studio-service` `saveProject` checks the revision, the editor
  lease and the storage budget, and validates the song against every asset
  the song owns inside one IndexedDB transaction (`projectSnapshot`).
  `pruneUnusedAssets` deletes, as a song opens, audio no clip names.
  `forkProject` (Make a copy) and `restoreProject` (a backup restored) copy
  the audio clips name and give it new ids. The backup writer
  (`studio-backup.ts`) packs the audio clips name and refuses a backup with
  audio outside the arrangement. The editor keeper decides whether a prune
  is due (`editor-keeper.ts`).
- **Playback, mixdown and export** build one arrangement plan from the
  clips (`arrangement-plan.ts`): each clip's asset, source window, fades and
  gain. Freezing a lane, the live graph and the WAV export all read that
  plan.

Every reader above sees `clip.assetId` and the clip's source window. That is
why the model below keeps the playing take in exactly those fields.

## 3. Design

### 3.1 Behaviour

1. **A take recorded over clips on the armed lane is their newest take where
   it covers them, and it plays.** Each clip it overlaps is split at the
   take's edges, as REAPER splits (section 1.2). The stretch they share
   becomes one clip holding the old take or takes plus the new one. What
   only the old clip covers stays as it was. What only the new recording
   covers is a clip of its own, so nothing sung is lost and nothing is
   silent.
2. **Common case.** Record from the same playhead twice: both start on the
   same frame. If the second runs longer, the clip gets two takes and the
   second take's extra seconds follow as a clip of their own. If it stops
   sooner, the old clip's rest stays after the two-take clip.
3. **Every take covers its whole clip.** REAPER keeps empty takes where a
   recording reaches past the old item. Studio does not: an empty take
   would make the playing take shorter than its clip, which every reader
   of a clip assumes cannot happen. The parts the new recording covers alone
   become their own clips instead.
4. **What stacks.** A take stacks over clips that are takes: ones recorded
   in the Studio, and practice takes brought in from the rest of the app.
   Over a file you picked (a backing track, a stem), it gets a lane of its
   own as before, so a backing track never goes quiet because its lane was
   armed. If any clip under the take is a picked file, the whole take goes
   to a new lane. This follows the owner's words, "when it was over existing
   take".
5. **Punch stays a replace.** Studio's Punch was built as tape mode on
   purpose (`punch-commands.ts`). REAPER's punch makes a take by default; a
   setting for that is listed in section 6.
6. **MIDI lanes keep a new lane for now.** A MIDI clip's audio is a render
   of its notes, so a MIDI take is a different object. Section 6.
7. **Loop recording.** A loop take's passes count as takes everywhere a
   take is listed, stepped or shown. A loop recorded over clips stacks like
   any take: the clip it lands in gets one more take, which has passes.
8. **The most takes a clip keeps is 32**, as for passes. A 33rd take over a
   full clip goes to a new lane, with the same notice as today.

### 3.2 The saved-song model (approved by maff, 27 Nov 2026)

A clip keeps playing what it plays today through its own fields. A clip with
more than one take adds two optional fields:

```ts
interface StudioClip {
  // ... every field it has today: the playing take's audio ...
  /** The clip's other takes, oldest first; absent for a clip of one take. */
  readonly takes?: readonly StudioClipTake[]
  /** Where the playing take stands among them, counted from 0. Present with `takes`. */
  readonly activeTake?: number
}

/** A take of a clip that is not playing. */
interface StudioClipTake {
  readonly assetId: string
  /** Its source frame under any moment of the clip, less the playing take's there. */
  readonly offsetFrames: number
  readonly gainDb: number
  readonly fades: StudioClip['fades']
  readonly passes?: StudioClipPasses
  readonly comp?: readonly StudioCompSegment[]
}
```

How to read it:

- **The playing take stays where it is.** Its audio is the clip's own
  `assetId`, `sourceInFrame`, `sourceOutFrame`, `gainDb`, `fades`, `passes`
  and `comp`, exactly as for a clip of one take. Playback, mixdown, export,
  freezing and the waveform read those and nothing else, so none of them
  changes.
- **The other takes** are listed in the order they were recorded, without
  the playing one. `activeTake` is how many of them came before it. Takes
  `[A, B]` with `activeTake: 1` are A, then the clip's own take, then B.
- **Place and length belong to the clip; sound belongs to each take.** All
  takes share the clip's start and length (REAPER's rule). Each take keeps
  its own audio, line-up, volume, fades, passes and comp, so a take's volume
  or fade stays with it when another is chosen.
- **`offsetFrames` lines a take up with the playing one.** Take k's window
  is the clip's own window moved by `offsetFrames` (`sourceInFrame +
offsetFrames` to `sourceOutFrame + offsetFrames`). Trims, splits, moves
  and punches move the playing take's window, and the others follow without
  being rewritten. Only choosing another take or pass rewrites the offsets.

An example, three takes recorded from the same playhead, the newest
playing:

```json
{
  "id": "c1",
  "trackId": "t2",
  "assetId": "a3",
  "startFrame": 96000,
  "sourceInFrame": 100800,
  "sourceOutFrame": 340800,
  "gainDb": 0,
  "fades": { "curve": "linear-amplitude" },
  "takes": [
    {
      "assetId": "a1",
      "offsetFrames": -480,
      "gainDb": -2,
      "fades": { "curve": "linear-amplitude" }
    },
    {
      "assetId": "a2",
      "offsetFrames": 960,
      "gainDb": 0,
      "fades": { "curve": "linear-amplitude" }
    }
  ],
  "activeTake": 2
}
```

**Rules the validator enforces:**

- `takes` and `activeTake` come together.
- `takes` holds 1 to 31 entries; `activeTake` is a whole number from 0 to
  `takes.length`.
- Every take, moved by its offset, lies inside its own audio. A take with
  passes lies inside one pass, and a comp covers the window, both as the
  clip's own already must.
- A MIDI clip has no takes, for now.
- Every take's asset is owned by the song.

**Compatibility:**

- **Songs and backups people have open unchanged.** Both fields are
  optional, and a clip without them is a clip of one take. No migration
  step runs and `schemaVersion` stays 2, as for `passes` and `comp`.
- **Older builds and songs with takes.** A build from before this change
  refuses a song that holds takes, because its validator refuses fields it
  does not know. That is how `passes` and `comp` shipped.
- **The other option is not taken.** Moving to version 3 would make older
  builds say "This song was saved by a newer MercuryPitch" instead, but it
  would also refuse every song this build saves, takes or not.

**Every place that counts a song's audio counts every take's**, through one
helper (`studioClipAssetIds`):

- the prune as a song opens, and the editor keeper that asks for it;
- Make a copy, and a restored backup, which give every take's audio a new
  id;
- the backup writer's file list and its check for audio outside the
  arrangement;
- the importer's "in use" sets for the song's audio limit;
- the lane's audio in Lane details.

Missing one of the first three loses a take, and each has a test that fails
when it leaves out the takes that are not playing: the prune, Make a copy
and the restore in `studio-service.test.ts`, the editor keeper in
`useStudioController.takes.test.ts`, and the backup writer, its check and
the restore in `studio-backup.takes.test.ts`. Missing one of the last two
loses nothing: the importer's sets only choose which message a full song
shows, and Lane details only lists the lane's audio. Neither has a test with
takes.

### 3.3 Edits and undo

Every take action is one command and one undo step:

| Command         | What it does                                                                                          | Undo label    |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| `stack-take`    | A recording lands over clips (3.1). The ids it needs come with the command.                           | add take      |
| `choose-take`   | Another take, or another pass of a loop take, plays.                                                  | choose take   |
| `crop-takes`    | Only the playing take stays. A comped loop take keeps its passes, which its comp needs.               | crop to take  |
| `explode-takes` | Each other take moves to a new lane right under this one, at the same place. The clip keeps its take. | explode takes |

Edits that move a clip's edges (trim, split, punch) treat all its takes
alike. A trim stops where any take's audio ends. A split gives both halves
every take. A comp kept by a take that is not playing is fitted to the new
edges, as a playing one is (`fitStudioComps`).

### 3.4 Computer and phone

- **The badge.** A clip with more than one take shows "2/3" at the start of
  its band: which take plays and how many there are. It is counted over
  every take, each pass of a loop take included, in the order they were
  sung, as REAPER's "Take 3/3".
- **Stepping.** T plays the next take of the focused clip, Shift+T the
  previous. They wrap around. A loop take's passes are steps of their own.
  A comped loop take is one step, so a comp is never undone by stepping
  past it.
- **The Takes list.** Right-click on a clip opens its menu: the takes as a
  list with the playing one checked, then "Show takes" and "Explode takes to
  new lanes", and last, set apart in the danger colour as the app's menus
  set apart what takes something away, "Crop to this take". The menu is built from a plain list of
  items (`clip-take-menu.ts`), so the lane menu being built on
  `feat/studio-lane-polish` can share it. The same list opens from a Takes
  button on the selected clip's toolbar and, on a phone, which has no
  right-click, from a Takes button in the selected clip's note. On a
  computer the context-menu key opens it too. The badge is a label, not a
  button: the clip is a button already, and a badge that small is too small
  to tap.
- **Showing every take.** "Show takes" opens the clip's lane: each take
  becomes a row under it, newest on top, the way a loop take's passes stand
  for comping. The lanes below move down. A row draws its take's waveform
  over the clip's span; clicking a row plays that take. Showing takes and
  comping are separate modes, so a click never comps and a drag never
  chooses. Escape or "Hide takes" closes them. It works the same on a phone,
  where rows are tapped.
- **Lane headers stay as they are.** The rows' labels sit in the header
  column the way the comp rows' do, and nothing is added to a lane's header.

### 3.5 Shortcuts

| Keys        | What it does                  | REAPER                  |
| ----------- | ----------------------------- | ----------------------- |
| T           | Next take of the focused clip | Next take (T)           |
| Shift+T     | Previous take                 | Previous take (Shift+T) |
| Alt+Shift+T | Crop to the playing take      | Crop to active take     |

They act on the clip with keyboard focus, as S and Delete do
(`studio-editor.ts`), and never while typing.

### 3.6 Export and mixdown

Playback, freezing, the master meter, mixdown and WAV export play the
playing take, because they read the clip's own fields. Takes that are not
playing are never heard and cost nothing at play time. Their audio counts
against the song's audio limit and goes into backups and copies.

## 4. Slices

Each slice is one commit with its tests.

- **S1.** The model (types, validation, `clip-takes.ts`, `stack-take`),
  every audio counter (section 3.2), and recording over a clip stacks a
  take. Tests:
  - unit tests for packing, validation, stacking (common case, longer,
    shorter, several clips, a loop take, a picked file refused, the 32-take
    limit), trims and splits of a clip with takes, choose-pass line-up, and
    the counters;
  - e2e: record a take, record over it, and the song has one lane with two
    takes, the newest plays, and a reload keeps both;
  - e2e: a song saved in today's format opens, plays and saves unchanged.
- **S2.** `choose-take`, T and Shift+T, the right-click menu with the Takes
  list, the "2/3" badge and the toolbar's Takes button. Screenshots at
  1440x900 and 390x844.
- **S3.** "Show takes": the rows under the lane, a click or tap plays a take.
  Screenshots at both sizes.
- **S4.** `crop-takes` (Alt+Shift+T and the menu) and `explode-takes`, both
  undoable.
- **S5.** Loop recording: an e2e records passes over a range, steps through
  them with T, then loops over an existing clip and finds it stacked.

## 5. Where it lives

- `src/lib/studio/model/clip-takes.ts`: the model's take helpers (pack,
  unpack, stack, choose, the steps T goes through) and `studioClipAssetIds`.
- `src/lib/studio/model/take-commands.ts`: crop and explode.
- `src/lib/studio/model/validation-takes.ts`: the format's rules.
- `src/features/studio/timeline/clip-take-menu.ts` and
  `StudioClipMenu.tsx`: the menu's items and the menu;
  `StudioTakesButton.tsx` opens the same list from the clip's bar and a
  phone's clip note.
- `src/features/studio/timeline/StudioTakeLanes.tsx`: the rows, with
  `comp-editor.ts` keeping which clip has rows open, takes or comp.
- `src/features/studio/editor/studio-editor.ts`: T, Shift+T and
  Alt+Shift+T.

## 6. Left for later

- **Empty takes** (REAPER's), so a clip could keep the span of the longest
  take. This needs every reader of a clip to accept a playing take shorter
  than its clip.
- **A setting for what a take over a clip does**, as REAPER's Overlapping
  recording behavior: add a take, add a lane, or replace. Today the answer
  is fixed: stack over takes, a new lane over files, Punch replaces.
- **Punch as a take** (REAPER's default, 3.16), once that setting exists.
- **MIDI takes**: a take of a MIDI clip with its own sequence.
- **Delete this take** (REAPER's X), and Explode in place or in order.
- **Comping across separate takes**, and REAPER 7's fixed lanes with comp
  lanes and saved comp sets (8.12). The comp rows Studio has for passes are
  the start of this.
- **Take FX**, as REAPER has (8.1).

## 7. Where this differs from REAPER, and why

- **No empty takes.** The new recording's parts outside the old clip become
  clips of their own (3.1, item 3).
- **Picked files do not stack.** A backing track keeps playing (3.1, item 4).
- **Explode moves, it does not copy.** REAPER leaves the original item with
  all its takes and copies each one to a new track (8.2), so the active take
  plays twice until the original is muted. Studio moves the other takes out,
  so each plays once.
- **Takes stand newest on top** when shown, as the comp rows already do.
  REAPER stacks take 1 on top.
- **Each take keeps its own volume and fades.** REAPER has item fades shared
  by all takes and a volume per take. Shared fades would have to be moved
  onto another take's audio, and could not always fit it.
