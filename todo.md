# MercuryPitch -- Roadmap & TODO

A living list of proposed features, improvements, and known issues.
See [docs/plans/feature-proposals.md](docs/plans/feature-proposals.md) for detailed technical proposals.

---

## In Progress (on branches)

- [ ] **Guitar practice page** (`feat/guitar-practice`)
- [ ] **Vocal analysis enhancements** (`feature/vocal-analysis-enhancements`)
- [x] **Practice Intelligence** (`feat/practice-intelligence`) — adaptive difficulty engine, weakness drill generator, practice summary & trends dashboard

---

## ~~Practice Intelligence~~ ✅

- [x] **Adaptive difficulty engine** -- Auto-adjust exercise difficulty based on rolling performance (EMA of last 10 scores)
- [x] **Weakness drill generator** -- Analyze exercise history to find weak areas, generate targeted micro-drills
- [x] **Practice summary & trends dashboard** -- Post-routine summary card with sparklines, weekly/monthly trends

---

## Audio & Algorithm Improvements

- [ ] **Real-time formant visualization** -- Display F1/F2/F3 formant bands on PitchCanvas (LPC-based)
- [ ] **Microphone latency calibration wizard** -- Cross-correlate click track to measure and compensate mic delay
- [ ] **Pitch accuracy heatmap** -- Post-practice color-coded heatmap (green/yellow/red) per note, click-to-seek
- [ ] **Pitch drift visualization** -- Show trend lines for consistently flat/sharp notes over time

---

## Social & Collaboration

- [ ] **Jam room chat & reactions** -- Text chat + floating emoji reactions in P2P Jam rooms
- [ ] **Routine sharing via URL** -- Share custom routines as short URLs (reuses share-codec + KV)
- [ ] **Exercise leaderboard filtering** -- Per-exercise-type + time-range filters on leaderboard

---

## UX & Quality of Life

- [x] **Keyboard shortcut system** -- Space=play/pause, Esc=close/stop, Home=seek start, R=repeat, P=session, M=mic, Arrows=speed, ?=help overlay ✅  (1-9=tabs still pending)
- [ ] **Onboarding flow with voice type detection** -- 3-step wizard: mic test -> range detection -> recommended routine
- [ ] **Practice timer with break reminders** -- Pomodoro-style vocal rest reminders (25min/5min)
- [ ] **Theme auto-switch & accent colors** -- Follow system dark/light preference, customizable accent palette
- [ ] **Loading skeletons** -- Skeleton placeholders while melody/session data loads
- [ ] **Transition animations** -- Smooth transitions for sidebar panels, tab switches, modal open/close
- [x] **Undo toast** -- Show "Undo" action in toast notifications after destructive operations ✅

---

## New Exercise Types

- [ ] **Rhythm accuracy exercise** -- Clap/sing at exact rhythmic intervals, score timing deviation
- [ ] **Sight-singing reading exercise** -- Display notes on staff, sing without hearing them first (DTW scoring)

---

## Accessibility

- [ ] **ARIA labels for SVG buttons** -- Add `aria-label` to all icon-only buttons
- [ ] **Modal focus traps** -- Add `role="dialog"`, `aria-modal`, and focus trapping to modals
- [ ] **Keyboard shortcut cheat sheet** -- Accessible overlay documenting all shortcuts
- [ ] **Skip link** -- Add a skip-to-main-content link for keyboard users

---

## Mobile & Responsive

- [ ] **Hidden content alternatives** -- At 480px/390px breakpoints, add expandable sections or "more" menu
- [ ] **Touch target sizes** -- Increase interactive elements to WCAG 44px minimum at mobile breakpoints
- [ ] **Horizontal scroll indicators** -- Add visual gradient fade for scrollable areas
- [ ] **CSS module responsive styles** -- Extend responsive styles to component CSS modules

---

## Testing

- [ ] **Store unit tests** -- Add tests for settings-store, transport-store, practice-session-store
- [ ] **Component tests** -- Render tests for SettingsPanel, AppSidebar, PitchCanvas
- [ ] **Fix skipped melody-library tests** -- 12 localStorage persistence tests are `.skip`'d
- [ ] **Fix flaky pitch-detector tests** -- Replace `Math.random()` with seeded data
- [ ] **E2E test for mobile breakpoints** -- Playwright tests at 480px/390px

---

## Performance

- [ ] **Canvas draw throttling** -- Skip PitchCanvas RAF redraw when nothing changed
- [ ] **Virtual scrolling for NoteList** -- Virtualize for 100+ note melodies
- [ ] **Lazy-load tabs** -- Defer Community, Leaderboard, Analysis, Challenges tabs
- [x] **Global error handler memory leak** -- Cap `logs[]` array at 500 entries ✅

---

## Bug Fixes

- [x] **Mic state mismatch warning** -- `practice-engine.ts` mic state mismatch with audioEngine ✅ (throttled warning, auto-syncs)
- [x] **Silent AudioContext resume failures** -- Three locations swallow resume errors ✅ (throttled user-facing notification added)
- [x] **Empty catch in WelcomeScreen** -- ~~`catch (_err) { }` silently swallows errors~~ ✅ (verified: already handled, `_err` underscore-prefixes intentional unused var)
- [x] **Duplicate error handlers** -- ~~Both `AppErrorBoundary` and `global-error-handler` attach `window.onerror`~~ ✅ (verified: intentional — global-error-handler captures for E2E, AppErrorBoundary shows crash modal — different purposes)

---

## Code Quality

- [ ] **Phase out `appStore` monolith** -- Replace with direct named store imports (~50 files)
- [ ] **Remove dead code** -- `initPresets` no-op, commented-out session functions
- [ ] **Playback state machine** -- Formalize lifecycle (stopped -> count-in -> playing -> paused -> stopped)
- [ ] **Copy/paste notes** -- Finish multi-select note copy/paste in piano roll editor
- [ ] **Sheet music notation view** -- Render melody as standard notation alongside piano roll
- [ ] **Cloud preset sync** -- Save and load presets to/from a server (optional auth)

---

_Last updated: 2026-06-09_
