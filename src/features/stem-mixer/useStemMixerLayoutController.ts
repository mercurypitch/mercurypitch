// ============================================================
// StemMixer Layout Controller — workspace layout, drag/reorder, resize
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'

// ── Types ──────────────────────────────────────────────────────

export interface WorkspacePanel {
  id: 'overview' | 'live' | 'pitch' | 'midi' | 'controls' | 'lyrics'
  label: string
  order: number
  height: number | null
}

export type WorkspaceLayout = 'auto-1col' | 'auto-2col' | 'fixed-2col'

interface CanvasView {
  syncCanvasSizes: () => void
  drawWaveformOverview: () => void
  drawLiveWaveform: () => void
  drawPitchCanvas: () => void
  drawMidiCanvas: () => void
}

export interface StemMixerLayoutDeps {
  getWorkspaceRef: () => HTMLDivElement | undefined
  canvas: CanvasView
}

export interface StemMixerLayoutController {
  // Signals
  workspaceLayout: Accessor<WorkspaceLayout>
  setWorkspaceLayout: Setter<WorkspaceLayout>
  sidebarHidden: Accessor<boolean>
  setSidebarHidden: Setter<boolean>
  fixedPanelHeights: Accessor<Record<string, number>>
  setFixedPanelHeights: Setter<Record<string, number>>
  panels: Accessor<WorkspacePanel[]>

  // Helpers
  getPanel: (id: string) => WorkspacePanel
  panelStyle: (id: string) => { order: number; height?: string }
  reorderPanels: (fromId: string, toOrder: number) => void

  // Drag-to-reorder
  handlePanelDragStart: (
    panelId: string,
    panelOrder: number,
    e: PointerEvent,
  ) => void
  handlePanelDragMove: (e: PointerEvent) => void
  handlePanelDragEnd: (e: PointerEvent) => void

  // Resize (grid layout)
  handleResizeStart: (panelId: string, e: PointerEvent) => void
  handleResizeMove: (e: PointerEvent) => void
  handleResizeEnd: (e: PointerEvent) => void

  // Resize (fixed-2col)
  handleFixedResizeStart: (panelId: string, e: PointerEvent) => void
  handleFixedResizeMove: (e: PointerEvent) => void
  handleFixedResizeEnd: (e: PointerEvent) => void

  // Document-level event wiring (for onMount)
  docResizeMove: (e: PointerEvent) => void
  docResizeEnd: (e: PointerEvent) => void
}

// ── Constants ──────────────────────────────────────────────────

const WORKSPACE_STORE_KEY = 'pitchperfect_workspace_prefs'

const defaultPanels: WorkspacePanel[] = [
  { id: 'overview', label: 'Waveform Overview', order: 0, height: 180 },
  { id: 'live', label: 'Live Waveform', order: 1, height: 180 },
  { id: 'pitch', label: 'Vocal Pitch', order: 2, height: 200 },
  { id: 'midi', label: 'MIDI Melody', order: 3, height: 200 },
  { id: 'controls', label: 'Stem Controls', order: 4, height: null },
  { id: 'lyrics', label: 'Lyrics', order: 5, height: null },
]

// ── Controller ─────────────────────────────────────────────────

export const useStemMixerLayoutController = (
  deps: StemMixerLayoutDeps,
): StemMixerLayoutController => {
  // ── Persistent prefs ──────────────────────────────────────────
  const savedPrefs = (() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORE_KEY)
      if (raw !== null) return JSON.parse(raw)
    } catch {
      /* localStorage not available */
    }
    return null
  })()

  // ── Signals ───────────────────────────────────────────────────
  const [workspaceLayout, setWorkspaceLayout] = createSignal<WorkspaceLayout>(
    (savedPrefs?.layout as WorkspaceLayout) ?? 'auto-2col',
  )
  const [sidebarHidden, setSidebarHidden] = createSignal<boolean>(
    (savedPrefs?.sidebarHidden as boolean | undefined) ?? false,
  )
  const [fixedPanelHeights, setFixedPanelHeights] = createSignal<
    Record<string, number>
  >({
    overview: savedPrefs?.heights?.overview ?? 180,
    live: savedPrefs?.heights?.live ?? 180,
    pitch: savedPrefs?.heights?.pitch ?? 260,
    midi: savedPrefs?.heights?.midi ?? 200,
  })
  const [panels, setPanels] = createSignal<WorkspacePanel[]>(defaultPanels)

  // Persist workspace prefs whenever they change
  createEffect(() => {
    const layout = workspaceLayout()
    const hidden = sidebarHidden()
    const heights = fixedPanelHeights()
    try {
      localStorage.setItem(
        WORKSPACE_STORE_KEY,
        JSON.stringify({ layout, sidebarHidden: hidden, heights }),
      )
    } catch {
      /* storage full */
    }
  })

  // ── Helpers ───────────────────────────────────────────────────
  const getPanel = (id: string) => panels().find((p) => p.id === id)!

  const panelStyle = (id: string) => {
    const p = getPanel(id)
    return {
      order: p.order,
      ...(p.height !== null ? { height: `${p.height}px` } : {}),
    }
  }

  const reorderPanels = (fromId: string, toOrder: number) => {
    setPanels((prev) => {
      const next = prev.map((p) => ({ ...p }))
      const fromIdx = next.findIndex((p) => p.id === fromId)
      if (fromIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toOrder, 0, moved)
      return next.map((p, i) => ({ ...p, order: i }))
    })
  }

  const redrawCanvases = () => {
    requestAnimationFrame(() => {
      deps.canvas.syncCanvasSizes()
      deps.canvas.drawWaveformOverview()
      deps.canvas.drawLiveWaveform()
      deps.canvas.drawPitchCanvas()
      deps.canvas.drawMidiCanvas()
    })
  }

  const redrawCanvasesDeferred = () => {
    deps.canvas.syncCanvasSizes()
    deps.canvas.drawWaveformOverview()
    deps.canvas.drawLiveWaveform()
    deps.canvas.drawPitchCanvas()
    deps.canvas.drawMidiCanvas()
    setTimeout(() => {
      deps.canvas.syncCanvasSizes()
      deps.canvas.drawWaveformOverview()
      deps.canvas.drawLiveWaveform()
      deps.canvas.drawPitchCanvas()
      deps.canvas.drawMidiCanvas()
    }, 50)
  }

  // ── Drag state (not signals — no reactivity needed) ───────────
  let dragPanelId: string | null = null
  let dragStartOrder = -1
  let dragTargetOrder = -1

  // ── Resize drag state ─────────────────────────────────────────
  let resizePanelId: string | null = null
  let resizeStartY = 0
  let resizeStartHeight = 0

  // Fixed-2col resize state
  let fixedResizePanelId: string | null = null
  let fixedResizeStartY = 0
  let fixedResizeStartHeight = 0

  // ── Drag-to-reorder ──────────────────────────────────────────
  const handlePanelDragStart = (
    panelId: string,
    panelOrder: number,
    e: PointerEvent,
  ) => {
    if (!(e.target instanceof HTMLElement)) return
    const header = e.target.closest('.sm-panel-header') as HTMLElement | null
    if (!header) return
    e.preventDefault()
    header.setPointerCapture(e.pointerId)
    dragPanelId = panelId
    dragStartOrder = panelOrder
    dragTargetOrder = panelOrder
  }

  const handlePanelDragMove = (e: PointerEvent) => {
    if (dragPanelId === null) return
    e.preventDefault()
    const el = document.elementFromPoint(
      e.clientX,
      e.clientY,
    ) as HTMLElement | null
    if (el === null) return
    const panel = el.closest('.sm-workspace-panel') as HTMLElement | null
    if (panel === null) return
    const targetId = panel.dataset.panelId
    if (targetId === undefined || targetId === dragPanelId) return
    const targetOrder = panels().find((p) => p.id === targetId)?.order
    if (targetOrder !== undefined && targetOrder !== dragTargetOrder) {
      dragTargetOrder = targetOrder
    }
  }

  const handlePanelDragEnd = (e: PointerEvent) => {
    if (dragPanelId === null) return
    e.preventDefault()
    if (dragTargetOrder !== dragStartOrder) {
      reorderPanels(dragPanelId, dragTargetOrder)
      redrawCanvases()
    }
    dragPanelId = null
    dragStartOrder = -1
    dragTargetOrder = -1
  }

  // ── Resize handlers (grid layout) ─────────────────────────────
  const handleResizeStart = (panelId: string, e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const panel = panels().find((p) => p.id === panelId)
    if (!panel) return
    const panelEl = document.querySelector(
      `[data-panel-id="${panelId}"]`,
    ) as HTMLElement | null
    resizePanelId = panelId
    resizeStartY = e.clientY
    resizeStartHeight =
      panel.height ?? panelEl?.getBoundingClientRect().height ?? 200
    const canvasEl = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvasEl) canvasEl.style.pointerEvents = 'none'
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizeMove = (e: PointerEvent) => {
    if (resizePanelId === null) return
    e.preventDefault()
    const wref = deps.getWorkspaceRef()
    if (!wref) return
    const delta = e.clientY - resizeStartY
    const maxH = wref.clientHeight - 60
    const newHeight = Math.max(40, Math.min(maxH, resizeStartHeight + delta))
    setPanels((prev) =>
      prev.map((p) =>
        p.id === resizePanelId ? { ...p, height: newHeight } : p,
      ),
    )
    redrawCanvasesDeferred()
  }

  const handleResizeEnd = (_e: PointerEvent) => {
    if (resizePanelId === null) return
    const panelEl = document.querySelector(`[data-panel-id="${resizePanelId}"]`)
    const canvasEl = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvasEl) canvasEl.style.pointerEvents = ''
    resizePanelId = null
    redrawCanvases()
  }

  // ── Resize handlers (fixed-2col) ──────────────────────────────
  const handleFixedResizeStart = (panelId: string, e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const panelEl = document.querySelector(
      `[data-fixed-panel="${panelId}"]`,
    ) as HTMLElement | null
    fixedResizePanelId = panelId
    fixedResizeStartY = e.clientY
    const cur = fixedPanelHeights()
    fixedResizeStartHeight =
      (cur as Record<string, number>)[panelId] ??
      panelEl?.getBoundingClientRect().height ??
      200
    const canvasEl = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvasEl) canvasEl.style.pointerEvents = 'none'
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleFixedResizeMove = (e: PointerEvent) => {
    if (fixedResizePanelId === null) return
    e.preventDefault()
    const delta = e.clientY - fixedResizeStartY
    const newHeight = Math.max(40, fixedResizeStartHeight + delta)
    setFixedPanelHeights((prev) => ({
      ...prev,
      [fixedResizePanelId!]: newHeight,
    }))
    redrawCanvasesDeferred()
  }

  const handleFixedResizeEnd = (_e: PointerEvent) => {
    if (fixedResizePanelId === null) return
    const panelEl = document.querySelector(
      `[data-fixed-panel="${fixedResizePanelId}"]`,
    )
    const canvasEl = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvasEl) canvasEl.style.pointerEvents = ''
    fixedResizePanelId = null
    redrawCanvases()
  }

  // ── Document-level resize event combiners ────────────────────
  const docResizeMove = (e: PointerEvent) => {
    handleResizeMove(e)
    handleFixedResizeMove(e)
  }
  const docResizeEnd = (e: PointerEvent) => {
    handleResizeEnd(e)
    handleFixedResizeEnd(e)
  }

  return {
    workspaceLayout,
    setWorkspaceLayout,
    sidebarHidden,
    setSidebarHidden,
    fixedPanelHeights,
    setFixedPanelHeights,
    panels,
    getPanel,
    panelStyle,
    reorderPanels,
    handlePanelDragStart,
    handlePanelDragMove,
    handlePanelDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleFixedResizeStart,
    handleFixedResizeMove,
    handleFixedResizeEnd,
    docResizeMove,
    docResizeEnd,
  }
}
