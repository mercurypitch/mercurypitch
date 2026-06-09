# Session Playback Unification

## Goal
Unify the playback logic so that "Practice" mode strictly maps to "Session Playback", and "Once"/"Repeat" modes strictly map to "Single Melody Playback". Fix the critical bug where transient session items (like `rest` or auto-generated `scale` items) overwrite the user's currently selected melody in the persistent library.

## Background
Currently, the codebase uses `melodyStore.setMelody(...)` during session item transitions to configure the transient `playbackDisplayMelody` for the UI and audio runtime. Because `melodyStore.setMelody(...)` mutates the global store and instantly saves to localStorage, it effectively corrupts the user's library when a rest or dynamically-generated scale is played during a session. 

Additionally, the entry into session playback is fragmented: `App.tsx` tries to guess if it should start a session via `isSessionShaped` and uses a `pendingSessionStart()` flag to signal `handlePlay`. The Library's "Play All in sequence" action also relies on this `pendingSessionStart()` signal, creating redundant and complex bridging code.

## Refactoring Steps

### 1. Fix the Library Overwrite Bug
- In `src/features/playback/usePlaybackController.ts` and `src/features/session/useSessionSequencer.ts`, **remove all calls to `melodyStore.setMelody(...)`** when setting up transient session items (such as `rest`, `scale`, or `preset` items).
- Continue using `setPlaybackDisplayMelody(...)` to update the visual canvas without touching the permanent library.
- For the audio engine, use `playbackRuntime.setMelody(...)` by feeding it the locally generated `MelodyItem[]` directly.

### 2. Unify Playback Initiation in `handlePlay`
- Deprecate and remove `pendingSessionStart` from the global state.
- In `src/features/playback/usePlaybackController.ts` within `handlePlay()`, simplify the logic to strictly use the `playMode()` state:
  - **If `playMode() === 'practice'`**, we play the `userSession()`:
    - Automatically seed the `PracticeSession` using `startPracticeSession(activeSession)` if starting fresh.
    - Advance or setup the first item (handling rests appropriately).
  - **If `playMode() === 'once'` or `'repeat'`**, we play the single melody `melodyStore.items()`.
- Ensure that switching to/from 'practice' mode cleanly resets the playback state so that clicking "Play" behaves consistently.

### 3. Simplify `handlePracticePlay` in `App.tsx`
- Replace the complex `isSessionShaped` logic and `setPendingSessionStart(true)` flag with a simple check.
- Because "Practice" mode is controlled via the toolbar, `App.tsx`'s `handlePracticePlay` can just call the standard `handlePlay()` directly. `handlePlay()` will natively know whether to play a session or a single melody based on the current `playMode()`.

### 4. Update "Play All in sequence"
- In `usePlaybackController.ts`'s `playSessionSequence()`, simplify the function to just build the transient session, call `setActiveUserSession()`, `setPlayMode('practice')`, and `handlePlay()`. This unifies all session-starts to follow the same predictable path.

### 5. Check Octave Shift in Practice Tab
- Ensure that the "Octave Shift" controls (`+/-` buttons) in the sidebar while in the Practice tab act **strictly as a view/display shift** for the Piano Roll grid.
- Currently, `AppSidebar.tsx` avoids calling the global `onOctaveShift` (which transposes notes) unless the active tab is `editor`. However, it does call `melodyStore.setOctave()`. We will ensure this `setOctave` logic is fully isolated to just shifting the UI grid (`_octave` and `currentScale`) and absolutely guarantees no mutation of the currently loaded melody data in the library.
