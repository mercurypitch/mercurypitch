# Playback Modes — Architecture and Usage

## Overview

The Practice tab supports three distinct playback modes: `once`, `repeat`, and `session` (formerly known as "Practice").

## Modes

### 1. Once Mode (`'once'`)
**Purpose:** Play a melody exactly once from start to finish.

**Behavior:**
- Starts at the first note and plays through to completion
- Does not repeat after the melody finishes
- No cycle counter is displayed
- Stops immediately after the last note completes

**Use case:** Quick playback check or listening to a melody

**UI:** No special controls beyond Play/Stop buttons

---

### 2. Repeat Mode (`'repeat'`)
**Purpose:** Play a melody multiple times as specified by the user.

**Behavior:**
- Starts at the first note and plays through to completion
- After the last note finishes, playback restarts from the beginning
- Continues repeating until the specified number of cycles is reached
- Cycle counter displays: `{current}/{total}` (e.g., "2 / 5")
- All recorded notes/scores are cleared between repeats (separate practice runs)

**Configuration:**
- `repeatCycles`: Number of times to repeat (default 5, range 1-20)
- Can be changed before starting playback

**Use case:** Practice a melody repeatedly to build muscle memory

**UI:**
- Cycle counter: "2 / 5" or similar
- "Repeat:" input field to configure cycle count

---

### 3. Session Mode (`'session'` or `'practice'`)
**Purpose:** Play through a sequence of multiple practice items.

**Behavior:**
- Plays session items in order: item 1, then item 2, then item 3, etc.
- Each session item is completed before moving to the next
- Session mode uses the `appStore.practiceSession()` API
- Cycle counter displays: `C{current}/{total}` (e.g., "C2/5" showing item progress)
- Scores are recorded after each item completes
- Shows session summary at the end

**Session Items Types:**
- `scale`: A scale to play (e.g., "C Major Scale (Octave 3-4)")
- `rest`: A pause/rest period (with configurable duration)
- `preset`: A pre-defined melody from the library
- `melody`: A user-created melody from the library

**Configuration:**
- Session is defined in the SessionLibraryModal
- Can have variable number of items (default 1, max 20 cycles/items)

**Use case:** Structured practice with scales, rests, and melodies in sequence

**UI:**
- Cycle counter: "C1/3" or "C2/3"
- "Mode:" dropdown for sub-mode options (when mic is active):
  - "All Notes": Play all notes for each item
  - "Random (50%)": Play 50% of notes randomly
  - "Focus Errors": Focus on previously missed notes
  - "Reverse": Play notes in reverse order

---

## Shared Settings

All modes respect these global settings:
- **BPM:** Playback tempo (range 40-280)
- **Count-in:** Number of beats before playback starts (range 0-4)
- **Metronome:** Metronome toggle on/off
- **Volume:** Master volume (range 0-100)
- **Speed:** Playback speed multiplier (0.25x to 2x)
- **Sensitivity:** Mic sensitivity for pitch detection (range 1-10, affects accuracy scoring)
- **Tonic Anchor:** Play a tonic note before each session (helps singers lock into key)

---

## State Management

### Signal Variables
- `playMode()`: Current playback mode ('once', 'repeat', 'session')
- `repeatCycles()`: Number of repeats in repeat mode (default 5)
- `currentRepeat()`: Current repeat iteration in repeat mode (default 1)
- `practiceCycles()`: *Deprecated - use `repeatCycles()`*
- `currentCycle()`: *Deprecated - use `currentRepeat()`*

### Session Variables
- `appStore.sessionMode()`: Boolean indicating if a session is active
- `appStore.practiceSession()`: Current session object
- `appStore.sessionItemIndex()`: Current item being played (0-based)
- `appStore.getCurrentSessionItem()`: Returns current session item

### Playback State
- `isPlaying()`: Whether audio is currently playing
- `isPaused()`: Whether playback is paused
- `liveScore()`: Current session score (for session mode only)

---

## Completion Handling

The `onComplete` handler routes to different logic based on mode:

| Mode | Logic | Action |
|------|-------|--------|
| `'once'` | No action needed | Playback naturally stops |
| `'repeat'` | Decrement cycle count | Restart if cycles remain, stop otherwise |
| `'session'` | Record score, advance item | Load next item or end session |

---

## Migration Notes

### Renamed Variables
- `practiceCycles` → `repeatCycles`
- `currentCycle` → `currentRepeat`
- Button "Practice" → "Session mode"

### Deprecated API
- `appStore.getCurrentSessionItemRepeat()` → Use `repeatCycles()` in repeat mode

---

## Testing Recommendations

1. **Once mode:** Verify single playback with no repeat
2. **Repeat mode:** Verify N repetitions with cycle counter
3. **Session mode:** Verify multi-item sequence with proper scoring
4. **UI:** Verify correct controls show for each mode
5. **Settings:** Verify BPM, count-in, metronome affect all modes