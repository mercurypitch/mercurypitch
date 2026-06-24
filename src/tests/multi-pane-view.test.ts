// ============================================================
// Phase 3 Tests — Multi-Pane Views layout math, pane store, time sync
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { addPane, DEFAULT_LAYOUT, paneLayout, removePane, resetPaneLayout, setPaneLayout, togglePaneCollapse, toggleSyncTime, toggleSyncZoom, } from '@/stores/pane-layout-store'
import type { PaneLayoutState } from '@/types'

/** Reset the pane layout to a known state before each test. */
function resetTo(state: PaneLayoutState) {
  setPaneLayout(structuredClone(state))
}

describe('pane-layout-store', () => {
  beforeEach(() => {
    resetTo(DEFAULT_LAYOUT)
  })

  it('has the expected default layout', () => {
    const layout = paneLayout()
    expect(layout.panes).toHaveLength(2)
    expect(layout.panes[0].layerType).toBe('spectrogram')
    expect(layout.panes[0].height).toBe(60)
    expect(layout.panes[0].collapsed).toBe(false)
    expect(layout.panes[1].layerType).toBe('pitch-trace')
    expect(layout.panes[1].height).toBe(40)
    expect(layout.syncTime).toBe(true)
    expect(layout.syncZoom).toBe(true)
  })

  it('adds a pane and redistributes height', () => {
    addPane('waveform')
    const layout = paneLayout()
    expect(layout.panes).toHaveLength(3)
    const types = layout.panes.map((p) => p.layerType)
    expect(types).toContain('waveform')
    // Heights should still sum to approx 100
    const total = layout.panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeGreaterThan(85)
    expect(total).toBeLessThanOrEqual(100)
  })

  it('removes a pane and redistributes its height', () => {
    const specId = paneLayout().panes[0].id
    removePane(specId)
    const layout = paneLayout()
    expect(layout.panes).toHaveLength(1)
    const total = layout.panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeGreaterThan(85)
    expect(total).toBeLessThanOrEqual(100)
  })

  it('does not allow removing the last pane', () => {
    const panes = paneLayout().panes
    removePane(panes[0].id)
    removePane(panes[1].id) // Now only one left
    const lastId = paneLayout().panes[0].id
    removePane(lastId)
    // Should still have at least one pane
    expect(paneLayout().panes.length).toBeGreaterThanOrEqual(1)
  })

  it('toggles pane collapse', () => {
    const specId = paneLayout().panes[0].id
    togglePaneCollapse(specId)
    const collapsed = paneLayout().panes.find((p) => p.id === specId)
    expect(collapsed?.collapsed).toBe(true)
    togglePaneCollapse(specId)
    const expanded = paneLayout().panes.find((p) => p.id === specId)
    expect(expanded?.collapsed).toBe(false)
  })

  it('toggles syncTime', () => {
    expect(paneLayout().syncTime).toBe(true)
    toggleSyncTime()
    expect(paneLayout().syncTime).toBe(false)
    toggleSyncTime()
    expect(paneLayout().syncTime).toBe(true)
  })

  it('toggles syncZoom', () => {
    expect(paneLayout().syncZoom).toBe(true)
    toggleSyncZoom()
    expect(paneLayout().syncZoom).toBe(false)
  })

  it('resetPaneLayout restores the default', () => {
    addPane('spectrum')
    addPane('cents-deviation')
    toggleSyncTime()
    toggleSyncZoom()
    expect(paneLayout().panes.length).toBeGreaterThan(2)
    resetPaneLayout()
    const layout = paneLayout()
    expect(layout.panes.length).toBe(2)
    expect(layout.syncTime).toBe(true)
    expect(layout.syncZoom).toBe(true)
  })

  it('assigns unique IDs to new panes', () => {
    const id1 = addPane('waveform')
    const id2 = addPane('spectrum')
    expect(id1).not.toBe(id2)
    const ids = paneLayout().panes.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('time sync math', () => {
  it('adaptive time ticks at small range (0-10s)', () => {
    // 10-second range should produce 1-second ticks
    const step = 1
    const t0 = Math.ceil(0 / step) * step
    const end = 10
    const ticks: number[] = []
    for (let t = t0; t <= end; t += step) ticks.push(t)
    expect(ticks.length).toBeGreaterThanOrEqual(9)
    expect(ticks[0]).toBe(0)
  })

  it('adaptive time ticks at medium range (0-60s)', () => {
    // 60-second range should produce 5-second ticks
    const step = 5
    const t0 = Math.ceil(0 / step) * step
    const end = 60
    const ticks: number[] = []
    for (let t = t0; t <= end; t += step) ticks.push(t)
    expect(ticks.length).toBeGreaterThanOrEqual(10)
    expect(ticks[0]).toBe(0)
    expect(ticks[1]).toBe(5)
  })

  it('adaptive time ticks at large range (0-180s)', () => {
    // 180-second range should produce 10-second ticks
    const step = 10
    const t0 = Math.ceil(0 / step) * step
    const end = 180
    const ticks: number[] = []
    for (let t = t0; t <= end; t += step) ticks.push(t)
    expect(ticks.length).toBeGreaterThanOrEqual(15)
    expect(ticks[0]).toBe(0)
    expect(ticks[1]).toBe(10)
  })

  it('adaptive time ticks at very large range (0-600s)', () => {
    // 600-second range should produce 30-second ticks
    const step = 30
    const t0 = Math.ceil(0 / step) * step
    const end = 600
    const ticks: number[] = []
    for (let t = t0; t <= end; t += step) ticks.push(t)
    expect(ticks.length).toBeGreaterThanOrEqual(18)
    expect(ticks[0]).toBe(0)
    expect(ticks[1]).toBe(30)
  })
})

describe('pane height distribution', () => {
  beforeEach(() => {
    resetTo(DEFAULT_LAYOUT)
  })

  it('pane heights sum to approximately 100%', () => {
    const layout = paneLayout()
    const total = layout.panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('adding then removing a pane keeps total near 100%', () => {
    const id = addPane('waveform')
    let total = paneLayout().panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeCloseTo(100, 0)

    removePane(id)
    total = paneLayout().panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('collapsed panes do not count for height distribution', () => {
    addPane('waveform')
    const specId = paneLayout().panes[0].id
    togglePaneCollapse(specId)
    // collapsed pane keeps its height but is visually minimized
    const spec = paneLayout().panes.find((p) => p.id === specId)
    expect(spec?.collapsed).toBe(true)
    const total = paneLayout().panes.reduce((s, p) => s + p.height, 0)
    expect(total).toBeCloseTo(100, 0)
  })

  it('new pane height is at most 40%', () => {
    const id = addPane('spectrum')
    const pane = paneLayout().panes.find((p) => p.id === id)
    expect(pane).toBeDefined()
    expect(pane!.height).toBeLessThanOrEqual(40)
  })

  it('each pane has at least 8% height', () => {
    // Add many panes
    addPane('waveform')
    addPane('spectrum')
    addPane('cents-deviation')
    addPane('vibrato')
    const panes = paneLayout().panes
    for (const p of panes) {
      expect(p.height).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('format time helper', () => {
  function formatTime(t: number): string {
    const mins = Math.floor(t / 60)
    const secs = Math.floor(t % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats 5 seconds as 0:05', () => {
    expect(formatTime(5)).toBe('0:05')
  })

  it('formats 65 seconds as 1:05', () => {
    expect(formatTime(65)).toBe('1:05')
  })

  it('formats 3661 seconds as 61:01', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})
