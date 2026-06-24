# Phase 3: Multi-Pane Views

**Plan Date:** 2026-06-10  
**Parent:** [VA Enhancement Plans](README.md)  
**Effort:** 5-7 days  
**Dependencies:** Phase 1 (needs polished spectrogram to split into panes)

---

## Goal

Add Sonic Visualiser's multi-pane layout to MercuryPitch: independently scrollable/zoomable views (spectrogram, waveform, pitch trace) stacked vertically with synchronized time axes. Users can add, remove, resize, and configure panes.

---

## 1. Pane System Architecture

### Core Concept

A **Pane** is an independent, resizable, vertically-stacked viewport that displays one layer type. Multiple panes share a synchronized time axis — scrolling or zooming in one pane updates all others. Each pane can have its own Y-axis scale and layer configuration.

```
┌─────────────────────────────────────────────┐
│ [🎛 Add Pane ▼] [🔗 Sync] [🔄 Reset]          │  ← toolbar
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Spectrogram                    [-][⛶][×] │ │  ← Pane 1 (60% height)
│ │ ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋ │ │
│ │ ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋ │ │
│ └─────────────────────────────────────────┘ │
│ ─────────────── drag handle ──────────────── │
│ ┌─────────────────────────────────────────┐ │
│ │ Pitch Trace                     [-][×]  │ │  ← Pane 2 (40% height)
│ │ ╱╲╱╲___╱╲╱╲╱╲___╱╲╱╲                   │ │
│ └─────────────────────────────────────────┘ │
│ ─────────────── drag handle ──────────────── │
│ ┌─────────────────────────────────────────┐ │
│ │ ⏱︎ 0:00    0:05    0:10    0:15          │ │  ← Shared time ruler
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Types (`src/types/index.ts` — append)

```ts
export type PaneLayerType = 'spectrogram' | 'waveform' | 'pitch-trace' | 'cents-deviation' | 'vibrato' | 'annotation' | 'spectrum'

export interface PaneConfig {
  id: string
  layerType: PaneLayerType
  height: number          // percentage (0-100)
  collapsed: boolean
  // Layer-specific options
  options?: Record<string, unknown>
}

export interface PaneLayoutState {
  panes: PaneConfig[]
  syncTime: boolean       // synchronize time axes across panes
  syncZoom: boolean       // synchronize zoom level
  activePaneId: string | null
}
```

**Effort:** 0.5 day (types)

---

## 2. Pane Container Component

### What
A resizable vertical container that hosts multiple pane panels. Uses CSS `resize` or a custom drag-handle approach.

### Implementation

**File: `src/components/MultiPaneView.tsx`** (new)

```ts
interface MultiPaneViewProps {
  layout: PaneLayoutState
  onLayoutChange: (layout: PaneLayoutState) => void
  audioDuration: number     // total audio duration in seconds
  playheadPosition: number  // current playback position
  isPlaying: boolean
  // Data sources
  magnitudeSpectrum: Float32Array | null
  phaseSpectrum?: Float32Array | null
  pitchHistory: PitchResult[]
  centsOffset: number | null
  vibrato: VibratoResult | null
  waveformData?: Float32Array
}
```

**Features:**
- Vertical flex layout with draggable resize handles between panes.
- Each pane has a header bar: layer type icon, title, collapse/expand/fullscreen/close buttons.
- "Add Pane" dropdown to add new panes (spectrogram, waveform, pitch trace, etc.).
- Minimum pane height: 60px (enough for time ruler + one line of data).
- Collapsed panes show as a thin header bar only (like SV).
- Fullscreen mode: double-click pane header to maximize it.

**Resize handle:**
- 6px tall div between panes.
- `cursor: row-resize`.
- Drag to resize. Uses pointer events (already have pattern from ProKnob/ProFader).
- Heights stored as percentages, recalculated on container resize.

**Effort:** 2 days

---

## 3. Time Synchronization

### What
All panes scroll and zoom together when sync is enabled. The shared time ruler at the bottom shows the current time range.

### Implementation

**File: `src/components/MultiPaneView.tsx`** (within component)

- Centralized `timeRange: [number, number]` signal (visible start/end in seconds).
- Each pane reads `timeRange` and maps it to its canvas width.
- Scrolling or zooming in any pane updates the shared `timeRange`.
- Pan and zoom gestures (already partially implemented for touch) propagate to all panes.

**Sync toggle:**
- "🔗 Sync" button in toolbar. When on (default), time and zoom are synchronized.
- When off, each pane has independent scroll/zoom (like SV's "Solo" mode).

**Shared time ruler:**
- Fixed-height (24px) component at the bottom.
- Shows time ticks at adaptive intervals (1s, 5s, 10s, 30s, 1min depending on zoom).
- Playhead position shown as a red vertical line across all panes.

**Effort:** 1 day

---

## 4. Individual Pane Renderers

### What
Each pane type renders its specific visualization. These are thin wrappers around existing canvas components, adapted to receive `timeRange` and `width`/`height` from the pane container.

### Implementation

Each pane type is a separate component:

| File | Pane Type | Wraps |
|---|---|---|
| `src/components/panes/SpectrogramPane.tsx` | `spectrogram` | `SpectrogramCanvas` |
| `src/components/panes/WaveformPane.tsx` | `waveform` | New waveform renderer |
| `src/components/panes/PitchTracePane.tsx` | `pitch-trace` | New pitch line renderer |
| `src/components/panes/CentsDeviationPane.tsx` | `cents-deviation` | `CentsDeviationCanvas` |
| `src/components/panes/SpectrumPane.tsx` | `spectrum` | New instantaneous spectrum |

**WaveformPane** (new):
- Simple peak waveform renderer.
- Reads waveform data from audio buffer.
- At close zoom, shows individual samples (SV's sinc-interpolated mode can be future).
- Stereo: show two waveforms (top = left, bottom = right, different colours).

**PitchTracePane** (new):
- Scrolling pitch line chart.
- X = time, Y = MIDI note (log scale with piano keys on left — reuse from Phase 1).
- Detected pitch as a connected line.
- Target/reference pitch as a dashed overlay.
- Slide regions highlighted.

**SpectrumPane** (new):
- Instantaneous frequency spectrum at the playhead position.
- X = frequency, Y = magnitude (dB).
- Updates live during playback.
- SV-style "peak frequencies" overlay: vertical lines at detected spectral peaks.
- Like a single vertical slice through the spectrogram.

**Effort:** 2 days

---

## 5. Layout Persistence

### What
Save and restore the pane layout (which panes, their order, sizes, collapsed state).

### Implementation

**File: `src/stores/pane-layout-store.ts`** (new)

- Persist to localStorage: key `pitchperfect_pane_layout`.
- Auto-save on layout change (debounced 500ms).
- Load on mount.
- "Reset Layout" button restores default: spectrogram (60%) + pitch trace (40%).

```ts
const DEFAULT_LAYOUT: PaneLayoutState = {
  panes: [
    { id: 'spec', layerType: 'spectrogram', height: 60, collapsed: false },
    { id: 'pitch', layerType: 'pitch-trace', height: 40, collapsed: false },
  ],
  syncTime: true,
  syncZoom: true,
  activePaneId: 'spec',
}
```

**Effort:** 0.5 day

---

## 6. Integration with VocalAnalysis

### What
Replace the current fixed layout in VocalAnalysis with the multi-pane system.

### Implementation

**File: `src/components/VocalAnalysis.tsx`** (modify)

- In "Live" and "History" modes, the analysis area uses `MultiPaneView` instead of the current fixed card layout.
- The ProDashboard remains available as a toggle (it's a different view paradigm — mixer-style).
- Users can switch between: "Standard" (cards), "Pro" (mixer), and "Panes" (SV-style multi-pane).

**Mode toggle updated:**
```
[Standard] [Pro] [Panes]
```

**Effort:** 1 day

---

## Files Changed

| File | Operation | Description |
|---|---|---|
| `src/types/index.ts` | Modify | `PaneLayerType`, `PaneConfig`, `PaneLayoutState` |
| `src/components/MultiPaneView.tsx` | **New** | Pane container + resize + sync |
| `src/components/panes/SpectrogramPane.tsx` | **New** | Spectrogram pane wrapper |
| `src/components/panes/WaveformPane.tsx` | **New** | Waveform renderer |
| `src/components/panes/PitchTracePane.tsx` | **New** | Pitch line renderer |
| `src/components/panes/CentsDeviationPane.tsx` | **New** | Cents deviation pane |
| `src/components/panes/SpectrumPane.tsx` | **New** | Instantaneous spectrum |
| `src/stores/pane-layout-store.ts` | **New** | Layout persistence |
| `src/components/VocalAnalysis.tsx` | Modify | Add "Panes" mode |

---

## Deliverables

- [ ] Pane system types
- [ ] MultiPaneView with resizable vertical panes + drag handles
- [ ] Synchronized time axis across all panes
- [ ] Shared time ruler with playhead
- [ ] 5 pane renderers: spectrogram, waveform, pitch trace, cents deviation, spectrum
- [ ] Layout persistence (localStorage)
- [ ] "Panes" mode in VocalAnalysis (alongside Standard and Pro)
- [ ] Tests: MultiPaneView layout math, time sync edge cases

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Many canvases hurt mobile performance | Limit to max 3 visible panes on mobile; collapse extras |
| Sync state drift between panes | Use single source of truth (`timeRange` signal); all panes derive from it |
| Complex resize logic | Use percentage-based heights; debounce resize events |
| Canvas width recalculation | Invalidate on container resize via ResizeObserver |
