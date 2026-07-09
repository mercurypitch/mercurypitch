# CSS Design System & Modularization — Two-Phase Plan

**Based on:** `feat/refactor-ui-design` branch foundations  
**Target branch:** `feat/polish-and-refactor`  
**Date:** 2026-06-27

---

## Phase 1: Design Tokens + Shared Primitives (Foundation)

Cherry-pick and adapt the design system foundations from `feat/refactor-ui-design`.

### 1a: Design Tokens (CSS Variables)
Add global CSS custom properties to `:root` in `src/styles/app.css`:
- `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`
- `--radius-sm`, `--radius-md`, `--radius-lg`
- `--transition-fast`, `--transition-normal`
- `--accent-glow`
- `--bg-hover`

### 1b: Shared Primitives
Migrate 3 shared components from `feat/refactor-ui-design`:
- `src/components/shared/Button.tsx` + `Button.module.css` (5 variants, 4 sizes)
- `src/components/shared/SafeSelect.tsx` + `SafeSelect.module.css`
- `src/components/shared/SegmentedControl.tsx` + `SegmentedControl.module.css`

### 1c: Progressive Adoption
Use the shared Button in a few components to validate:
- Replace `<button class="celebration-btn">` with `<Button variant="primary">`
- Replace delete confirm buttons with `<Button variant="danger">`

---

## Phase 2: Bottom-Up CSS Module Migration (Strangler Fig)

Follow the strategy from `docs/plans/css-modularization-plan.md`. Execute per-component in strict order:

### 2a: UI Primitives (low risk, isolated styles)
1. `CrashModal` → `CrashModal.module.css`
2. `ChangelogModal` → `ChangelogModal.module.css`
3. `SessionBrowser` → `SessionBrowser.module.css`
4. `SessionLibraryModal` → `SessionLibraryModal.module.css`
5. `LibraryModal` → `LibraryModal.module.css`
6. `ScaleBuilder` → `ScaleBuilder.module.css`
7. `ConfirmDialog` → shared `ConfirmDialog.module.css`

### 2b: Mid-Level Panels
8. `CommunityShare` (153 globals — highest priority)
9. `CommunityLeaderboard` (110 globals)
10. `VocalChallenges` (96 globals)
11. `PitchAlgorithmTester` (46 globals)
12. `SettingsPanel` → `SettingsPanel.module.css`
13. `NotePillSelector`, `PitchDisplay`, `ExercisePitchTracker`

### 2c: Shared Toolbar Components
14. `SharedControlToolbar` — extract CoreControls + HeaderControls from `HeaderControls.css` into module
15. `AppNavTabs` — extract tab styles from `app.css`

### 2d: Feature Slices (largest files)
16. `StemMixer` family (10 files, 300+ globals) — migrate using shared Button, SafeSelect
17. `VocalAnalysis` (134 globals) — migrate from `vocal-analysis.css`
18. `UvrPanel` family (6 files) — adopt from `feat/refactor-ui-design`

### 2e: App Shell
19. `App.tsx` → remaining classes extracted
20. `AppSidebar.tsx` → remaining classes extracted

### 2f: The Final Purge
- Remove `restored-legacy.css` (~5,300 lines)
- Remove `vocal-analysis.css` (~386 lines) — adopted from design branch
- Remove `uvr.css` (~520 lines) — adopted from design branch
- Shrink `app.css` from 2,440 to ~300 lines (only tokens, resets, body)
- Shrink `daily-routine.css` and `exercises.css`

---

## Reuse from `feat/refactor-ui-design`

| Asset | Source | Action |
|-------|--------|--------|
| `Button.tsx` + `.module.css` | design branch | Cherry-pick directly |
| `SafeSelect.tsx` + `.module.css` | design branch | Cherry-pick directly |
| `SegmentedControl.tsx` + `.module.css` | design branch | Cherry-pick directly |
| UVR component modules (6 files) | design branch | Cherry-pick or re-migrate |
| `capture-styles.mjs` script | design branch | Cherry-pick for automation |
| `apply-css-modules.js` script | design branch | Cherry-pick for automation |
| `css-modularization-plan.md` | design branch | Reference only (already adapted) |
| `css-module-refactor-audit.md` | design branch | Reference only |

## Estimated Effort

| Phase | Components | Estimated Time |
|-------|-----------|---------------|
| Phase 1 (tokens + primitives) | 3 shared components | 1-2 hours |
| Phase 2a (primitives) | 7 components | 3-4 hours |
| Phase 2b (mid panels) | 6 components | 4-6 hours |
| Phase 2c (toolbars) | 2 components | 2-3 hours |
| Phase 2d (feature slices) | ~20 components | 1-2 days |
| Phase 2e (app shell) | 2 components | 2-3 hours |
| Phase 2f (purge + CSS deletion) | 3 CSS files | 1 hour |
