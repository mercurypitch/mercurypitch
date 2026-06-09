# MercuryPitch Refactor Plan v2

## Why v1 is insufficient

The original v1 plan was narrow — it only tackled `window` coupling (events, e2e exposure, CustomEvents). The codebase has much deeper structural problems that a proper refactor plan must address:

1. **`App.tsx` is a 2300-line god component** holding ~25 signals, recording state machine, session sequencer, repeat-mode logic, editor handlers, MIDI import/export, keyboard shortcuts, animation loop, and engine wiring. None of v1's phases reduces this.
2. **`app-store.ts` is a 1473-line monolith** mixing theme, BPM, mic, settings, ADSR, reverb, walkthrough, focus mode, sessions, notifications, presets, and `buildSessionItemMelody` business logic. Stores should not contain melody-building logic.
3. **Engine instances are module-level `let` variables** (`audioEngine`, `playbackRuntime`, `practiceEngine` in App.tsx). Untestable, race-prone (e.g. event handlers register before `playbackRuntime` is constructed in the same `onMount`).
4. **Direct DOM manipulation** in reactive code (`document.getElementById('bar-100').style.width = ...`) — anti-pattern in SolidJS.
5. **State is split** between local `App.tsx` signals (isPlaying, currentBeat, noteResults…) and `playback-store.ts`. Two sources of truth.
6. **`localStorage` access is scattered** across ~15 functions with copy-pasted try/catch.
7. **CustomEvent bus** (`pitchperfect:presetSaved`, `:gridToggle`, `:seekToBeat`, etc.) used as pub/sub between siblings — should be store/context.
8. **Recording state machine** (silence frames, currentNoteMidi) lives as mutable `let` variables inside `onMount`'s animation loop.

---

## Refactor v2 Strategy

### Goals (in priority order)
1. Make `App.tsx` a thin shell (<300 lines): layout + tab routing only.
2. Make stores modular and pure (no DOM, no `window`, no business logic).
3. Centralize engine lifecycle behind a typed Context.
4. Replace CustomEvent bus and `window.__*` with reactive signals/context.
5. Single source of truth for playback state.
6. Make E2E exposure opt-in and gated.

### Phase 1 — Persistence & Utilities Foundation
- `lib/storage.ts`: Create `createPersistedSignal<T>(key, default, schema?)` wrapping `localStorage` with one try/catch and JSON validation. Replace ~15 ad-hoc loaders/savers in `app-store.ts`.
- `lib/dom-utils.ts`: Move `getDevicePixelRatio()`, `showAlert` → `appStore.showNotification`, URL helpers.
- `lib/test-utils.ts`: Create `exposeForE2E(key, value)` gated by `import.meta.env.MODE === 'test'` or `window.E2E_TEST_MODE`. Replace every `(window as any).__X = …` (≥10 occurrences).
- `lib/global-error-handler.ts`: Extract global error handling from `index.tsx`.

### Phase 2 — Split `app-store.ts` into Focused Stores
Break the 1473-line file into:
- `stores/theme-store.ts` (theme + initTheme)
- `stores/settings-store.ts` (sensitivity preset, settings, ADSR, reverb)
- `stores/transport-store.ts` (BPM, countIn, playbackSpeed, metronomeEnabled)
- `stores/notifications-store.ts`
- `stores/walkthrough-store.ts` (already exists — consolidate)
- `stores/practice-session-store.ts` (PracticeSession, sessionItem*, sessionResults)
- `stores/user-session-store.ts` (Session/userSession, selection)
- `stores/ui-store.ts` (activeTab, editorView, focusMode, modals, welcome)
- `stores/mic-store.ts`
- **Action**: Keep barrel `stores/index.ts` re-exporting; preserve public API to minimize call-site churn.
- **Action**: Move `buildSessionItemMelody` and `buildScaleItemsForSession` out of stores into `lib/session-builder.ts` (pure functions).
- **Action**: Replace all `window.dispatchEvent('pitchperfect:*')` in stores with reactive signal subscriptions.

### Phase 3 — Engine Context & Lifecycle
Create `contexts/EngineContext.tsx`:
```ts
interface EngineContextValue {
  audio: AudioEngine
  playback: PlaybackRuntime
  practice: PracticeEngine
}
```
- `<EngineProvider>` constructs engines in `onMount`, wires `createEffect` for BPM/ADSR/reverb/instrument sync, and disposes in `onCleanup`.
- All engine event subscriptions (`playbackRuntime.on('beat'|'complete'|…)`) live here and dispatch to stores.
- Components consume via `useEngines()`. Removes the module-level `let audioEngine`.
- Remove the duplicated `pianoRollAudioEngine` window leak — register secondary engines on the context or properly encapsulate.

### Phase 4 — Decompose `App.tsx`
Break `App.tsx` into:
- `App.tsx` — Providers + Layout + `<Show>` per tab (target <250 lines).
- `features/practice/PracticeController.tsx` — pitchHistory, noteResults, liveScore, practice handlers.
- `features/playback/PlaybackController.tsx` — handlePlay/Pause/Resume/Stop, repeat & session sequencing, animation loop subscription.
- `features/recording/RecordingController.tsx` — silenceFrames, currentNoteMidi, finalizeRecording (encapsulate as a class or store, not loose vars).
- `features/editor/EditorController.tsx` — handleEditor*, MIDI import/export, share.
- `features/keyboard/useKeyboardShortcuts.ts` — Extract the 80-line keydown switch as a hook taking handler refs.
- `features/stats/StatsBars.tsx` — Replace `getElementById` + `style.width` with reactive JSX `style={{ width: pct + '%' }}`.

### Phase 5 — Unify Playback State
- Move `isPlaying`, `isPaused`, `currentBeat`, `currentNoteIndex`, `editorPlaybackState`, `playbackDisplayMelody`, `playbackDisplayBeats`, `sessionMelodyIds`, `sessionCurrentMelodyIndex` from `App.tsx` locals into `playback-store.ts` (currently underused).
- Derive `noteIndex` reactively from `currentBeat` + active items via `createMemo` instead of dual-writing.
- Single `resetPlaybackState()` lives in playback store.

### Phase 6 — Replace CustomEvent Bus
- `pitchperfect:presetSaved/Loaded/octaveChange/modeChange` → direct calls into `melodyStore` / `appStore` (already in same module graph).
- `pitchperfect:seekToBeat` → `playbackStore.seekTo(beat)` consumed by canvas via context.
- `pitchperfect:gridToggle/themeChange/sensitivityPresetChange` → consumers `createEffect` on the signal.
- Delete all `window.addEventListener('pitchperfect:*')` and matching dispatches.

### Phase 7 — Global Event Provider
- `providers/GlobalEventProvider.tsx`: window resize/scroll signals + global error handler hookup. 
- Tab-button DOM listeners in `App.tsx onMount` are obsolete once SolidJS handlers are correctly bound — remove them rather than centralize them.
- Keyboard shortcuts: handled by `useKeyboardShortcuts` (Phase 4), not duplicated here.

### Phase 8 — Test Hardening
- Replace every `(window as any).__appStore` / `__playbackRuntime` / `__loadAndPlayMelodyForSession` etc. with `exposeForE2E`.
- Provide a single `lib/e2e-bridge.ts` that registers all E2E hooks in one place behind the gate.
- Update e2e specs to read from `window.__pp` namespaced object instead of polluting globals.

### Phase 9 — Cleanup Pass
- Remove `playback-runtime.ts.bak`.
- Delete `_unused` prefixed handlers (`_handleTabPractice` etc.) once routing migrates.
- Replace `setTimeout(..., 500)` chained session skips with awaitable promise sequence.
- Clean up any unused `CustomEvent` detail interfaces.

---

## Execution Order & Guardrails

- Phases 1, 2, 3 are independent and can be parallelized.
- Phase 4 depends on 3.
- Phase 5 depends on 4 and 2.
- Phase 6 depends on 2.
- Phases 7–9 are cleanup.

**For each phase:** 
Keep public re-exports in `stores/index.ts` stable so we don't cascade import changes. Run `tsc --noEmit` and existing vitest unit suites between phases (no e2e until Phase 8).
