// ============================================================
// useStemMixerCanvasController — a canvas drawn again lets the old one go
// ============================================================
//
// The workspaces register each canvas by id from its ref, and Solid never
// calls a ref with null when the canvas goes. So the controller's own
// release only ran for a host that asked for it, and every time a Show block
// drew a canvas again (karaoke focus on and off, a layout change) the old
// element kept its wheel and touch listeners and stayed in the
// ResizeObserver, its backing store held by an observer nobody could see.
// The repaint cases live in src/tests/stem-mixer-canvas-redraw.test.ts.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StemMixerCanvasDeps } from './useStemMixerCanvasController'
import { useStemMixerCanvasController } from './useStemMixerCanvasController'

/** The canvases the controller's observer is watching right now. */
const watched = new Set<Element>()

beforeEach(() => {
  watched.clear()
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  // jsdom has no matchMedia, and the controller's DPR watcher arms one.
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(el: Element): void {
        watched.add(el)
      }
      unobserve(el: Element): void {
        watched.delete(el)
      }
      disconnect(): void {
        watched.clear()
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function controller() {
  const noop = (() => 0) as never
  const deps: StemMixerCanvasDeps = {
    duration: () => 200,
    elapsed: () => 0,
    windowStart: () => 0,
    windowDuration: () => 30,
    tracks: () => [],
    vocal: () => ({ buffer: null }),
    getPitchHistory: () => [],
    getMicPitchHistory: () => [],
    micActive: () => false,
    currentPitch: () => null,
    midiNotes: () => [],
    showNoteLabels: () => false,
    showLyricLabels: () => false,
    showMicLine: () => false,
    showUserNoteLabels: () => false,
    showScoreDiffBars: () => false,
    alignedWords: () => [],
    seekTo: () => {},
    setWindowStart: noop,
    setWindowDuration: noop,
    PITCH_WINDOW_FILL_RATIO: 0.7,
    loopEnabled: () => false,
    loopStart: () => null,
    loopEnd: () => null,
    setLoopStart: noop,
    setLoopEnd: noop,
    wordMarkers: () => [],
    showWordMarkers: () => false,
    activeWordMarker: () => null,
  }
  let dispose = () => {}
  const built = createRoot((d) => {
    dispose = d
    return useStemMixerCanvasController(deps)
  })
  built.initObserver()
  return { ...built, dispose }
}

describe('setCanvasRef', () => {
  it('lets the old canvas go when its id is drawn again', () => {
    const c = controller()
    const before = document.createElement('canvas')
    const after = document.createElement('canvas')
    const released = vi.spyOn(before, 'removeEventListener')

    c.setCanvasRef('pitch')(before)
    c.setCanvasRef('pitch')(after)

    expect([...watched]).toEqual([after])
    expect(released.mock.calls.map(([type]) => type).sort()).toEqual([
      'touchend',
      'touchmove',
      'touchstart',
      'wheel',
    ])
    c.dispose()
  })

  it('keeps a canvas registered again under its own id', () => {
    const c = controller()
    const canvas = document.createElement('canvas')
    const released = vi.spyOn(canvas, 'removeEventListener')

    c.setCanvasRef('live')(canvas)
    c.setCanvasRef('live')(canvas)

    expect([...watched]).toEqual([canvas])
    expect(released).not.toHaveBeenCalled()
    c.dispose()
  })
})
