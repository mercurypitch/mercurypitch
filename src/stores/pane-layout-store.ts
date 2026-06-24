// ============================================================
// Pane Layout Store — Multi-pane layout persistence
// ============================================================

import { createPersistedSignal } from '@/lib/storage'
import type { PaneConfig, PaneLayoutState } from '@/types'

const STORAGE_KEY = 'pitchperfect_pane_layout'

export const DEFAULT_LAYOUT: PaneLayoutState = {
  panes: [
    { id: 'spec', layerType: 'spectrogram', height: 60, collapsed: false },
    { id: 'pitch', layerType: 'pitch-trace', height: 40, collapsed: false },
  ],
  syncTime: true,
  syncZoom: true,
  activePaneId: 'spec',
}

export const [paneLayout, setPaneLayout] =
  createPersistedSignal<PaneLayoutState>(STORAGE_KEY, DEFAULT_LAYOUT)

/** Reset layout to the default (spectrogram + pitch trace). */
export function resetPaneLayout(): void {
  setPaneLayout({
    ...DEFAULT_LAYOUT,
    panes: DEFAULT_LAYOUT.panes.map((p) => ({ ...p })),
  })
}

// ── Pane helpers ──────────────────────────────────────────────

let _paneIdCounter = 1

function generatePaneId(): string {
  return `pane_${Date.now()}_${_paneIdCounter++}`
}

/** Add a new pane to the layout. Returns the new pane's id. */
export function addPane(layerType: PaneConfig['layerType']): string {
  const id = generatePaneId()
  const layout = paneLayout()
  // Distribute height: take 10% from each existing pane
  const existingCount = layout.panes.filter((p) => !p.collapsed).length || 1
  const newHeight = Math.min(40, 100 / (existingCount + 1))
  const steal = newHeight / existingCount
  const panes = layout.panes.map((p) => ({
    ...p,
    height: p.collapsed ? p.height : Math.max(8, p.height - steal),
  }))
  panes.push({
    id,
    layerType,
    height: newHeight,
    collapsed: false,
  })
  setPaneLayout({ ...layout, panes, activePaneId: id })
  return id
}

/** Remove a pane by id. */
export function removePane(id: string): void {
  const layout = paneLayout()
  const panes = layout.panes.filter((p) => p.id !== id)
  if (panes.length === 0) return
  // Redistribute removed pane's height proportionally
  const removed = layout.panes.find((p) => p.id === id)
  if (removed && !removed.collapsed) {
    const active = panes.filter((p) => !p.collapsed)
    const addEach = active.length > 0 ? removed.height / active.length : 0
    panes.forEach((p) => {
      if (!p.collapsed) p.height += addEach
    })
  }
  setPaneLayout({
    ...layout,
    panes,
    activePaneId:
      layout.activePaneId === id ? panes[0].id : layout.activePaneId,
  })
}

/** Set heights for all panes (from resize handles). */
export function setPaneHeights(heights: Map<string, number>): void {
  const layout = paneLayout()
  setPaneLayout({
    ...layout,
    panes: layout.panes.map((p) => ({
      ...p,
      height: heights.get(p.id) ?? p.height,
    })),
  })
}

/** Toggle collapse of a pane. */
export function togglePaneCollapse(id: string): void {
  const layout = paneLayout()
  const panes = layout.panes.map((p) => {
    if (p.id !== id) return p
    return { ...p, collapsed: !p.collapsed }
  })
  setPaneLayout({ ...layout, panes })
}

/** Toggle time-axis sync across all panes. */
export function toggleSyncTime(): void {
  setPaneLayout({ ...paneLayout(), syncTime: !paneLayout().syncTime })
}

/** Toggle zoom sync across all panes. */
export function toggleSyncZoom(): void {
  setPaneLayout({ ...paneLayout(), syncZoom: !paneLayout().syncZoom })
}
