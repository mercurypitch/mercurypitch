// ============================================================
// Piano roll viewport — big songs render, scroll, and stay clickable
// ============================================================
//
// Regression cover for the 267-bar import that rendered blank: the grid
// canvas was sized to the whole song (~102k device px at DPR 2, past the
// browser's 65,535 cap), and .roll-grid-container had no CSS at all so it
// never scrolled.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoRollEditor } from '../lib/piano-roll'
import { buildMultiOctaveScale, midiToFreq, midiToNote, } from '../lib/scale-data'
import type { MelodyItem } from '../types'

const BEAT_WIDTH = 48
const ROW_HEIGHT = 22
const VIEWPORT = 900

function mockCanvasContext(): void {
  const makeCtx = (): CanvasRenderingContext2D => {
    const store: Record<string | symbol, unknown> = {}
    return new Proxy(store, {
      get(target, prop) {
        if (prop === 'then') return undefined
        if (prop in target) return target[prop]
        if (prop === 'measureText') return () => ({ width: 10 })
        if (prop === 'createLinearGradient')
          return () => ({ addColorStop: () => {} })
        if (typeof prop === 'symbol') return undefined
        return () => {}
      },
      set(target, prop, value) {
        target[prop] = value
        return true
      },
    }) as unknown as CanvasRenderingContext2D
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    makeCtx(),
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

function note(midi: number, startBeat: number, duration = 1): MelodyItem {
  const { name, octave } = midiToNote(midi)
  return {
    id: startBeat + 1,
    note: { midi, name, octave, freq: midiToFreq(midi) },
    startBeat,
    duration,
  }
}

/** A 267-bar import: the exact shape that used to render nothing. */
function bigSong(): MelodyItem[] {
  return Array.from({ length: 498 }, (_, i) => note(48 + (i % 25), i * 2, 1))
}

describe('piano roll viewport', () => {
  let container: HTMLElement
  let editor: PianoRollEditor
  let grid: HTMLCanvasElement
  let scroller: HTMLElement

  beforeEach(() => {
    mockCanvasContext()
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new PianoRollEditor({
      container,
      scale: buildMultiOctaveScale('C', 3, 2, 'major'),
      bpm: 120,
      totalBeats: 16,
    })
    grid = container.querySelector('.roll-grid') as HTMLCanvasElement
    scroller = container.querySelector('.roll-grid-container') as HTMLElement
    // jsdom reports 0 for every layout box; pin a realistic viewport.
    Object.defineProperty(scroller, 'clientWidth', {
      value: VIEWPORT,
      configurable: true,
    })
    grid.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: VIEWPORT,
      bottom: 600,
      width: VIEWPORT,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as HTMLCanvasElement['getBoundingClientRect']
  })

  it('keeps the canvas viewport-sized for a song far past the browser limit', () => {
    editor.setMelody(bigSong())
    editor.setTotalBeats(1068)

    const layer = container.querySelector('.roll-grid-layer') as HTMLElement
    // The spacer carries the full song so the scrollbar has travel...
    expect(parseFloat(layer.style.width)).toBeCloseTo(1068 * BEAT_WIDTH, 0)
    // ...while the canvas stays at one viewport, well under the 65,535 cap
    // that made the old full-width canvas fail to allocate.
    expect(grid.style.width).toBe(`${VIEWPORT}px`)
    expect(grid.width).toBeLessThanOrEqual(16384)
    expect(grid.height).toBeLessThanOrEqual(16384)
  })

  it('places a note at the correct beat after scrolling', () => {
    editor.setTotalBeats(1068)
    editor.setMelody([])

    // Scroll 100 bars in, then click 24px into the viewport (half a beat).
    editor.scrollToContentX(100 * 4 * BEAT_WIDTH, 'start')
    const scrollX = scroller.scrollLeft
    expect(scrollX).toBeGreaterThan(0)

    const clientX = 2 * BEAT_WIDTH // 2 beats into the visible window
    const clientY = ROW_HEIGHT / 2
    grid.dispatchEvent(
      new MouseEvent('mousedown', { clientX, clientY, bubbles: true }),
    )
    grid.dispatchEvent(
      new MouseEvent('mouseup', { clientX, clientY, bubbles: true }),
    )

    const melody = editor.getMelody()
    expect(melody).toHaveLength(1)
    // The note must land where it was clicked in SONG space, not viewport
    // space — this is the regression windowing most risks.
    expect(melody[0].startBeat).toBe(Math.floor(scrollX / BEAT_WIDTH) + 2)
  })

  it('goToBar scrolls to that bar and clamps to the song', () => {
    editor.setTotalBeats(1068)
    editor.goToBar(50)
    // Bar 50 lands just inside the left edge — goToBar keeps a small lead-in
    // so the target bar isn't flush against the piano column.
    const barX = 49 * 4 * BEAT_WIDTH
    expect(scroller.scrollLeft).toBeLessThanOrEqual(barX)
    expect(scroller.scrollLeft).toBeGreaterThan(barX - VIEWPORT * 0.25)

    editor.goToBar(99999)
    const maxScroll = 1068 * BEAT_WIDTH - VIEWPORT
    expect(scroller.scrollLeft).toBeLessThanOrEqual(maxScroll)
    expect(scroller.scrollLeft).toBeGreaterThan(0)

    editor.goToBar(-5)
    expect(scroller.scrollLeft).toBe(0)
  })

  it('paging moves forward and back without leaving the song', () => {
    editor.setTotalBeats(1068)
    editor.pageView(1)
    const afterOne = scroller.scrollLeft
    expect(afterOne).toBeGreaterThan(0)

    editor.pageView(-1)
    expect(scroller.scrollLeft).toBeLessThan(afterOne)
    editor.pageView(-1)
    expect(scroller.scrollLeft).toBe(0)
  })
})

describe('row auto-fit', () => {
  let container: HTMLElement
  let editor: PianoRollEditor

  beforeEach(() => {
    mockCanvasContext()
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new PianoRollEditor({
      container,
      scale: buildMultiOctaveScale('C', 3, 2, 'major'),
      bpm: 120,
      totalBeats: 16,
    })
  })

  it('reframes the rows to cover a wide imported song', () => {
    // C2 (36) up to C6 (84) — the default C3..C5 window shows neither end.
    editor.setMelody([note(36, 0), note(84, 1)])
    const scale = editor.getScale()
    const lowest = scale[scale.length - 1]
    const highest = scale[0]
    expect(lowest.midi).toBeLessThanOrEqual(36)
    expect(highest.midi).toBeGreaterThanOrEqual(84)
  })

  it('leaves the rows alone when the melody already fits', () => {
    const before = editor.getScale()
    // C4 sits inside the default C3..C5 window.
    editor.setMelody([note(60, 0)])
    const after = editor.getScale()
    expect(after.map((d) => d.midi)).toEqual(before.map((d) => d.midi))
  })

  it('never exceeds the row cap for an extreme range', () => {
    editor.setMelody([note(21, 0), note(108, 1)])
    // 11 octaves max — the grid must stay finite even for a full piano.
    expect(editor.getScale().length).toBeLessThanOrEqual(12 * 11 + 1)
  })
})
