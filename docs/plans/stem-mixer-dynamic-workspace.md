# StemMixer — Dynamic Drag-to-Reorder Workspace

## Context

The StemMixer currently has a fixed 2-column layout: visualization canvases on the left, controls/lyrics on the right. The user wants all 5 panels to be individually draggable and reorderable within a CSS grid, snapping into position on drop — similar to a reorderable dashboard.

## Approach

**Drag-to-reorder grid** using native pointer events + SolidJS signals. No new dependencies.

### Panel State

```ts
interface WorkspacePanel {
  id: 'overview' | 'live' | 'pitch' | 'controls' | 'lyrics'
  label: string
  order: number  // 0-4, determines grid placement
}
```

Default order: overview(0), live(1), pitch(2), controls(3), lyrics(4)

### Interaction Model

1. **Panel headers** (`.sm-viz-label`, `.sm-stem-header`, `.sm-lyrics-header`) become drag handles with `cursor: grab`
2. **`pointerdown`** on header: begin drag, record start position, create drag overlay
3. **`pointermove`** on document: move drag overlay preview, detect hover target position, show drop indicator (a colored bar/gap between items)
4. **`pointerup`**: if over a valid drop position, reorder panels array. Otherwise snap back to original position.
5. **Animation**: CSS `transition: transform 0.2s ease, order 0.2s` on panels for smooth reflow

### Tracking State

- `dragPanelId: string | null` — which panel is being dragged (module-level `let`)
- `dragOverOrder: number | null` — drop target position (module-level `let`)
- `dragOffset: { x: number, y: number }` — offset from pointer to panel origin
- `dragPreviewRect: DOMRect | null` — original panel bounding rect

No SolidJS signals for drag state — use raw `let` variables to avoid re-renders during drag. Only update signals on drop.

### Layout CSS

```css
.sm-workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(120px, auto);
  gap: 0.5rem;
  flex: 1;
  overflow: hidden;
  padding: 0.5rem;
  min-height: 0;
}

.sm-workspace-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #0d1117);
  border-radius: 0.5rem;
  overflow: hidden;
  min-height: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  /* Order set via inline style from signal */
}

.sm-workspace-panel.dragging {
  opacity: 0.4;
  box-shadow: 0 0 0 2px var(--fg-secondary, #8b949e);
}

.sm-workspace-panel.drag-over {
  box-shadow: 0 0 0 2px #f59e0b;
}

.sm-panel-header {
  cursor: grab;
  user-select: none;
}

.sm-panel-header:active {
  cursor: grabbing;
}
```

### Panel Content Map

Each panel ID maps to its current content section:
- `overview` → Waveform Overview canvas + `.sm-viz-label`
- `live` → Live Waveform canvas + `.sm-viz-label`
- `pitch` → Vocal Pitch canvas + `.sm-viz-label`
- `controls` → Stem strips (vocal/instrumental controls)
- `lyrics` → Lyrics panel (lines/uploader)

### Canvas Re-parenting

Moving canvases between DOM positions requires re-wiring. When a canvas panel moves in the grid, the canvas element is reparented via SolidJS's reactive DOM. The ResizeObserver already handles canvas dimension syncing on mobile — the `syncCanvasSizes()` call will fire when canvases change position. However, canvas refs (`waveformCanvasRef`, `pitchCanvasRef`, `liveWaveCanvasRef`) must still resolve. SolidJS `ref` attribute handles this as long as each canvas panel mounts the correct ref.

### Drag Feedback Loop Prevention

Canvas draw functions read `canvas.clientWidth`/`clientHeight` which are determined by CSS layout. When panels reorder, the grid reflows, which changes canvas sizes, which triggers ResizeObserver → `syncCanvasSizes()` + redraw. This is fine — it only happens once on drop, not continuously.

### Implementation Steps

1. **Add workspace state signals** (panel order array, functions to update)
2. **Create `WorkspacePanel` sub-component** — wraps each panel's content with drag handle header
3. **Rewrite `.sm-body` → `.sm-workspace`** — replace the 2-column flex layout with CSS grid
4. **Implement pointer event handlers** — drag start, move, end with visual feedback
5. **Add drop indicator** — a colored insertion bar showing where the panel will land
6. **Add CSS** — grid layout, drag states, transitions, panel styling
7. **Wire existing content** — map each panel ID to its current JSX content, including canvas refs

### Files Modified

| File | Changes |
|------|---------|
| `src/components/StemMixer.tsx` | Add panel order state, pointer event handlers, rewrite `.sm-body` to grid workspace, wrap each section as `WorkspacePanel`, add all new CSS |

No new files — the workspace logic is specific to StemMixer and small enough to inline.

### Verification

1. `npm run typecheck` — no errors
2. `npm run build` — builds cleanly
3. Open mixer → 5 panels visible in 2-column grid
4. Drag panel header → other panels show insertion indicator
5. Drop panel → panels reflow with smooth CSS transition
6. Drag panel to far end → reorders correctly
7. Canvases render correctly after any reorder (check resize observer fires)
8. Stem controls and lyrics still function after being moved
