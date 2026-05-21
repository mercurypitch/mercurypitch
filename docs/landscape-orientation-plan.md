# Mobile Landscape Orientation Plan

The goal is to provide a highly usable, un-squished experience on mobile devices when held horizontally. Because vertical screen height is extremely limited in landscape mode, we will restructure the UI to maximize canvas space and fundamentally rotate the gameplay mechanics for the Piano tab.

## User Review Required

> [!WARNING]
> **Changing the Falling Notes mechanics** is a significant change. We will need to update the `FallingNotesCanvas` rendering logic to support a horizontal mode (spawning on the right, moving left).
> **Singing Mode behavior**: In landscape, should we literally trigger the existing "Focus Mode" automatically, or just use CSS to hide the tabs/header to achieve a similar effect? CSS-only is less intrusive to the app state, but triggering Focus Mode might be cleaner. I propose a pure CSS approach that mimics Focus Mode in landscape to prevent state conflicts when the user rotates back.

## Open Questions

1. **App Tabs in Landscape**: Do you want the `AppNavTabs` (Practice, Piano, Karaoke, etc.) to completely disappear in landscape mode, or should we move them to the left/right side of the screen as a vertical sidebar? 
   - *Recommendation*: Hide them entirely (auto-focus mode) so the user gets 100% canvas space, and require them to rotate back to portrait to change tabs.
2. **Falling Notes Horizontal Keyboard**: When the keyboard is on the left edge, should the keys be styled exactly like the compose editor (simple blocks), or retain their realistic piano key styling but rotated 90 degrees?
   - *Recommendation*: Draw them as simple, labeled horizontal blocks along the left edge for maximum readability.

## Proposed Changes

### Global Layout & CSS
We will add a new media query for mobile landscape devices.
```css
@media (max-width: 950px) and (orientation: landscape) and (max-height: 500px) { ... }
```

#### [MODIFY] `src/styles/app.css` & `src/components/HeaderControls.module.css`
- Apply "auto-focus mode" styling: Hide `AppNavTabs`, `AppHeader`, and minimize paddings.
- Shrink the `SharedControlToolbar` to a single ultra-compact row spanning the top.
- Ensure `#main-layout` and `.main-content` take up `100vh` to maximize canvas height.

---

### Piano Practice (Falling Notes)

#### [MODIFY] `src/components/FallingNotesCanvas.tsx`
- Add a new reactive property or CSS-driven state to detect `orientation`.
- Refactor the rendering loop:
  - **Vertical (Default)**: Pitch is X-axis, Time is Y-axis. Notes fall top-to-bottom.
  - **Horizontal (Landscape)**: Pitch is Y-axis (low notes at bottom, high at top), Time is X-axis. Notes spawn at `canvas.width` and move left towards `x = keyboardWidth`.
- Draw the piano keys vertically along the left edge of the canvas when in horizontal mode.
- Adjust particle effects and hit detection hitboxes to map to the new X/Y axes.

---

### Singing Practice

#### [MODIFY] `src/components/PitchCanvas.tsx`
- The singing canvas already scrolls right-to-left naturally!
- We simply need to ensure that the container CSS gives it maximum height.
- We will add logic to adjust the `canvas` height dynamically on orientation change so it doesn't stay squished.

---

### UvrPanel (Karaoke)

#### [MODIFY] `src/components/UvrPanel.tsx`
- In landscape, use a two-column grid:
  - Left column: The Mixer controls (stems and sliders).
  - Right column: The Audio waveform and global playback controls.

## Verification Plan

### Manual Verification
1. Open the app in Chrome/Safari DevTools.
2. Switch to an iPhone 14/15 profile and rotate the device to landscape.
3. **Singing Tab**: Verify the top bar is ultra-compact and the singing canvas takes up the entire remaining screen.
4. **Piano Tab**: Verify the piano keys render on the left, and notes travel right-to-left. Verify hit detection and particles still trigger correctly on the hit line.
5. **Karaoke Tab**: Verify the UI switches to a side-by-side layout instead of vertically stacked.
