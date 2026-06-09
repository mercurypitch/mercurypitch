# MercuryPitch Refactor Plan v3 — App.tsx Simplification & Controller Extraction

## Current State Summary

After the v2 refactor, several foundations exist:

- `app-store.ts` has been reduced dramatically (~40 lines).
- Focused stores now exist: `theme-store`, `settings-store`, `transport-store`,
  `practice-session-store`, `ui-store`, `notifications-store`, `mic-store`,
  `user-session-store`, `playback-state-store`, `recording-store`.
- Utility modules exist: `lib/storage.ts`, `lib/test-utils.ts`, `lib/dom-utils.ts`,
  `lib/global-error-handler.ts`, `lib/session-builder.ts`.
- `contexts/EngineContext.tsx` exists.
- TypeScript currently passes with `cd App && npx tsc --noEmit` (exit 0).

However, `App.tsx` is still the main bottleneck. It is **~2408 lines** and still owns:

- engine construction and lifecycle (module-level `let` engine vars)
- playback control (play/pause/resume/stop/reset)
- editor playback control
- keyboard shortcuts
- global CustomEvent listeners (`pitchperfect:*`)
- pitch detection animation loop (`requestAnimationFrame`)
- recording state machine (silenceFrames, currentNoteMidi, etc.)
- session sequencing (skip, end, item-complete, load-next)
- DOM mutation for stats bars (`document.getElementById(...).style.width`)
- E2E hook registration
- modal/layout/tab orchestration
- fallback tab DOM listeners

`stores/index.ts` is now a temporary compatibility facade that bundles every focused
store under a single `appStore` object, with a TODO marker explicitly stating
"Replace all appStore.<something> calls with proper calls!"

The v3 goal is to make `App.tsx` boring: providers + layout + tab selection only.

---

## Main v3 Goals

1. Reduce `App.tsx` from ~2400 lines to under 350 lines.
2. Make engine lifecycle single-owner via `EngineProvider` / `useEngines`.
3. Remove direct global keyboard / event listener logic from `App.tsx`.
4. Replace DOM mutation with reactive components.
5. Move session sequencing and recording out of `App.tsx`.
6. Stop adding new code that uses the `appStore` compatibility facade.
7. Keep each migration step small and TypeScript-green.

---

## Phase 0 — Safety Baseline

Before changing behavior:

- Run `cd App && npx tsc --noEmit` and confirm it passes.
- Record current line counts as a baseline:
  - `App.tsx` (~2408)
  - `stores/index.ts` (~102)
  - `contexts/EngineContext.tsx` (~73)
- Do **not** remove compatibility exports until all call sites are migrated.
- Avoid running full E2E until the bridge changes (Phase 5) are complete.

Deliverable:

- Short note in commit message confirming TypeScript passes before extraction begins.

---

## Phase 1 — Remove Reactive DOM Mutation: Extract `StatsBars`

### Current issue

In `App.tsx`:

```ts
createEffect(() => {
  const counts = statsCounts()
  ...
  const el = document.getElementById(id)
  if (el) el.style.width = `${(count / total) * 100}%`
  const cntEl = document.getElementById(`cnt-${id}`)
  if (cntEl) cntEl.textContent = String(count)
})
```

This is an anti-pattern in SolidJS — it bypasses reactivity by writing to the DOM imperatively.

### Target

- Create `components/StatsBars.tsx` (or `features/stats/StatsBars.tsx`).
- Props:
  - `noteResults: Accessor<NoteResult[]>`
- Internally compute counts using `createMemo`.
- Render widths and counts directly in JSX:

```tsx
<div class="bar-fill" style={{ width: `${percentage()}%` }} />
<span class="cnt">{count()}</span>
```

### Removals from `App.tsx`

- `statsCounts` memo
- `createEffect` that calls `document.getElementById`
- DOM ids only needed for imperative updates

### Why first

- Low risk, no engine coupling.
- Removes direct DOM coupling.
- Easy TypeScript verification.

---

## Phase 2 — Extract Keyboard Shortcuts

### Current issue

`App.tsx onMount` owns a large `onKeyDown` listener with:

- **Space**: play/pause/resume in focus mode
- **Escape**: exit focus mode or stop
- **Home**: seek beginning
- **R**: repeat mode
- **P**: practice mode
- **ArrowUp/ArrowDown**: playback speed

### Target

Create:

```
features/keyboard/useKeyboardShortcuts.ts
```

API:

```ts
interface KeyboardShortcutHandlers {
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  seekToStart: () => void
  playMode: Accessor<PlayMode>
  setPlayMode: Setter<PlayMode>
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void
```

Implementation guidelines:

- Inside `onMount`: `window.addEventListener('keydown', onKeyDown)`.
- Inside `onCleanup`: `window.removeEventListener('keydown', onKeyDown)`.
- Keep typing guard inside the hook.
- Read focus mode and playback speed directly from focused stores
  (do not introduce additional `appStore` indirection).

### Removals from `App.tsx`

- inline `onKeyDown`
- `window.addEventListener('keydown', ...)`
- `window.removeEventListener('keydown', ...)`

### Why now

- Self-contained extraction, no engine dependency.
- Significantly simplifies `onMount`.

---

## Phase 3 — Remove Fallback Tab DOM Listeners

### Current issue

`App.tsx` still contains:

```ts
const tabBtn = document.getElementById('tab-settings')
tabBtn?.addEventListener('click', ...)

const tabPracticeBtn = document.getElementById('tab-practice')
tabPracticeBtn?.addEventListener('click', ...)

const tabEditorBtn = document.getElementById('tab-editor')
tabEditorBtn?.addEventListener('click', ...)
```

This duplicates Solid's `onClick` handlers and was originally added as a workaround.

### Target

- Remove fallback tab listeners entirely.
- Ensure tab buttons rely on Solid `onClick` only.
- If the historical motivation was innerHTML-created nodes, document the source
  in a comment near the tab JSX or fix the offending component.

### Deliverable

- No `document.getElementById('tab-*')` in `App.tsx`.
- No manual tab listener cleanup needed.

---

## Phase 4 — Make `EngineProvider` the Real Owner

### Current issue

`EngineContext.tsx` exists but:

- It has uncertain constructor wiring (`FIXME: check or fix?`).
- It does not handle reverb, BPM, or volume.
- `App.tsx` still owns module-level `let audioEngine`, `let playbackRuntime`,
  `let practiceEngine` and constructs them in `onMount`.

### Target

1. Define a stable typed API:

```ts
interface EngineContextValue {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  ready: Accessor<boolean>
}
```

2. Move into `<EngineProvider>` from `App.tsx`:

   - engine creation
   - volume initialization
   - BPM / instrument / ADSR / reverb sync
   - `practiceEngine.syncSettings`
   - engine `onCleanup`
   - `playbackRuntime` event subscriptions where they do not depend on
     component-local state (otherwise leave subscriptions in `usePlaybackController`).

3. Components and controllers consume engines via:

```ts
const { audioEngine, playbackRuntime, practiceEngine } = useEngines()
```

4. Keep `App.tsx` temporarily wrapping content:

```tsx
<EngineProvider>
  <AppShell />
</EngineProvider>
```

### Important guardrail

Do this **before** deep playback extraction. Otherwise every new controller will
end up depending on the module-level engine vars, and we'll repeat the v2 mistake.

---

## Phase 5 — Extract E2E Bridge

### Current issue

`App.tsx` still registers multiple E2E hooks via `exposeForE2E`:

- `__appStore`
- `__melodyStore`
- `__loadAndPlayMelodyForSession`
- `__playSessionSequence`
- `__setPlayMode`
- `__playbackRuntime`

### Target

Create:

```
lib/e2e-bridge.ts
```

API:

```ts
export interface E2EBridgeDeps {
  appStore: typeof appStore
  melodyStore: typeof melodyStore
  playbackRuntime?: PlaybackRuntime
  loadAndPlayMelodyForSession?: (id: string) => void
  playSessionSequence?: (ids: string[]) => void
  setPlayMode?: Setter<PlayMode>
}

export function registerE2EBridge(deps: E2EBridgeDeps): void
```

Implementation:

- Use `exposeForE2E` internally.
- Prefer namespacing under a single `__pp` global object:

```ts
window.__pp = { appStore, melodyStore, playbackRuntime, ... }
```

- Keep individual `__appStore`, `__playbackRuntime`, etc. as **deprecated aliases**
  while E2E specs migrate.

### Removals from `App.tsx`

- All direct `exposeForE2E(...)` calls.

---

## Phase 6 — Extract CustomEvent Bus Listeners

### Current issue

`App.tsx` listens to (and removes on cleanup):

- `pitchperfect:presetSaved`
- `pitchperfect:presetLoaded`
- `pitchperfect:octaveChange`
- `pitchperfect:modeChange`
- `pitchperfect:seekToBeat`

### Target

Create transitional hook:

```
features/events/usePianoRollEvents.ts
```

API:

```ts
export function usePianoRollEvents(deps: {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  setCurrentBeat: Setter<number>
}): void
```

Implementation:

- Mount/cleanup all five listeners inside this hook.

### Long-term target (separate later phase)

- Replace these CustomEvents with direct store/context APIs.
  - `pitchperfect:seekToBeat` → `playbackController.seekTo(beat)`
  - `pitchperfect:gridToggle` → reactive store signal
  - `pitchperfect:presetSaved/Loaded` → `melodyStore` / `notifications-store` calls
  - `pitchperfect:octaveChange/modeChange` → direct calls into `melodyStore` / `appStore`
- v3 only requires removing them from `App.tsx`. Removing them from the codebase
  entirely is part of the cleanup phase.

---

## Phase 7 — Extract Playback Controller

### Current `App.tsx` ownership

- `handlePlay`, `handlePause`, `handleResume`, `handleStop`
- `resetPlaybackState`
- `handleRepeatModeComplete`
- `playSessionSequence`
- `playNextInSessionSequence`
- `loadAndPlayMelodyForSession`
- many playback-related signals (isPlaying, isPaused, currentBeat,
  currentNoteIndex, playbackDisplayMelody, playbackDisplayBeats,
  sessionMelodyIds, sessionCurrentMelodyIndex)
- `editorPlaybackState`
- `editorIsPlaying`, `editorIsPaused`

### Target

Create:

```
features/playback/usePlaybackController.ts
```

It should own or consume:

- playback state signals
- `currentBeat`, `currentNoteIndex`
- display melody / beats
- play/pause/resume/stop/reset
- repeat mode
- session sequence helpers (load next melody / sequence-of-melodies playback)
- editor playback state and handlers

Return a typed object:

```ts
interface PlaybackController {
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  currentBeat: Accessor<number>
  currentNoteIndex: Accessor<number>
  playbackDisplayMelody: Accessor<MelodyItem[] | null>
  playbackDisplayBeats: Accessor<number | null>
  activePlaybackItems: Accessor<MelodyItem[]>
  totalBeats: Accessor<number>
  playheadPosition: Accessor<number>
  handlePlay: () => void
  handlePause: () => void
  handleResume: () => void
  handleStop: () => SessionResult | null | undefined
  resetPlaybackState: () => Promise<void> | void

  // Editor variants
  editorPlaybackState: Accessor<PlaybackState>
  editorIsPlaying: Accessor<boolean>
  editorIsPaused: Accessor<boolean>
  handleEditorPlay: () => Promise<void>
  handleEditorPause: () => void
  handleEditorResume: () => void
  handleEditorStop: () => void
}
```

### Guardrail

- Do **not** move recording into this hook.
- Playback controller may call session controller but should not own session
  item business rules long-term.
- Use focused stores directly (no `appStore.foo` in new code).

---

## Phase 8 — Extract Recording Controller

### Current `App.tsx` ownership

- `isRecording`, `recordedMelody`
- `silenceFrames`, `currentNoteStartBeat`, `currentNoteMidi`, `pendingNoteId`
- `makeRecordedNote`, `mergeRecordedItems`, `finalizeRecording`
- `handleRecordToggle`
- pitch-loop recording append logic embedded in the animation loop

### Target

Create:

```
features/recording/useRecordingController.ts
```

…or turn the existing `stores/recording-store.ts` into the actual owner.

API:

```ts
interface RecordingController {
  isRecording: Accessor<boolean>
  handleRecordToggle: () => Promise<void>
  processPitchFrame: (pitch: PitchResult | null, beat: number) => void
  finalizeRecording: (endBeat: number) => void
}
```

### Pitch loop simplification

```ts
const pitch = practiceEngine.update()
recording.processPitchFrame(pitch, playbackRuntime.getCurrentBeat())
```

The recording controller alone owns the silence-frame state machine and the
in-progress note buffer.

---

## Phase 9 — Extract Session Sequencer

### Current TODO/FIXME markers

The session-related code is the murkiest part of `App.tsx`:

- `handleSessionSkip`
- `handleSessionEnd`
- `handleSessionModeComplete`
- `loadNextSessionItem`
- `setTimeout(..., 500)` restart chain
- count-in per item (FIXME)
- pitch history reset across items (FIXME)
- score aggregation (TODO)
- "Should be called item complete" rename (FIXME)

### Target

Create:

```
features/session/useSessionSequencer.ts
```

Responsibilities:

- skip current item
- end current session
- complete current item (renamed from session-mode-complete)
- load next item (rest / scale / melody / preset)
- decide rest behavior (real wait, not just `setTimeout` chained restart)
- coordinate score aggregation with `practice-session-store`

Replace `setTimeout(..., 500)` chains with awaitable transitions:

```ts
await stopPlayback()
await waitForFrame()
startPlayback()
```

…or a typed helper:

```ts
await restartAfterSessionTransition({ delayMs: 0 })
```

### v3 behavior decisions to make explicit

- Rename `handleSessionModeComplete` → `handleSessionItemComplete`.
- Decide and document: pitch history resets per item or per full session.
- Decide and document: count-in happens once per session or per item.
- Decide and document: skipped items still record partial result?

These decisions should be captured in code comments inside the new hook.

---

## Phase 10 — Extract Practice Controller / Pitch Loop

### Current `App.tsx` ownership

- `pitchHistory`, `currentPitch`, `noteResults`, `practiceResult`, `liveScore`
- `frequencyData`, `waveformData`, `targetPitch`
- `requestAnimationFrame` loop
- `practiceEngine.setCallbacks`

### Target

Create:

```
features/practice/usePracticeController.ts
```

Owns:

- practice signals
- practice callbacks
- pitch loop
- live score updates
- waveform / frequency capture

Receives:

- engines from `useEngines`
- recording controller
- playback controller

### After extraction

`App.tsx` simply passes practice controller signals down into:

- `PitchCanvas`
- `HistoryCanvas`
- `FocusMode`
- `AppSidebar`

---

## Phase 11 — Extract Editor Controller

### Current `App.tsx` ownership

- `handleEditorPlay`, `handleEditorPause`, `handleEditorResume`, `handleEditorStop`
- `_handleShare`
- `_handleExportMIDI`
- `_handleImportMIDI`
- record toggle wiring on the editor toolbar

### Target

Create:

```
features/editor/useEditorController.ts
```

Responsibilities:

- editor transport handlers
- MIDI import/export
- share URL
- record toggle integration with `useRecordingController`

---

## Phase 12 — Replace Compatibility Facade Usage in New Code

### Current issue

`stores/index.ts` defines:

```ts
// TODO: Replace all appStore.<something> calls with proper calls!
export const appStore = { ...everyStoreCombined }
```

Plus extra wrappers:

- `startPracticeSession` (manual setSession+setMode+setActive composition)
- `walkthroughStep`, `walkthroughActive`, `startWalkthrough`,
  `endWalkthrough`, `nextWalkthroughStep`, `prevWalkthroughStep`,
  `WALKTHROUGH_STEPS`
- `loadSession`
- `buildSessionItemMelody`
- `reverb`
- stubs: `isInSessionMode`, `initPresets`, `presets`

### Target

- New extracted controllers must import focused stores directly.
- Do not add new `appStore.<x>` usages anywhere.
- Gradually replace existing `appStore` references in `App.tsx` as controllers
  move out.
- Delete compatibility entries only when no call sites remain.

### Order

1. New hooks/controllers import focused stores directly.
2. Once `App.tsx` is thin, migrate child components.
3. Audit `appStore` field by field and remove each only when grep is clean.

---

## Phase 13 — Remove `window.pianoRollAudioEngine` Coupling

### Current reset logic

```ts
const pianoRollEngine = (window as any).pianoRollAudioEngine
if (pianoRollEngine) {
  pianoRollEngine.stopTone()
  pianoRollEngine.stopAllNotes()
}
```

### Target options (pick one)

1. **Preferred**: register all engines under `EngineProvider`, including the
   piano roll's secondary engine, and call them through the context.
2. **Alternative**: expose a `PianoRollAudioContext` from `PianoRollCanvas`.
3. **Minimal bridge**: provide a typed `audioRegistry.stopAll()` function in
   the engine context that internally tracks which engines are active.

### Goal

`resetPlaybackState` should call **one typed API**, not a window global.

---

## Phase 14 — Cleanup TODO/FIXME Markers

Known TODO/FIXME groups from the v2 → v3 scan:

### App.tsx

- Verify whether `audioEngine.stopTone/stopAllNotes` and `playbackRuntime.stop`
  must be awaited (FIXME comments around `resetPlaybackState`).
- Decide whether skipped session items discard partial results.
- Rename item-completion logic.
- Decide pitch history behavior across session items.
- Decide count-in behavior per item vs per session.

### EngineContext.tsx

- Fix constructor / sync uncertainty (`FIXME: check or fix?`).
- Resolve note about missing `setReverb` / `setADSR` design.

### stores/index.ts

- Remove `appStore` compatibility facade gradually.
- Remove the explicit TODO header.

### practice-session-store.ts

- Correct total score aggregation (TODO: aggregate over all items, not just last).
- Correct items completed / skipped calculation (TODO: count skipped).
- Decide whether `initSessionHistory` should remain public (FIXME).

### session-store.ts / user-session-store.ts / SessionEditor.tsx

- Consolidate session model naming — "no UserSession type anymore, only PlaybackSession".
- Remove duplicate session/library logic.

### types/index.ts

- Address the accuracy heatmap FIXME by moving heatmap calculation behind a
  proper selector/service that does not require keeping raw MIDI in session results.

### melody-store.ts

- Resolve the "Do we read this signal for some purpose?" FIXMEs and clarify
  reactivity intent.

### lib/practice-engine.ts

- Decide whether the moved-to-App helpers belong inside `PracticeEngine` after
  controller extraction.

### Generic cleanup

- Remove `playback-runtime.ts.bak`.
- Remove orphaned `_unused` prefixed handlers in `App.tsx`
  (e.g. `_handleTabPractice`, `_handleTabEditor`, `_handleTabSettings`).
- Remove leftover console.log noise in playback paths.

---

## Suggested Implementation Order

1. `StatsBars` extraction (Phase 1).
2. `useKeyboardShortcuts` extraction (Phase 2).
3. Remove fallback tab DOM listeners (Phase 3).
4. Fix and adopt `EngineProvider` (Phase 4).
5. Extract E2E bridge (Phase 5).
6. Extract CustomEvent listener hook (Phase 6).
7. Extract playback controller (Phase 7).
8. Extract recording controller (Phase 8).
9. Extract session sequencer (Phase 9).
10. Extract practice controller (Phase 10).
11. Extract editor controller (Phase 11).
12. Remove `appStore` facade usage in new code (Phase 12).
13. Remove `window.pianoRollAudioEngine` coupling (Phase 13).
14. Cleanup TODO/FIXME markers and delete obsolete backup files (Phase 14).

Phases 1–3 are independent. Phase 4 must happen before Phases 7–11. Phase 12
runs continuously but is finalized after Phase 11.

---

## Acceptance Criteria

`App.tsx` after v3 must satisfy **all** of the following:

- [ ] Under 350 lines.
- [ ] No `window.addEventListener` calls.
- [ ] No `document.getElementById` calls.
- [ ] No `CustomEvent` listeners.
- [ ] No engine construction.
- [ ] No `requestAnimationFrame` loop.
- [ ] No recording mutable `let` state.
- [ ] No direct `window.__*` E2E exposure.
- [ ] No `setTimeout(..., 500)` session-restart chains.

System-level acceptance:

- [ ] `cd App && npx tsc --noEmit` passes after every phase.
- [ ] No new code imports `appStore` from the compatibility facade.
- [ ] `playback-runtime.ts.bak` removed.
- [ ] All `_unused` prefixed handlers in `App.tsx` removed.

---

## Out of Scope for v3

- Replacing the entire `pitchperfect:*` CustomEvent bus codebase-wide.
  v3 only removes its consumption from `App.tsx`. Final removal is a follow-up plan.
- Rewriting the session/library model. v3 only consolidates naming where it
  intersects with extraction work; deeper model refactor is a separate plan.
- Changing the pitch detection algorithm or engine internals.
