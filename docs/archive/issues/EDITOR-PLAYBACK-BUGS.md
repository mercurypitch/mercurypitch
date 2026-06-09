# Editor Playback Bugs Investigation

## Issues Found

### 1. Editor Toolbar Buttons Don't Work
**Problem:** EditorTabHeader calls `playback.startPlayback()` which only updates a UI-only signal store. The actual PlaybackRuntime is never started.

**Root Cause:**
- `playback.startPlayback()` → changes `playbackStore.state()` to 'playing' (UI state only)
- `playbackRuntime` (PlaybackRuntime class) is never started for Editor tab
- Editor uses `audioEngine` directly but those functions are not connected to the toolbar

**Files Affected:**
- `src/App.tsx` - handles call `playback.startPlayback()` but don't start playbackRuntime
- `src/components/EditorTabHeader.tsx` - calls the wrong store functions
- `src/stores/playback-store.ts` - UI-only store, doesn't control audio

**Fix Options:**
1. Add Editor-specific playback state handlers that start/stop playbackRuntime
2. Make playbackRuntime accessible and start it when editor tab buttons are clicked
3. Share playback controls between tabs (refactor task)

### 2. Editor Playhead Not Rendered
**Problem:** Editor doesn't show the playhead triangle on the canvas ruler.

**Root Cause:**
- PianoRollCanvas renders the canvas-based playhead correctly in `drawGridWithPlayhead()`
- The DOM-based playhead in App.tsx (line 1353-1359) is only shown in Practice tab
- Editor tab doesn't have a DOM playhead element

**Expected Behavior:**
- Editor should show playhead on the canvas (it does)
- Practice tab shows canvas playhead AND a DOM element for the practice canvas

**Observation:**
- The canvas playhead IS rendered (check `drawGridWithPlayhead()`)
- If not visible, it's likely a rendering issue or state mismatch

## Proposed Fixes

### Fix 1: Connect Editor Toolbar to PlaybackRuntime
```typescript
// In App.tsx - add Editor-specific handlers
const handleEditorPlay = () => {
  playbackRuntime.start()
  setEditorPlaybackState('playing')
}

const handleEditorPause = () => {
  playbackRuntime.pause()
  setEditorPlaybackState('paused')
}

const handleEditorResume = () => {
  playbackRuntime.resume()
  setEditorPlaybackState('playing')
}

const handleEditorStop = () => {
  playbackRuntime.stop()
  setEditorPlaybackState('stopped')
}
```

### Fix 2: Ensure Playhead Rendering
- Canvas playhead is already in place
- Add debugging to verify getCurrentBeat() returns correct value when paused

---

# Control Toolbar Refactor Planning

## Task: Create Shared Control Toolbar Component

### Objective
Refactor the Editor and Practice control toolbars to use a shared component with conditional rendering for tab-specific controls.

### Current State
- **PracticeTabHeader**: Contains practice-specific controls (modes, cycles, count-in, sensitivity, sessions button)
- **EditorTabHeader**: Contains editor-specific controls (record to piano roll, volume, speed, metronome)
- Both have overlapping controls (mic, play/pause/continue/stop, volume, speed, metronome)
- Editor has no audio playback connected to toolbar

### Proposed Structure

```
SharedControlToolbar/
├── coreControls.tsx        (shared: play, pause, stop, mic, wave toggle)
├── tabSpecific.tsx         (conditional rendering based on activeTab)
│   ├── practiceControls.tsx
│   └── editorControls.tsx
├── volumeGroup.tsx         (volume slider)
├── speedGroup.tsx          (speed select)
├── metronomeGroup.tsx      (metronome button)
└── recordGroup.tsx         (record button - practice only)
```

### Shared Props Interface
```typescript
interface SharedToolbarProps {
  // Tab identification
  activeTab: () => 'practice' | 'editor'

  // Playback state
  isPlaying: () => boolean
  isPaused: () => boolean

  // Callbacks
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void

  // Volume
  volume: () => number
  onVolumeChange: (vol: number) => void

  // Speed
  speed: () => number
  onSpeedChange: (speed: number) => void

  // Metronome
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void

  // Practice-only
  playMode: () => 'once' | 'repeat' | 'practice'
  onPlayModeChange: (mode: 'once' | 'repeat' | 'practice') => void
  practiceCycles: () => number
  onCyclesChange: (cycles: number) => void
  isRecording: () => boolean
  onRecordToggle: () => void
}
```

### Implementation Steps

1. Extract shared controls into `SharedControlToolbar` component
2. Create conditional rendering for practice-specific controls
3. Pass playbackRuntime to ensure actual audio playback works
4. Test both tabs have fully functional playback
5. Remove duplicate `EditorTabHeader` and `PracticeTabHeader`

### Files to Create
- `src/components/SharedControlToolbar.tsx`
- `src/components/shared/VolumeGroup.tsx`
- `src/components/shared/SpeedGroup.tsx`
- `src/components/shared/MetronomeGroup.tsx`

### Files to Modify
- `src/App.tsx` - replace both headers with SharedControlToolbar
- `src/stores/playback-store.ts` - may need editor-specific state handling