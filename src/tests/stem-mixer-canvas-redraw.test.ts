// ============================================================
// useStemMixerCanvasController — repainting on display changes
// ============================================================
//
// Drawing here is imperative: `redrawAll` reads the display accessors but is
// called from a frame loop, so while audio plays every change lands on the
// next frame for free. Paused, that loop is idle — and a toggled overlay or a
// nudged timing sat invisible until playback resumed.
//
// These lock the reactive repaint that fixes that. They deliberately assert
// on scheduling rather than pixels: jsdom has no 2D context, and the question
// is whether the change reached the scheduler at all.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordMarker } from '@/features/stem-mixer/overview-mapping'
import type { StemMixerCanvasDeps } from '@/features/stem-mixer/useStemMixerCanvasController'
import { useStemMixerCanvasController } from '@/features/stem-mixer/useStemMixerCanvasController'

/** rAF callbacks, run on demand so a queued redraw is observable. */
let frames: (() => void)[] = []

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  // jsdom has never implemented matchMedia, and the controller's DPR watcher
  // arms one on construction.
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Drains the queue and reports how many redraws it held. */
function flushFrames(): number {
  const queued = frames
  frames = []
  for (const cb of queued) cb()
  return queued.length
}

interface Harness {
  deps: StemMixerCanvasDeps
  setShowNoteLabels: (v: boolean) => void
  setShowWordMarkers: (v: boolean) => void
  setLoopStart: (v: number) => void
  setWordMarkers: (v: WordMarker[]) => void
  setElapsed: (v: number) => void
  dispose: () => void
}

function harness(): Harness {
  const [showNoteLabels, setShowNoteLabels] = createSignal(false)
  const [showWordMarkers, setShowWordMarkers] = createSignal(false)
  const [loopStart, setLoopStart] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const [wordMarkers, setWordMarkers] = createSignal<WordMarker[]>([])

  const deps: StemMixerCanvasDeps = {
    duration: () => 200,
    elapsed,
    windowStart: () => 0,
    windowDuration: () => 30,
    tracks: () => [],
    vocal: () => ({ buffer: null }),
    getPitchHistory: () => [],
    getMicPitchHistory: () => [],
    micActive: () => false,
    currentPitch: () => null,
    midiNotes: () => [],
    showNoteLabels,
    showLyricLabels: () => false,
    showMicLine: () => false,
    showUserNoteLabels: () => false,
    showScoreDiffBars: () => false,
    alignedWords: () => [],
    seekTo: () => {},
    setWindowStart: (() => 0) as StemMixerCanvasDeps['setWindowStart'],
    setWindowDuration: (() => 0) as StemMixerCanvasDeps['setWindowDuration'],
    PITCH_WINDOW_FILL_RATIO: 0.7,
    loopEnabled: () => false,
    loopStart,
    loopEnd: () => 0,
    setLoopStart: (() => 0) as StemMixerCanvasDeps['setLoopStart'],
    setLoopEnd: (() => 0) as StemMixerCanvasDeps['setLoopEnd'],
    wordMarkers,
    showWordMarkers,
    activeWordMarker: () => null,
  }

  let dispose = () => {}
  createRoot((d) => {
    dispose = d
    useStemMixerCanvasController(deps)
  })
  // The effect's first run queues one; drop it so each case counts its own.
  flushFrames()

  return {
    deps,
    setShowNoteLabels,
    setShowWordMarkers,
    setLoopStart,
    setWordMarkers,
    setElapsed,
    dispose,
  }
}

describe('useStemMixerCanvasController display repaints', () => {
  it('repaints when an overlay is toggled with the transport stopped', () => {
    const h = harness()
    h.setShowNoteLabels(true)
    expect(flushFrames()).toBe(1)
    h.dispose()
  })

  it('repaints when the word ticks are toggled', () => {
    const h = harness()
    h.setShowWordMarkers(true)
    expect(flushFrames()).toBe(1)
    h.dispose()
  })

  it('repaints when every timing shifts, as the +/-100 ms buttons do', () => {
    const h = harness()
    h.setWordMarkers([{ lineIdx: 0, wordIdx: 0, time: 1, isLineStart: true }])
    expect(flushFrames()).toBe(1)
    h.setWordMarkers([{ lineIdx: 0, wordIdx: 0, time: 0.9, isLineStart: true }])
    expect(flushFrames()).toBe(1)
    h.dispose()
  })

  it('repaints when a loop marker moves', () => {
    const h = harness()
    h.setLoopStart(4)
    expect(flushFrames()).toBe(1)
    h.dispose()
  })

  it('coalesces a burst of changes into a single frame', () => {
    const h = harness()
    h.setShowNoteLabels(true)
    h.setShowWordMarkers(true)
    h.setLoopStart(4)
    expect(flushFrames()).toBe(1)
    h.dispose()
  })

  it('ignores the playhead, which the frame loop already carries', () => {
    const h = harness()
    // Tracking it would mean queueing a redraw from inside one.
    h.setElapsed(12)
    expect(flushFrames()).toBe(0)
    h.dispose()
  })
})
