# MercuryPitch -- Roadmap & Feature Ideas

A living list of proposed features, improvements, and known issues.

---

## Accessibility

- [ ] **ARIA labels for SVG buttons** -- Add `aria-label` to all icon-only buttons (mic, play, pause, stop, settings, etc.)
- [ ] **Modal focus traps** -- Add `role="dialog"`, `aria-modal`, and focus trapping to modals
- [ ] **Keyboard shortcut cheat sheet** -- Accessible overlay (press `?`) documenting all keyboard shortcuts
- [ ] **Skip link** -- Add a skip-to-main-content link for keyboard users

---

## Mobile & Responsive

- [ ] **Hidden content alternatives** -- At 480px/390px breakpoints, add expandable sections or a "more" menu for hidden controls
- [ ] **Touch target sizes** -- Increase interactive elements to meet WCAG 44px minimum at mobile breakpoints
- [ ] **Horizontal scroll indicators** -- Add visual gradient fade to indicate scrollable areas
- [ ] **CSS module responsive styles** -- Extend responsive styles to component CSS modules

---

## Testing

- [ ] **Store unit tests** -- Add tests for settings-store, transport-store, practice-session-store, and other stores
- [ ] **Component tests** -- Add render tests for high-impact components: SettingsPanel, AppSidebar, PitchCanvas
- [ ] **Fix skipped melody-library tests** -- 12 localStorage persistence tests are `.skip`'d
- [ ] **Fix flaky pitch-detector tests** -- Replace `Math.random()` with seeded data, use `toBeCloseTo()` for float comparisons
- [ ] **E2E test for mobile breakpoints** -- Playwright tests verifying mobile layout at 480px/390px

---

## Performance

- [ ] **Canvas draw throttling** -- Skip PitchCanvas RAF redraw when nothing has changed (paused, no new pitch data)
- [ ] **Virtual scrolling for NoteList** -- For 100+ note melodies, virtualize the note list rendering
- [ ] **Lazy-load tabs** -- Defer loading of Community, Leaderboard, Analysis, Challenges tabs until first visit
- [ ] **Global error handler memory leak** -- Cap `logs[]` array in `global-error-handler.ts` at 500 entries

---

## Bug Fixes

- [ ] **Mic state mismatch warning** -- `practice-engine.ts` warns of mic active state mismatch with audioEngine
- [ ] **Silent AudioContext resume failures** -- Three locations swallow resume errors with empty `.catch(() => {})`
- [ ] **Empty catch in WelcomeScreen** -- `catch (_err) { }` silently swallows all errors
- [ ] **Duplicate error handlers** -- Both `AppErrorBoundary.tsx` and `global-error-handler.ts` attach `window.onerror`/`unhandledrejection` handlers

---

## Code Quality

- [ ] **Phase out `appStore` monolith** -- Replace `appStore.*` calls with direct named store imports (~50 component files)
- [ ] **Remove dead code** -- `initPresets` no-op, commented-out session functions, no-op init stubs
- [ ] **Playback state machine** -- Formalize playback lifecycle (stopped -> count-in -> playing -> paused -> stopped)
- [ ] **Copy/paste notes** -- Finish multi-select note copy/paste in the piano roll editor

---

## Feature Ideas

- [ ] **Pitch drift visualization** -- Show trend lines for consistently flat/sharp notes over time
- [ ] **Sheet music notation view** -- Render melody as standard notation alongside piano roll
- [ ] **Loading skeletons** -- Skeleton placeholders while melody/session data loads
- [ ] **Transition animations** -- Smooth transitions for sidebar panels, tab switches, modal open/close
- [ ] **Undo toast** -- Show "Undo" action in toast notifications after destructive operations
- [ ] **Cloud preset sync** -- Save and load presets to/from a server (optional authentication)

---

_Last updated: 2026-06-09_
