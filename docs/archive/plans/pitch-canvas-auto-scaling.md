# Pitch Canvas Auto-Scaling and Top C Label Fix

The current pitch canvas in `drawPitchCanvas()` has two problems:
1. The top C row has no label (loop draws labels for `i < 12` but there are 13 rows)
2. All octaves collapse into 12 chromatic rows, so C3 and C5 occupy the same row -- making the live pitch tracker appear to jump erratically

## Proposed Changes

### [MODIFY] useStemMixerCanvasController.ts

**File:** `src/features/stem-mixer/useStemMixerCanvasController.ts`

**Current behavior (lines 305-335):**
- 12 note names (C through B), divided into `h / 13` rows
- Labels drawn for 12 rows only (top C row unlabeled)
- `notes.indexOf(noteName.replace(/\d/g, ''))` strips octave, so all octaves map to same row

**Proposed behavior:**
1. **Compute the note range** from the pitch history (denoised notes) visible in the current time window
2. **Auto-scale to ~2 octaves** (24 semitones + 1 for top boundary = 25 rows). Center this range on the visible notes' median MIDI note. If the visible range only spans 1 octave (e.g., C4-C5), show that octave with some padding
3. **Draw rows by MIDI number** rather than note name index. Each row = 1 semitone. Labels show `NoteOctave` (e.g., "C4", "D4", "C5")
4. **Highlight C rows** slightly brighter to visually separate octaves
5. **All placement logic** (`drawMergedNotes`, diff bars, current pitch dot) uses MIDI number directly instead of `notes.indexOf()`

**Key formulas:**
```
midiMin = median - 12  (or clamp to actual range with padding)
midiMax = median + 12
numRows = midiMax - midiMin + 1
rowH = h / numRows
midiToY(midi) = (midiMax - midi) * rowH
```

**Changes per section:**
- **Grid lines + labels (lines 319-335):** Replace with MIDI-range-based loop. Label each row with `midiToNote(midi) + octave`. Bold/brighter for C notes.
- **drawMergedNotes (lines 369-431):** Use `freqToMidi()` for y-position via `midiToY()` instead of `notes.indexOf()`. Notes outside the range get clamped or skipped.
- **Diff bars (lines 445-499):** Same -- use `midiToY()` for vocal and mic positions.
- **Current pitch highlight (lines 502-527):** Use `midiToY(freqToMidi(cp.frequency))`.

## Design Decisions

### Range Source: Dynamic (Currently Visible Notes)

**Decision:** Use only the notes visible in the current time window to compute the auto-scale range. If denoised pitch data is available, use that; otherwise fall back to raw pitch history.

**Rationale:** We don't need to know the whole song to fit the range. The view adapts as the playhead moves, showing only the relevant octave range for what's currently on screen. This keeps the display tight and focused on the notes the user is seeing right now.

**Implementation notes:**
- Filter pitch history to `[windowStart, windowEnd]` before computing min/max MIDI
- Add some padding (e.g., 2-3 semitones above/below) so notes at the edge aren't clipped
- Smooth the range transitions to avoid jarring jumps between frames (e.g., lerp or only expand, never shrink within a short time window)

## Performance

The range computation is trivial (one pass over the pitch history to find min/max MIDI in the visible window). This runs at the start of each `drawPitchCanvas()` call. If needed, can be cached and only recomputed when the window changes.

## Verification Plan

### Manual Verification
- Load a song with a narrow vocal range (e.g., one octave) -- canvas should zoom in to show that range clearly
- Load a song with a wide range (2+ octaves) -- canvas should show the full range
- Top C note should always have a visible label
- Live pitch tracker dot should move smoothly within the visible range
- Mic comparison (diff bars) should align correctly
- Scrolling/playback should show smooth range transitions (no jarring jumps)
