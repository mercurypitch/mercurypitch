# Mobile UX Improvements — v1

**Date**: 2026-05-05
**Target devices**: iPhone 13 Pro (390x844), iPhone 15 Pro (393x852), all small viewports ≤768px

---

## 1. Fix Toolbar Button Squishing on Landscape

**Problem**: On iPhone 13 Pro landscape (844px wide), the Piano practice toolbar buttons get squished thin. The Singing tab doesn't exhibit this because it has fewer essential controls.

**Root cause**: At `≥768px`, `.main-content` and `#practice-panel` have `overflow: hidden` (line 8736-8743), which prevents the toolbar's `overflow-x: auto` from working. The toolbar tries to scroll but its parent clips the overflow. Without scroll capability, flex items shrink instead.

**Fix**:
- At `≤768px`, allow `.main-content` to `overflow-x: visible` (or remove the `overflow: hidden` at `≥768px` for the header area)
- Actually the better fix: make the `.practice-header-bar` the scrollable container itself, and ensure all its children have `flex-shrink: 0`
- Already applied: `flex-shrink: 0` on `.essential-controls > *` and `.essential-control-group`
- New: Remove `flex-shrink: 1` from `.practice-header-bar` at 390px breakpoint (line 2760) — the bar itself should not shrink; if it overflows, scroll
- Key: The `overflow: hidden` on `.main-content` at ≥768px must be overridden for mobile to allow toolbar scroll

## 2. Make Tabs Horizontally Scrollable

**Problem**: On narrow screens, `#app-tabs` uses `flex-wrap: wrap` forcing tabs to break into multiple rows. This wastes vertical space and looks broken.

**Fix**:
- At `≤600px`: Change `#app-tabs` to `flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none`
- Ensure `.tab-group` has `flex-shrink: 0` so the grouped "Singing | Piano" tabs don't break apart
- Add `scrollbar-width: none` and `::-webkit-scrollbar { display: none }` for clean appearance
- Add slight padding so active tab highlight isn't clipped by the edges

## 3. Fix Hamburger Button Occluding App Name

**Problem**: At `≤768px`, `.sidebar-toggle-btn` is `position: fixed; top: 8px; left: 8px; z-index: 199` and overlays the header content. The app title "PitchPerfect" and subtitle are positioned at the header's natural left edge, so the hamburger covers them.

**Fix**:
- Add `padding-left: 56px` (hamburger width + gap) to `header` at `≤768px`
- Hamburger stays fixed top-left (better UX — always reachable)
- At very narrow widths (`≤480px`), restructure header layout:
  - `header` uses `flex-direction: column; align-items: flex-start` 
  - `.header-left` stays (app title + subtitle)
  - `.header-right` (melody pill + walkthrough) stacks below `.header-left` or within it vertically
  - `#app-tabs` stays as a separate scrollable row below

## 4. Additional Mobile Improvements

### 4a. Larger Touch Targets for Toolbar Buttons
- Already partially done: `.ctrl-btn` has `min-height: 44px; min-width: 44px` at `≤768px`
- Extend to all interactive elements in the toolbar (mode toggles, selects, sliders)
- Ensure `gap` between buttons is at least 8px at mobile to prevent mis-taps

### 4b. Hide Non-Essential Toolbar Controls at Narrow Widths
- At `≤390px`: hide secondary control groups (already partially done — tempo/volume/speed/sensitivity hidden)
- Add toggle button to show/hide secondary controls on demand ("More" button) — stretch goal

### 4c. Canvas Area Improvements
- Reduce piano keyboard height on very narrow screens to give more room to falling notes
- Ensure falling note labels remain readable at narrow widths

### 4d. Sidebar Width on Mobile
- Sidebar already uses `width: 280px; max-width: 85vw` which is fine
- Ensure sidebar doesn't require horizontal scrolling itself

---

## Implementation Order

1. **Fix toolbar squishing** (highest impact, already partially diagnosed)
2. **Make tabs scrollable** (simple CSS change, big UX win)
3. **Fix hamburger occlusion** (restructure header padding/layout)
4. **Additional improvements** (touch targets, hide non-essential, canvas tweaks)

## Verification

- Test on Chrome DevTools mobile viewport: iPhone 13 Pro (390x844), iPhone 15 Pro (393x852), responsive mode 320-900px
- Verify toolbar buttons don't squish in Piano tab at all widths
- Verify tabs scroll horizontally instead of wrapping
- Verify hamburger doesn't occlude app title
- `npm run build` — no TypeScript errors
- `npm test` — existing tests still pass
