# StemMixer — Time Window Zoom + Layout Fixes

## Context

1. StemMixer viz sections should fill available height proportionally (currently constrained too tight)
2. On longer tracks, pitch pills and waveform are too zoomed out — need a scrolling time window like a DAW
3. User wants zoom control (20s–60s) with mouse wheel support
4. Broken X button in UvrPanel header that does nothing (no `onClose` prop passed, so it's a no-op)

## Root Cause: DPR Transform Accumulation

The three canvas draw functions call `ctx.scale(dpr, dpr)` on **every animation frame** without resetting the transform first. This compounds the DPR scaling: after N frames the canvas is scaled by `dpr^N`, causing the progressive visual shrinking the user observed during playback.

**Fix**: Replace `ctx.scale(dpr, dpr)` with `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` in all three draw functions.

## Implementation Plan

### 1. Remove broken X button from UvrPanel header

**File**: `src/components/UvrPanel.tsx`

- Delete `closePanel` function
- Delete the close button JSX (the one in `.panel-header`, not the modal close buttons)
- Keep `X` import — still used by guide modal and settings modal close buttons

### 2. Add time window state to StemMixer

**File**: `src/components/StemMixer.tsx`

New signals:
```ts
const [windowDuration, setWindowDuration] = createSignal(30)  // seconds, range 20-60
const [windowStart, setWindowStart] = createSignal(0)         // start of visible window
```

When `windowStart` + `windowDuration` exceeds `duration()`, clamp: draw functions handle partial windows naturally.

### 3. Auto-scroll logic in tick()

In the RAF `tick()` function, after updating `elapsedTime` and before draw calls:

```ts
const winDur = windowDuration()
const winStart = windowStart()
const playheadInWindow = elapsedTime - winStart

// Slide window when playhead passes 40% of visible area, keep it at ~30%
if (playheadInWindow > winDur * 0.4) {
  const newStart = elapsedTime - winDur * 0.3
  setWindowStart(Math.max(0, newStart))
}
```

Also: when `elapsedTime` nears the end of the track, stop sliding so the window stays anchored.

### 4. Modify drawWaveformOverview()

Map `[windowStart, windowStart + windowDuration]` → full canvas width instead of `[0, duration()]` → full canvas width.

Sample indexing — only iterate samples within the visible window:
```ts
const totalSamples = data.length
const visibleStart = Math.floor((windowStart() / duration()) * totalSamples)
const visibleEnd = Math.min(totalSamples, Math.floor(((windowStart() + windowDuration()) / duration()) * totalSamples))
const visibleSamples = visibleEnd - visibleStart
const step = Math.max(1, Math.floor(visibleSamples / w / WAVEFORM_RESOLUTION))
```

Playhead:
```ts
const px = ((elapsed() - windowStart()) / windowDuration()) * w
```

### 5. Modify drawPitchCanvas()

Filter pills to only those overlapping the visible window, remap X:
```ts
const winStart = windowStart()
const winEnd = winStart + windowDuration()

for (const g of pillGroups) {
  if (g.endTime < winStart || g.startTime > winEnd) continue
  const x1 = Math.max(0, ((g.startTime - winStart) / windowDuration()) * w)
  const x2 = Math.min(w, ((g.endTime - winStart) / windowDuration()) * w)
  // ... draw pill as before
}
```

Playhead and current pitch dot:
```ts
const x = ((elapsed() - winStart) / windowDuration()) * w
```

### 6. drawLiveWaveform()

No changes — it shows instantaneous analyser data, no time axis.

### 7. Zoom control in transport bar

Add between play button and progress area:
```html
<div class="sm-zoom-control">
  <button class="sm-zoom-btn" onClick={() => adjustZoom(-5)} title="Zoom in (shorter window)">-</button>
  <span class="sm-zoom-value">{windowDuration()}s</span>
  <button class="sm-zoom-btn" onClick={() => adjustZoom(5)} title="Zoom out (longer window)">+</button>
</div>
```

CSS for compact +/- buttons.

### 8. Mouse wheel zoom

Add `onWheel` to `.sm-viz` container:
```ts
const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  setWindowDuration(prev => Math.min(60, Math.max(20, prev + (e.deltaY > 0 ? 5 : -5))))
}
```

### 9. Height — proportional fill

Change viz section CSS to fill available space proportionally while keeping live waveform fixed:
```css
.sm-viz-overview { flex: 2; min-height: 70px; }
.sm-viz-live { flex: 0 0 auto; height: 90px; min-height: 50px; }
.sm-viz-pitch { flex: 3; min-height: 100px; }
```

### 10. Reset on stop

In `handleStop()`, add `setWindowStart(0)`.

### Files to modify

| File | Changes |
|------|---------|
| `src/components/UvrPanel.tsx` | Remove X close button + closePanel function |
| `src/components/StemMixer.tsx` | Time window state, auto-scroll, modified draws, DPR fix, zoom UI, wheel handler, height CSS, stop reset |

### Verification

1. `npm run typecheck` — no errors
2. `npm run build` — builds cleanly
3. Load mixer with 2+ min audio — only ~30s visible, scrolls as playhead advances
4. Mouse wheel over viz adjusts zoom (20s–60s)
5. Zoom buttons in transport bar work
6. Stop/restart resets window to 0
7. Sections fill panel height proportionally, no overflow scroll
8. No progressive shrinking during playback (DPR fix)
9. X button removed from UvrPanel header
