# PitchPerfect UI/UX & Code Quality Improvements Plan

_Audit date: 2026-05-05 — Codebase snapshot from `dev` branch (8d8bf98)_

---

## Priority Tiers

| Tier | Description | Timeframe |
|------|-------------|-----------|
| **P0** | Critical — broken behavior, memory leaks, data integrity | Next 1-2 sprints |
| **P1** | High — silent failures, test gaps, accessibility blockers | Next 2-4 sprints |
| **P2** | Medium — flaky tests, mobile UX, code hygiene | Ongoing |
| **P3** | Nice-to-have — feature ideas, polish, long-term refactors | Backlog |

---

## P0 — Critical Fixes

### 1. `appStore.isInSessionMode` Returns Hardcoded `false`

**File:** `src/stores/index.ts:87`
**Problem:** `appStore.isInSessionMode: () => false` is a hardcoded stub. The real value lives in `practiceStore.sessionMode()`. Any component calling `appStore.isInSessionMode()` always gets `false` regardless of actual session state.
**Fix:** Either remove the stub and update callers to use `practiceStore.sessionMode()`, or wire it up as `isInSessionMode: () => practiceStore.sessionMode()`.
**Risk:** Could cause session-mode-dependent features to silently malfunction.

### 2. `appStore` Monolithic Barrel — Stale Signal Risk

**File:** `src/stores/index.ts:63-101`
**Problem:** The `appStore` object spreads all store exports into one flat namespace via object spread (`...settingsStore`, `...transportStore`, etc.). This creates a snapshot of signal getters at module-load time that never updates. Additionally:
- `isInSessionMode` and `sessionMode` are different functions returning different things
- `loadSession` had to be manually remapped (line 77) because of a name collision
- TODO at line 45 confirms this is a known migration hazard
**Fix:** Phase out `appStore.*` calls across components in favor of direct named imports from individual store files. This is tracked under the existing TODO but needs prioritization.
**Risk:** Every new feature that uses `appStore.*` accumulates tech debt.

### 3. Unbounded Memory Leak in Global Error Handler

**File:** `src/lib/global-error-handler.ts:28-47`
**Problem:** The `originalConsoleLog` override captures every `console.log`/`console.error` call into a `logs[]` array with no size limit and no periodic clearing. In production, this grows indefinitely — every render log, every debug statement, forever.
**Fix:** Add a ring-buffer cap (e.g., keep last 500 entries) or clear on a timer. Better yet, gate this behavior behind a dev-mode flag since it's an E2E debugging bridge.
**Risk:** Production memory leak affecting long-running sessions.

### 4. Duplicate Global Error Handlers

**Files:** `src/components/AppErrorBoundary.tsx:19-52`, `src/lib/global-error-handler.ts:7-51`
**Problem:** Both files attach `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)`. They write to different stores (`appError` signal vs `__globalError` E2E bridge), but both fire on every error — double-reporting and potentially confusing error UX.
**Fix:** Consolidate into one handler. `AppErrorBoundary` should be the single source of truth for error UI; `global-error-handler` should be the E2E bridge only.

### 5. Zero Accessibility Coverage — 31 of 35 Components

**Problem:** Only 4 components (`SessionMiniTimeline`, `Notifications`, `Tooltip`, `WalkthroughSelection`) have any ARIA attributes. All SVG-only buttons are invisible to screen readers. No focus traps on modals, no skip-links, no keyboard shortcut documentation.
**Affected components:** All buttons in SharedControlToolbar, AppSidebar, SettingsPanel, PianoRollCanvas, SessionEditor, CharacterIcons, WelcomeScreen, CrashModal, Walkthrough, etc.
**Fix (phased):**
- Phase 1: Add `aria-label` to all SVG-only buttons (mic, play, pause, stop, settings, etc.)
- Phase 2: Add `role="dialog"`, `aria-modal`, focus trap to modals (CrashModal, SessionSummaryCard, ScoreOverlay)
- Phase 3: Add skip-link for keyboard users, document keyboard shortcuts

---

## P1 — High Priority

### 6. Silent AudioContext Resume Failures

**Files:** `src/lib/audio-engine.ts:421,448`, `src/lib/practice-engine.ts:263`
**Problem:** Three locations call `this.resume().catch(() => {})` — empty catch silently swallowing AudioContext resume failures. If the context is in a permanently-suspended state (browser autoplay policy), the user gets no feedback.
**Fix:** Log a warning at minimum. Consider surfacing a notification: "Audio playback was blocked. Please interact with the page first."

### 7. Empty Catch in WelcomeScreen Swallows All Errors

**File:** `src/components/WelcomeScreen.tsx:26`
**Problem:** `} catch (_err) { }` — complete empty catch. If welcome audio fails, nothing happens. If the component throws for any other reason, it's silently suppressed.
**Fix:** At minimum, log the error. If audio is non-critical, use a specific check rather than a blanket empty catch.

### 8. `setTimeout` Without Cleanup in Session Sequencer

**File:** `src/features/session/useSessionSequencer.ts:172,196,267`
**Problem:** Multiple `setTimeout` calls without storing IDs for cancellation on unmount. If the component tears down between scheduling and firing, stale callbacks execute against destroyed reactive state.
**Fix:** Collect timeout IDs and clear them in `onCleanup`.

### 9. 12 Skipped Tests in Melody Library

**File:** `src/tests/melody-library.test.ts` (lines 205, 228, 251, 264, 287, 589, 600, 647, 670, 723, 1106)
**Problem:** All `.skip` tests are localStorage persistence tests. These test fundamental storage behavior but are disabled — likely the mock/storage interaction is broken.
**Fix:** Investigate and fix the `createPersistedSignal` mock so these tests pass. LocalStorage is a critical path for user data.

### 10. `user-session-store.ts` Entire File Flagged for Removal

**File:** `src/stores/user-session-store.ts:5`
**Problem:** `// FIXME: remove this file (wrong types, should be in session-store.ts!)` — an entire store file exists with the wrong types and should have been consolidated into `session-store.ts`.
**Fix:** Migrate remaining needed logic from `user-session-store.ts` into `session-store.ts`, update callers, delete the file.

### 11. Mic State Mismatch Warning

**File:** `src/lib/practice-engine.ts:196`
**Problem:** `console.warn('PracticeEngine: mic active state mismatch with AudioEngine')` — this indicates a real data consistency bug where practice-engine and audio-engine disagree on whether the mic is active.
**Fix:** Investigate root cause. Likely a race condition where one store updates the mic state before the other propagates. Consider a single source of truth for mic state.

### 12. No Store Unit Tests — 13 Stores With Zero Coverage

**Problem:** All 13 stores (`melody-store`, `settings-store`, `ui-store`, `playback-store`, `mic-store`, `recording-store`, `transport-store`, `playback-state-store`, `notifications-store`, `practice-session-store`, `user-session-store`, `walkthrough-store`, `session-store`) have zero unit tests. These hold core business logic and state transitions.
**Fix (phased):**
- Phase 1: Test settings-store (highest impact — all user preferences)
- Phase 2: Test transport-store (BPM, playback speed, count-in)
- Phase 3: Test practice-session-store (session lifecycle)
- Phase 4: Test remaining stores

---

## P2 — Medium Priority

### 13. Flaky Tests in Pitch Detector

**File:** `src/tests/pitch-detector.test.ts`
**Issues:**
- `Math.random()` used in test buffers (lines 142, 561, 795) — non-deterministic input
- `performance.now()` in "without memory leak" test (line 683) — time-sensitive, CI-dependent
- Float comparisons without tolerance (lines 58, 87, 533, etc.) — may fail on different FP implementations
**Fix:** Replace `Math.random()` with seeded deterministic data. Remove `performance.now()` assertion or use fake timers. Use `toBeCloseTo()` for float comparisons.

### 14. Mobile: Content Hidden With No Alternative Access

**File:** `src/styles/app.css` (480px, 390px breakpoints)
**Problem:** At 480px: history, stats, note-list, secondary controls, subtitle, melody pill are all `display: none` with no alternative access path. At 390px: additionally tempo, count-in, volume, speed, sensitivity are hidden. Users on small phones lose major functionality.
**Fix:** Add expandable/collapsible sections or a "more" menu for secondary controls on mobile rather than hiding them entirely.

### 15. Mobile: Hidden Scrollbar With Active Horizontal Scroll

**File:** `src/styles/app.css:2544-2547`
**Problem:** Mobile practice header uses `overflow-x: auto` combined with `scrollbar-width: none` — horizontal scrolling is active but users have no visual indicator to discover it.
**Fix:** Either show the scrollbar or add a visual hint (gradient fade at edges) to indicate scrollable content.

### 16. Touch Target Size Violations

**File:** `src/styles/app.css` — multiple locations
**Problem:** Several interactive elements are below WCAG 44px minimum touch target size:
- `.ctrl-btn` padding `6px 8px` at 390px (line 2768)
- Count-in badge: 28px
- Various `min-width: 14px` to `20px` elements
**Fix:** Increase padding on touch-target buttons at mobile breakpoints. Use `min-height: 44px` pattern.

### 17. Unused/Dead Code

| Location | Description |
|----------|-------------|
| `src/stores/index.ts:30` | `initPresets` no-op stub |
| `src/stores/session-store.ts:365-395` | Commented-out functions awaiting tests |
| `src/components/SessionEditor.tsx:30-33` | Commented-out default session fallback |
| `src/stores/settings-store.ts:366-368` | No-op `initSettings`, `initADSR`, `initReverb` stubs |

**Fix:** Remove dead code. For commented-out functions awaiting tests: either write the tests and uncomment, or delete if no longer needed.

### 18. Inconsistent Component Testing

**Problem:** 33 of 35 components have no unit tests. Only `SharedControlToolbar` and `AppErrorBoundary` are tested.
**Fix:** Start with high-impact components that contain logic (not just markup):
1. `SettingsPanel` — settings form logic, preset application
2. `AppSidebar` — visibility toggles, state wiring
3. `PitchCanvas` — arc physics (partially tested via arc-physics.test.ts, but canvas rendering is untested)

---

## P3 — Backlog / Feature Ideas

### 19. UI/UX Polish

- **Loading skeletons** — Add skeleton placeholders while melody/session data loads (currently shows empty state then populates)
- **Transition animations** — Smooth transitions when toggling sidebar panels, switching tabs, or opening modals. The current UI has abrupt show/hide
- **Empty states** — Improve empty-state messaging: "No notes yet. Create a melody in the Editor tab or load a preset."
- **Toast notification improvements** — Notifications currently stack but don't auto-dismiss consistently. Add dismiss timer + progress bar
- **Keyboard shortcut cheat sheet** — Accessible overlay (press `?`) showing all keyboard shortcuts
- **Undo toast** — Show "Undo" action in a toast after delete operations (currently immediate, no recovery)

### 20. Feature Ideas

- **Guided warmup routine** — A structured warmup mode: play ascending/descending scales with increasing range, track consistency
- **Practice streaks** — Track daily practice streaks with a simple calendar heatmap in the sidebar
- **Pitch drift visualization** — Over time, does the user consistently sing flat/sharp on certain notes? Show trend lines
- **Peer comparison (opt-in)** — Anonymous percentile rankings: "Your C4 accuracy is in the top 30% of singers"
- **Sheet music notation view** — Render the current melody as standard notation alongside the piano roll
- **Vocal range detector** — Quick test to determine the user's comfortable range, then suggest appropriate keys for melodies

### 21. Performance Optimizations

- **Canvas draw throttling** — The RAF loop in PitchCanvas currently always redraws. When nothing changes (paused, no new data), the draw could be skipped
- **Virtual scrolling for long note lists** — NoteList renders all notes; for very long melodies (100+ notes), consider virtualizing
- **Lazy-load tabs** — Currently all tab content renders. Tabs like Community, Leaderboard, Analysis could be lazy-loaded on first visit

### 22. Long-Term Refactors

- **Extract `appStore` dependency** — Replace all `appStore.*` calls with direct store imports. This is a large effort (~50+ component files) but reduces the risk of stale signal captures
- **Component test infrastructure** — Set up `@solidjs/testing-library` for component render tests
- **CSS module migration** — Move more component styles from the monolithic `app.css` (~9,400 lines) into CSS modules for better maintainability
- **State machine for playback** — Formalize the playback lifecycle (stopped → count-in → playing → paused → stopped) as a state machine to prevent impossible states

---

## Quick Wins (Under 1 Hour Each)

These can be fixed immediately for high impact-to-effort ratio:

| # | Item | Effort | Impact |
|---|------|--------|--------|
| Q1 | Fix `isInSessionMode` hardcoded `false` | 15 min | Prevents bugs |
| Q2 | Cap `global-error-handler` logs array at 500 entries | 10 min | Fixes memory leak |
| Q3 | Add `aria-label` to top 10 most-used SVG buttons | 30 min | Accessible controls |
| Q4 | Remove `initPresets` and no-op init stubs | 15 min | Code hygiene |
| Q5 | Add `.catch(err => console.warn(...))` to bare catches | 20 min | Observable errors |
| Q6 | Add `onCleanup` timeout clearing in `useSessionSequencer` | 20 min | Fixes stale callbacks |
| Q7 | Remove `global-error-handler` duplicate `window.onerror` | 15 min | Cleaner error flow |
| Q8 | Fix skipped melody-library localStorage tests | 45 min | Restore test coverage |

---

_Last updated: 2026-05-05_
_Next review: After P0 items are resolved_
