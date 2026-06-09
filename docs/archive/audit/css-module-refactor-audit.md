# CSS Module Refactor Audit Report

**Date:** 2026-05-19
**Branch audited:** `main` + `feat/shazam-sing` (as of latest pull)
**Scope:** CSS module refactor aftermath, PR #65 reviewer comments, and Shazam Sing implementation

---

## Summary

The CSS module migration (PR #65) partially converted the codebase from global kebab-case class names to camelCase CSS module bindings. The migration is **incomplete**. Several components continue to use raw string class names that depend on global stylesheets, while the module counterparts exist in parallel, creating a fragile dual-system. A number of these global classes are still defined and work, but the inconsistency introduces maintainability debt and several concrete visual regressions.

---

## Part 1 — CSS Module Refactor Issues

### Issue 1.1 — Mixed class binding strategy in `SharedControlToolbar.tsx` (HIGH)

**File:** `src/components/shared/SharedControlToolbar.tsx`

The component imports `styles from '../HeaderControls.module.css'` and uses camelCase module bindings for some elements (`styles.ctrlBtn`, `styles.countinBadge`, `styles.cyclesControlGroup`, `styles.inlineControlsRow`, etc.), but also hard-codes global kebab-case class strings for many others in the same render tree:

| Element | Module binding used | Global string used |
|---|---|---|
| Play button | `styles.ctrlBtn` | `'play-btn'` (joined) |
| Pause/Stop button | `styles.ctrlBtn` | `'stop-btn'` (joined) |
| Focus button | `styles.ctrlBtn` | `'focus-btn'` (joined) |
| Stop button (main) | _(none)_ | `'ctrl-btn stop-btn stop inactive'` |
| MIDI button | _(none)_ | `'ctrl-btn midi-btn active'` |
| Wave toggle button | _(none)_ | `'ctrl-btn wave-btn active'` |
| Record button | _(none)_ | `'ctrl-btn record-btn recording'` |
| Anchor tone button | _(none)_ | `'ctrl-btn anchor-tone-btn active'` |
| Metronome button | _(none)_ | `'ctrl-btn metronome-btn active'` |
| Mode buttons | _(none)_ | `'mode-btn active'` |
| Root wrapper | _(none)_ | `'practice-header-bar'` |
| Essential group | _(none)_ | `'essential-controls'`, `'essential-control-group'` |
| Secondary group | _(none)_ | `'secondary-controls'` |
| Separator div | _(none)_ | `'app-header-sep'` |
| Control group | _(none)_ | `'control-group'`, `'mic-group'` |
| Spaced rest select | _(none)_ | `'dropdown-select-style spaced-rest-select'` |
| Zoom group | _(none)_ | `'zoom-group'`, `'roll-zoom-btn'`, `'zoom-label'` |
| Label toggle group | _(none)_ | `'label-toggle-group'` |

**Why it matters:** The global classes in `HeaderControls.css` and `app.css` still define these, so most render correctly for now, but the system is split across three files for the same component's styles (`HeaderControls.css`, `HeaderControls.module.css`, and `app.css`). The PR reviewer (`Komediruzecki`) flagged exactly this inconsistency.

**Fix:** Either complete the conversion (move all global toolbar classes into the module, or into a `:global` block within it), or establish a documented pattern that all toolbar-style components follow: import only the module and use `styles.*` everywhere; use `:global` sparingly for classes that must be set from outside the component.

---

### Issue 1.2 — `CoreControls.tsx` mixing module and global class names (HIGH)

**File:** `src/components/shared/CoreControls.tsx` — the file flagged in PR #65, line 44

The component imports `styles from '../HeaderControls.module.css'` and uses `styles.ctrlBtn` for base styling, but then joins raw string classes `'play-btn'` and `'stop-btn'` onto the same elements:

```tsx
// Line 44 — play button
class={[styles.ctrlBtn, 'play-btn'].join(' ')}

// Line 57 — pause button
class={[styles.ctrlBtn, 'stop-btn'].join(' ')}

// Line 82 — stop button (no module class at all)
class={`ctrl-btn stop-btn stop ${isActive() ? '' : 'inactive'}`}
```

The variant-specific styles for `.ctrl-btn.play-btn` and `.ctrl-btn.stop-btn` live in `HeaderControls.css` (global). After the module refactor, the module defines `.playBtn` and `.stopBtn` separately. However, `CoreControls` does not apply `styles.playBtn` or `styles.stopBtn` — it applies `'play-btn'` (global). If the global file is removed in a future step, the green/red border tinting on these buttons breaks.

This is the exact issue the reviewer asked to be fixed.

**Fix:** Replace the joined-string pattern with proper module class application:
```tsx
// Before
class={[styles.ctrlBtn, 'play-btn'].join(' ')}

// After
class={[styles.ctrlBtn, styles.playBtn].join(' ')}
```
Apply the same for `stopBtn`, `focusBtn`. The stop button on line 82 must also be converted to use `styles.ctrlBtn`, `styles.stopBtn`, and the `inactive` conditional state via `classList`.

---

### Issue 1.3 — `TransportControls.tsx` using raw `ctrl-btn` class (MEDIUM)

**File:** `src/components/TransportControls.tsx` (lines 41, 59)

The component applies `class="ctrl-btn"` as a literal string without importing any CSS module. It relies entirely on the global `.ctrl-btn` definition in `HeaderControls.css`. This is inconsistent with the refactored siblings.

**Fix:** Import `styles from './HeaderControls.module.css'` and use `styles.ctrlBtn`.

---

### Issue 1.4 — `SessionPlayer.tsx` using raw global class names (MEDIUM)

**File:** `src/components/SessionPlayer.tsx` (lines 126, 133)

Uses `class="ctrl-btn session-skip-btn"` and `class="ctrl-btn session-end-btn"` as literal strings. The session-skip and session-end variants are not defined in the module or in any CSS file — they rely on `.ctrl-btn` base only.

**Fix:** Import and use the module, add `sessionSkipBtn` / `sessionEndBtn` classes to `SessionPlayer.module.css`.

---

### Issue 1.5 — Settings panel does not scroll on desktop (HIGH — user-reported)

**Files:** `src/App.tsx` (line 1527), `src/styles/app.css` (line 866), `src/components/SettingsPanel.module.css`

The layout chain on desktop:

```
.main-content  ← overflow: hidden forced at >=768px (app.css line 866)
  #settings-panel  ← no height or overflow set
    .settingsPanel  ← overflow-y: auto; height: 100% (module)
      .settingsContent  ← max-width: 600px
```

`app.css` line 866 adds `@media (min-width: 768px) { .main-content { overflow: hidden; } }`. On desktop, `main-content` clips all overflow. The `.settingsPanel` module class has `overflow-y: auto` and `height: 100%` — but `height: 100%` requires all ancestors to have explicit heights. `#settings-panel` has none, so the overflow container collapses and scrolling is impossible.

**Fix option A:** Add to `app.css`:
```css
#settings-panel {
  height: 100%;
  overflow-y: auto;
}
```

**Fix option B:** Add a CSS exception for the settings tab:
```css
@media (min-width: 768px) {
  .main-content:has(#settings-panel) {
    overflow: auto;
  }
}
```

---

### Issue 1.6 — `SettingsPanel.module.css` has duplicate rule blocks (LOW)

**File:** `src/components/SettingsPanel.module.css`

Duplicate rule blocks:

- `.keymapTable` defined at line 67 and again at line 161 (different properties; second wins, first is dead)
- `.keymapRow` defined at line 74 and again at line 168
- `.settingsRow input[type='number']` and its pseudo-element selectors appear twice identically (lines 237-261 and 343-367)

This likely occurred during the extraction/copy process of the refactor.

**Fix:** Remove the first `.keymapTable` / `.keymapRow` block (lines 67-110) which is the less complete version. Remove the second duplicate `.settingsRow input[type='number']` block (lines 343-367).

---

### Issue 1.7 — `input-number-dark` class used but not defined anywhere (LOW)

**File:** `src/components/SettingsPanel.tsx` (line 305)

```tsx
<input class={'input-number-dark'} type="number" id="band-perfect" ... />
```

The class `input-number-dark` is not defined in any stylesheet in the codebase. This is a dead class reference. The element relies on whatever base styles the browser applies, plus `.settingsRow input[type='number']` context styles if it is inside a `.settingsRow` — which it is (line 302).

**Fix:** Remove the `class={'input-number-dark'}` prop. The context selector in the module already applies the correct styling.

---

### Issue 1.8 — `package-lock.json` present in repository (LOW — PR #65 comment)

**Status:** PR #65 reviewer comment on `package-lock.json` line 1:

> "we use different lock file (pnpm) now, so this file change is irrelevant, and package-lock.json should not be in repo/main branch."

**Current state:** `/home/maff/foss/mercurypitch/package-lock.json` exists on the current branch. It is not in `.gitignore`.

**Fix:**
1. Add `package-lock.json` to `.gitignore`
2. Remove from tracking: `git rm --cached package-lock.json`

---

### Issue 1.9 — `styles.optLabel` referenced but not defined in module (MEDIUM)

**File:** `src/components/shared/SharedControlToolbar.tsx` (lines 484, 519, 543)

```tsx
<label class={`${styles.optLabel} ${styles.cyclesLabel}`}>
```

`styles.optLabel` is referenced, but `.optLabel` is not defined as a standalone class in `HeaderControls.module.css`. The module contains `.inlineControl :global(.optLabel)` (line 895) which hides `.optLabel` elements inside `.inlineControl`, but there is no `.optLabel { ... }` class rule. After module scoping, `styles.optLabel` will be an undefined reference — it resolves to `undefined` in the styles object, producing a literal `"undefined"` string in the class attribute in some bundler configurations, or simply nothing.

**Fix:** Add `.optLabel { ... }` to `HeaderControls.module.css` with the desired label styling, or replace `styles.optLabel` usages with the already-defined `styles.controlLabel`.

---

### Issue 1.10 — `PitchTestingTab.tsx` using raw `control-group` class (LOW)

**File:** `src/components/PitchTestingTab.tsx` (lines 707, 760, 789, 821, 868, 952)

Multiple uses of `class="control-group"` as a raw string. The `.control-group` class is defined in `HeaderControls.css`. Not part of the original refactor scope but inconsistent with the direction.

---

## Part 2 — PR #65 Reviewer Comments Status

PR: https://github.com/mercurypitch/mercurypitch/pull/65
Reviewer: Komediruzecki (two review passes, both COMMENTED state)

### Comment 1 — `CoreControls.tsx` line 44

> "please use the agreed approach of importing global css styles, as css module and accessing shared css selectors like that. Should apply for all such cases. And make sure that this play-btn and similar, is actually proper style matched like it was before."

**Status: NOT FIXED.**

`CoreControls.tsx` still joins `'play-btn'` and `'stop-btn'` as raw strings. The stop button on line 82 does not use the module at all. See Issue 1.2.

### Comment 2 — `package-lock.json` line 1

> "we use different lock file (pnpm) now, so this file change is irrelevant, and package-lock.json should not be in repo/main branch."

**Status: NOT FIXED.**

`package-lock.json` still exists in the repository and is not gitignored. See Issue 1.8.

---

## Part 3 — Shazam Sing Implementation Audit

Branch: `feat/shazam-sing`
Files reviewed: `ShazamListen.tsx`, `ShazamListen.module.css`, `melody-matcher.ts`, `types.ts`

### Finding 3.1 — CSS module usage correct and consistent (PASS)

`ShazamListen.tsx` imports `styles from './ShazamListen.module.css'` and uses only camelCase module bindings throughout. No raw class strings. Correct pattern.

### Finding 3.2 — `classList` non-null assertions on module class names (LOW)

**File:** `src/components/ShazamListen.tsx` (lines 403, 412, 424)

```tsx
classList={{ [styles.speechToggleOn!]: speechEnabled() }}
classList={{ [styles.debugToggleOn!]: showDebug() }}
classList={{ [styles.listening!]: listenState() === 'listening' }}
```

The `!` non-null assertions are used because the CSS module type declaration (`css-module.d.ts`) declares all classes as `string | undefined`. The assertions work at runtime since LightningCSS always emits values for defined classes, but the pattern is a code smell. If the class name is ever typo'd in the CSS file, the runtime will silently fail to apply the class rather than throwing.

**Fix (low priority):** Use conditional rendering or verify the class exists via a defined type.

### Finding 3.3 — `matchPitchContourWithMeta` `hummingNormalized` field is redundant/ambiguous (MEDIUM)

**File:** `src/lib/shazam/melody-matcher.ts` (lines 181-189)

`hummingNormalized` is already stored on each `MatchCandidate` object. The wrapper function additionally surfaces it as a top-level response field by reading only the top candidate's value. This creates ambiguity: the top-level field does not represent all candidates, only the first.

`ShazamListen.tsx` passes this to `props.onMatch` and it is used in `ShazamResults` for display purposes. The current behavior is correct for the primary use case (show a note when humming normalization helped the top match), but the design is unclear.

**Fix (optional):** Either remove `hummingNormalized` from the wrapper return type (let callers read it from `candidates[0]`), or document the semantic explicitly.

### Finding 3.4 — IOI reconstruction after downsampling uses constant durations (LOW)

**File:** `src/lib/shazam/melody-matcher.ts` (lines 43-51)

When `noteSeq.length > 60`, the sequence is downsampled. The IOI sequence is then rebuilt using a constant `contour.durationSec / noteSeq.length` for every interval, discarding actual rhythmic variation. This reduces rhythm-score discriminative power for long inputs.

Acceptable approximation for current use. Filed for future improvement if long-query matching quality is a concern.

### Finding 3.5 — Possible stuck `'listening'` state on early buffer-null return (LOW)

**File:** `src/components/ShazamListen.tsx` (lines 210-226)

```ts
function handleStop() {
  if (speechRecognizer) { ... }
  if (!buffer) return  // state stays as-is
  ...
  setListenState('processing')
}
```

If `buffer` is null when `handleStop` is called (e.g., race with cleanup), the listen state is not reset. In the current flow, `handleCancel` sets state to `'idle'` before clearing buffer, so the race is unlikely. Defensive fix: `setListenState('idle')` on the early return path.

### Finding 3.6 — AudioEngine registered before mic permission (LOW)

**File:** `src/components/ShazamListen.tsx` (lines 104-108)

`audioEngine.init()` and `audioRegistry.register()` are called unconditionally in `onMount`, before the user grants mic permission. Benign but slightly wasteful if the user never actually presses the mic button.

---

## Priority Summary

| # | Severity | File(s) | Issue |
|---|---|---|---|
| 1.5 | HIGH | `App.tsx`, `app.css`, `SettingsPanel.module.css` | Settings tab does not scroll on desktop |
| 1.2 | HIGH | `CoreControls.tsx` | PR #65 comment unfixed: raw `play-btn`/`stop-btn` strings |
| 1.1 | HIGH | `SharedControlToolbar.tsx` | Pervasive mixed module/global class pattern throughout toolbar |
| 1.8 | HIGH | repo root | `package-lock.json` not removed; PR #65 comment unfixed |
| 1.9 | MEDIUM | `SharedControlToolbar.tsx` | `styles.optLabel` undefined in module |
| 1.3 | MEDIUM | `TransportControls.tsx` | Raw `ctrl-btn` string, no module import |
| 1.4 | MEDIUM | `SessionPlayer.tsx` | Raw `ctrl-btn session-skip-btn` strings |
| 3.3 | MEDIUM | `melody-matcher.ts` | `hummingNormalized` wrapper field ambiguity |
| 1.6 | LOW | `SettingsPanel.module.css` | Duplicate rule blocks |
| 1.7 | LOW | `SettingsPanel.tsx` | `input-number-dark` class not defined anywhere |
| 1.10 | LOW | `PitchTestingTab.tsx` | Raw `control-group` class |
| 3.2 | LOW | `ShazamListen.tsx` | Non-null assertions on module class keys |
| 3.4 | LOW | `melody-matcher.ts` | Uniform IOI approximation after downsampling |
| 3.5 | LOW | `ShazamListen.tsx` | Possible stuck `'listening'` state on early buffer-null return |
| 3.6 | LOW | `ShazamListen.tsx` | AudioEngine registered before mic permission granted |
