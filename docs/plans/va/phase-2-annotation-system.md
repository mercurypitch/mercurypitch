# Phase 2: Annotation System

**Plan Date:** 2026-06-10  
**Parent:** [VA Enhancement Plans](README.md)  
**Effort:** 5-7 days  
**Dependencies:** Independent (annotations overlay on existing views)

---

## Goal

Add Sonic Visualiser-style annotation layers to MercuryPitch: Time Instants (labelled time points), Time Values (curves/trends), and Regions (spans). Store annotations in IndexedDB, allow import/export as CSV.

---

## 1. Data Model & Store

### Types (`src/types/index.ts` — append)

```ts
export type AnnotationType = 'instant' | 'value' | 'region'

export interface AnnotationBase {
  id: string
  type: AnnotationType
  /** Time in seconds from audio start */
  time: number
  /** Optional text label */
  label?: string
  /** User-created vs auto-generated */
  source: 'manual' | 'auto'
  createdAt: number
  sessionId?: string  // Optional link to a practice session
}

export interface TimeInstant extends AnnotationBase {
  type: 'instant'
}

export interface TimeValue extends AnnotationBase {
  type: 'value'
  /** Y-axis value (pitch, intensity, etc.) */
  value: number
  /** What the value represents */
  valueUnit: 'cents' | 'hz' | 'db' | 'midi' | 'percent'
}

export interface Region extends AnnotationBase {
  type: 'region'
  /** End time in seconds */
  endTime: number
  /** Optional value at this region */
  value?: number
  valueUnit?: 'cents' | 'hz' | 'db' | 'midi' | 'percent'
}

export type Annotation = TimeInstant | TimeValue | Region
```

### Store (`src/stores/annotation-store.ts` — new)

```ts
// Reactivity
export const [annotations, setAnnotations] = createSignal<Annotation[]>([])

// CRUD
export function addAnnotation(a: Annotation): void
export function removeAnnotation(id: string): void
export function updateAnnotation(id: string, updates: Partial<Annotation>): void
export function getAnnotationsInRange(startTime: number, endTime: number): Annotation[]

// Persistence
export function saveAnnotationsToDB(): Promise<void>     // IndexedDB
export function loadAnnotationsFromDB(): Promise<void>    // IndexedDB

// Import/Export
export function exportAnnotationsCSV(): string
export function importAnnotationsCSV(csv: string): Annotation[]
```

**IndexedDB table:** `annotations` — keyed by `id`, with index on `time`, `sessionId`, `type`.

**Effort:** 1 day

---

## 2. Annotation Rendering Layer

### What
A canvas overlay that renders annotations on top of the spectrogram, waveform, or pitch trace. Multiple annotation types are rendered differently.

### Implementation

**File: `src/components/AnnotationLayer.tsx`** (new)

Renders as a transparent `<canvas>` overlaid on the host visualization. Controlled via props:

```ts
interface AnnotationLayerProps {
  annotations: Annotation[]
  timeRange: [number, number]   // visible time window
  yRange?: [number, number]     // for value/region annotations
  width: number
  height: number
  isActive: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onCreate?: (annotation: Omit<Annotation, 'id' | 'createdAt'>) => void
}
```

**Rendering styles** (matching SV conventions):

| Type | Visual | Colour |
|---|---|---|
| Time Instant | Vertical dashed line + diamond marker at top | Cyan (#06b6d4) |
| Time Instant (selected) | Solid line + filled diamond | White |
| Time Value | Small circle at (time, value) position | Yellow (#eab308) |
| Time Value (connected) | Line connecting consecutive value points | Yellow, 2px |
| Region | Semi-transparent filled rectangle | Orange (#f97316), 20% opacity |
| Region (selected) | Orange border, 40% fill | Orange |

**Interaction:**
- Click on annotation → select (highlight)
- Double-click on empty space → create Time Instant at that position
- Drag region edges → resize
- Right-click → context menu (delete, edit label, change type)

**Effort:** 2 days

---

## 3. Annotation Controls UI

### What
A toolbar/panel for creating, editing, and managing annotations.

### Implementation

**File: `src/components/AnnotationControls.tsx`** (new)

```
┌─────────────────────────────────────┐
│ [📍] [📊] [📐]  |  [▼ Import] [▲ Export] │  ← type selector + io buttons
│─────────────────────────────────────│
│ Annotation list:                     │
│  0:32 "Breath here"           [✏️][🗑] │  ← list of annotations
│  1:15 "Chorus start"          [✏️][🗑] │
│  2:05 [value: +15¢]           [✏️][🗑] │
│  0:45–1:30 "Verse 1"          [✏️][🗑] │
└─────────────────────────────────────┘
```

Features:
- Type selector buttons: Instant | Value | Region
- Tap-to-create mode: pressing Space during playback creates a Time Instant at the playhead position
- Import CSV button → file picker
- Export CSV button → download
- List of annotations sorted by time, with inline edit/delete
- Filter by type dropdown

**Effort:** 1 day

---

## 4. Integration with Existing Views

### Where annotations appear

| Host View | Annotation Overlay | Trigger |
|---|---|---|
| SpectrogramCanvas | AnnotationLayer overlaid | Toggle in spectrogram panel |
| CentsDeviationCanvas | Time Values overlaid on deviation trace | Auto (pitch drift) |
| ProDashboard | AnnotationLayer on bottom widget | Toggle in pro dashboard |
| Standard VocalAnalysis | Annotations shown as markers on pitch history SVG | Always on |

### Tap-to-mark workflow

1. User is in VocalAnalysis live/playback mode.
2. User presses **Space** during playback → creates a Time Instant at current playhead position.
3. Toast: "Marked at 1:23. Click to label."
4. Annotation appears in the list and on all active overlays.

This matches SV's "Annotation by Tapping" feature (Enter/semicolon keys in SV, Space in MP).

**Effort:** 1 day

---

## 5. CSV Import/Export

### Export format (matching SV's CSV output)
```csv
time,type,label,value,endTime
0.523,instant,"Breath here",,
1.250,value,"Pitch dip",-15,
2.100,region,"Verse 1",,5.400
```

### Import
- Parse CSV with PapaParse or manual parsing.
- Validate each row against Annotation types.
- Show import preview (5 rows) before committing.
- Deduplicate by time (±50ms tolerance).

**Effort:** 0.5 day

---

## 6. Auto-Generated Annotations

### What
Certain analysis results automatically produce annotations that the user can edit or delete.

### Examples (implemented in later phases but store ready now)

| Analysis | Annotation Type | Trigger |
|---|---|---|
| Slide detection | Region (start→end of slide) | Auto on analysis |
| Vibrato detection | Region (start→end of vibrato) | Auto on analysis |
| Breath detection | Time Instant (breath points) | Auto on analysis |
| Section boundaries | Time Instant (verse/chorus) | Auto (Phase 5) |
| Fatigue warning | Time Instant (fatigue alert) | Auto on fatigue threshold |

Auto-annotations have `source: 'auto'` and show with a different colour (grey) until the user accepts them (click to convert to `source: 'manual'`).

**Effort:** 0.5 day (store + rendering support; actual auto-generation in Phases 4-5)

---

## Files Changed

| File | Operation | Description |
|---|---|---|
| `src/types/index.ts` | Modify | Add annotation types |
| `src/stores/annotation-store.ts` | **New** | Annotation CRUD + IndexedDB persistence + CSV |
| `src/components/AnnotationLayer.tsx` | **New** | Canvas overlay renderer |
| `src/components/AnnotationControls.tsx` | **New** | Annotation list + toolbar |
| `src/components/VocalAnalysis.tsx` | Modify | Integrate layer + controls, tap-to-mark |
| `src/components/ProDashboard/ProDashboard.tsx` | Modify | Annotation toggle |
| `src/db/services/annotation-service.ts` | **New** | IndexedDB service |

---

## Deliverables

- [ ] Annotation data model + TypeScript types
- [ ] Annotation store with IndexedDB persistence
- [ ] AnnotationLayer canvas overlay (instants, values, regions)
- [ ] AnnotationControls panel (create, edit, delete, filter)
- [ ] Tap-to-mark during playback (Space key → Time Instant)
- [ ] CSV import/export
- [ ] Auto-annotation source type (grey → click to accept)
- [ ] Integration with VocalAnalysis + ProDashboard
- [ ] Tests: store CRUD, CSV round-trip, layer rendering bounds

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Canvas overlay performance with many annotations | Only render annotations in visible time range; cap at 1000 visible |
| IndexedDB schema migrations | Use versioned DB, add migration path from v1 |
| Annotation spam (too many tap marks) | Debounce Space key (max 1 per 200ms) |
| CSV format compatibility with SV | Match SV's exact column order; test round-trip with SV-exported CSV |
