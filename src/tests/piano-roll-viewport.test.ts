// ============================================================
// Piano roll viewport — big songs render, scroll, and stay clickable
// ============================================================
//
// Regression cover for the 267-bar import that rendered blank: the grid
// canvas was sized to the whole song (~102k device px at DPR 2, past the
// browser's 65,535 cap), and .roll-grid-container had no CSS at all so it
// never scrolled.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoRollEditor, readMidiTempoBpm } from '../lib/piano-roll'
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

describe('readMidiTempoBpm', () => {
  /** Minimal SMF with a Set Tempo meta event of the given BPM. */
  function midiWithTempo(bpm: number): Uint8Array {
    const micros = Math.round(60000000 / bpm)
    return new Uint8Array([
      0x4d,
      0x54,
      0x68,
      0x64,
      0,
      0,
      0,
      6,
      0,
      1,
      0,
      1,
      0x01,
      0xe0,
      0x4d,
      0x54,
      0x72,
      0x6b,
      0,
      0,
      0,
      11,
      0x00,
      0xff,
      0x51,
      0x03,
      (micros >> 16) & 0xff,
      (micros >> 8) & 0xff,
      micros & 0xff,
      0x00,
      0xff,
      0x2f,
      0x00,
    ])
  }

  it('reads the tempo an imported file was written at', () => {
    expect(readMidiTempoBpm(midiWithTempo(140))).toBe(140)
    expect(readMidiTempoBpm(midiWithTempo(72))).toBe(72)
  })

  it('returns null when the file declares no tempo', () => {
    const noTempo = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0x01, 0xe0, 0x4d, 0x54,
      0x72, 0x6b, 0, 0, 0, 4, 0x00, 0xff, 0x2f, 0x00,
    ])
    expect(readMidiTempoBpm(noTempo)).toBeNull()
  })

  it('ignores out-of-range values from a false byte match', () => {
    // micros = 1 -> 60,000,000 BPM: a coincidental byte run, not a tempo.
    const bogus = new Uint8Array([0xff, 0x51, 0x03, 0x00, 0x00, 0x01, 0x00])
    expect(readMidiTempoBpm(bogus)).toBeNull()
  })
})

describe('playback follow yields to the user', () => {
  let container: HTMLElement
  let editor: PianoRollEditor
  let scroller: HTMLElement

  beforeEach(() => {
    mockCanvasContext()
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new PianoRollEditor({
      container,
      scale: buildMultiOctaveScale('C', 3, 2, 'major'),
      bpm: 120,
      totalBeats: 1068,
    })
    scroller = container.querySelector('.roll-grid-container') as HTMLElement
    Object.defineProperty(scroller, 'clientWidth', {
      value: VIEWPORT,
      configurable: true,
    })
    editor.setTotalBeats(1068)
    editor.setMelody(bigSong())
    editor.setExternalPlayback(true)
    editor.setPlaybackState('playing')
  })

  function userScrollsTo(x: number): void {
    scroller.scrollLeft = x
    scroller.dispatchEvent(new Event('scroll'))
  }

  it('does not snap the view back while the user is browsing', () => {
    // Playhead near the start, user scrolls far away mid-playback.
    editor.updatePlaybackPosition(4)
    userScrollsTo(20000)
    const parked = scroller.scrollLeft
    expect(parked).toBeGreaterThan(10000)

    // Several playback frames later the view is still where they left it.
    for (let beat = 4; beat < 12; beat++) {
      editor.updatePlaybackPosition(beat)
    }
    expect(scroller.scrollLeft).toBe(parked)
  })

  it('resumes following once the grace period lapses', () => {
    editor.updatePlaybackPosition(4)
    userScrollsTo(20000)
    expect(scroller.scrollLeft).toBeGreaterThan(10000)

    // Jump past the hands-off window, then let playback advance.
    const realNow = performance.now.bind(performance)
    const spy = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => realNow() + 5000)
    editor.updatePlaybackPosition(6)
    spy.mockRestore()

    // Back on the playhead (6 beats in), not stranded at bar 100.
    expect(scroller.scrollLeft).toBeLessThan(5000)
  })

  it('still follows the playhead when the user is not scrolling', () => {
    // The guard that ignores our OWN scroll events: if auto-follow mistook
    // its own scroll for a user scroll it would suspend itself forever and
    // the playhead would simply run off the right edge.
    editor.updatePlaybackPosition(4)
    const early = scroller.scrollLeft
    for (let beat = 4; beat <= 120; beat += 4) {
      editor.updatePlaybackPosition(beat)
    }
    expect(scroller.scrollLeft).toBeGreaterThan(early)
    // The playhead (beat 120) is inside the visible window, not off-screen.
    const playheadX = 120 * BEAT_WIDTH
    expect(scroller.scrollLeft).toBeLessThanOrEqual(playheadX)
    expect(scroller.scrollLeft + VIEWPORT).toBeGreaterThanOrEqual(playheadX)
  })

  it('ignores its own auto-follow scroll even when the browser rounds it', () => {
    // The handler's exact-value check absorbs a clean echo, but browsers can
    // report a rounded/clamped scrollLeft (fractional DPR zoom), which would
    // look like a user scroll and suspend follow the first time the editor
    // moved the view — permanently, since every follow scroll re-triggers it.
    editor.updatePlaybackPosition(40)
    const moved = scroller.scrollLeft
    expect(moved).toBeGreaterThan(0)
    // Browser reports a slightly different value than we set, then echoes.
    scroller.scrollLeft = moved + 0.5
    scroller.dispatchEvent(new Event('scroll'))

    for (let beat = 44; beat <= 140; beat += 4) {
      editor.updatePlaybackPosition(beat)
    }
    const playheadX = 140 * BEAT_WIDTH
    expect(scroller.scrollLeft).toBeGreaterThan(moved)
    expect(scroller.scrollLeft + VIEWPORT).toBeGreaterThanOrEqual(playheadX)
  })

  it('a bar jump holds the view mid-playback', () => {
    editor.updatePlaybackPosition(4)
    editor.goToBar(120)
    const jumped = scroller.scrollLeft
    expect(jumped).toBeGreaterThan(10000)
    // Deliberate navigation counts as hands-off too.
    for (let beat = 4; beat < 12; beat++) {
      editor.updatePlaybackPosition(beat)
    }
    expect(scroller.scrollLeft).toBe(jumped)
  })

  it('pressing play clears a leftover hands-off period', () => {
    editor.updatePlaybackPosition(4)
    userScrollsTo(20000)
    editor.setPlaybackState('stopped')
    editor.setPlaybackState('playing')
    editor.updatePlaybackPosition(6)
    expect(scroller.scrollLeft).toBeLessThan(5000)
  })
})
