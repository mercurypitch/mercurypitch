// ============================================================
// Compose drum kit mode — editor preset, lanes, placement, export
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRUM_LANE_SCALE } from '../lib/drum-lanes'
import { exportMelodyToMIDI, PianoRollEditor, snapPlacementBeat, } from '../lib/piano-roll'
import { buildMultiOctaveScale } from '../lib/scale-data'
import type { MelodyItem } from '../types'

const BEAT_WIDTH = 48
const ROW_HEIGHT = 22

// Same Proxy-backed context as piano-roll-placement.test.ts: any 2D method
// the draw path touches is a safe no-op.
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

function pinRect(el: HTMLElement): void {
  el.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 1000,
    bottom: 1000,
    width: 1000,
    height: 1000,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })) as unknown as HTMLElement['getBoundingClientRect']
}

function makeNote(midi: number, startBeat: number, duration = 1): MelodyItem {
  return {
    id: 1,
    note: { midi, name: 'C', octave: 4, freq: 261.63 },
    startBeat,
    duration,
  }
}

describe('PianoRollEditor drum kit mode', () => {
  let container: HTMLElement
  let editor: PianoRollEditor
  let grid: HTMLCanvasElement

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
    pinRect(grid)
  })

  afterEach(() => {
    // Sever the document/window listeners — without this, every editor from
    // a previous test still reacts to the keyboard events dispatched below.
    editor.destroy()
    container.remove()
  })

  function clickGrid(beat: number, row: number): void {
    const clientX = beat * BEAT_WIDTH
    const clientY = row * ROW_HEIGHT + ROW_HEIGHT / 2
    grid.dispatchEvent(
      new MouseEvent('mousedown', { clientX, clientY, bubbles: true }),
    )
    grid.dispatchEvent(
      new MouseEvent('mouseup', { clientX, clientY, bubbles: true }),
    )
  }

  it('setKind(drums) swaps the rows for the 12 GM lanes, descending', () => {
    expect(editor.getKind()).toBe('melody')
    editor.setKind('drums')
    expect(editor.getKind()).toBe('drums')
    const scale = editor.getScale()
    expect(scale).toHaveLength(12)
    expect(scale.map((s) => s.midi)).toEqual(DRUM_LANE_SCALE.map((s) => s.midi))
    // Strictly descending — midiToY relies on it
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i].midi).toBeLessThan(scale[i - 1].midi)
    }
  })

  it('placing on the kick lane stores GM midi 36 with its real note name', () => {
    editor.setKind('drums')
    clickGrid(0, 11) // bottom lane = kick
    const melody = editor.getMelody()
    expect(melody).toHaveLength(1)
    expect(melody[0].note.midi).toBe(36)
    expect(melody[0].note.name).toBe('C')
    expect(melody[0].note.octave).toBe(2)
  })

  it('ignores store scale pushes while drums are active', () => {
    editor.setKind('drums')
    editor.setScale(buildMultiOctaveScale('G', 4, 2, 'major'))
    expect(editor.getScale().map((s) => s.midi)).toEqual(
      DRUM_LANE_SCALE.map((s) => s.midi),
    )
  })

  it('toggling back to melody restores pitched rows and keeps the notes', () => {
    editor.setMelody([makeNote(60, 0)])
    editor.setKind('drums')
    // Note survives the drum round-trip untouched
    expect(editor.getMelody()).toHaveLength(1)
    expect(editor.getMelody()[0].note.midi).toBe(60)
    editor.setKind('melody')
    const scale = editor.getScale()
    // C major over 2 octaves from the synced key/octave (C3 root)
    expect(scale[scale.length - 1].name).toBe('C')
    expect(scale[scale.length - 1].octave).toBe(3)
    expect(scale.length).toBeGreaterThan(12)
    expect(editor.getMelody()[0].note.midi).toBe(60)
  })

  it('setKind is non-destructive for drum notes toggled through melody mode', () => {
    editor.setKind('drums')
    clickGrid(0, 9) // snare lane
    editor.setKind('melody')
    editor.setKind('drums')
    expect(editor.getMelody()).toHaveLength(1)
    expect(editor.getMelody()[0].note.midi).toBe(38)
  })

  it('keyboard pitch effects are inert in drum mode', () => {
    editor.setKind('drums')
    clickGrid(0, 11)
    // Select everything, then try to apply vibrato via its shortcut
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }),
    )
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'v', bubbles: true }),
    )
    expect(editor.getMelody()[0].effectType).toBeUndefined()
  })
})

describe('snapPlacementBeat sixteenth grid', () => {
  it('a 1/16 note floors onto the quarter-beat grid', () => {
    expect(snapPlacementBeat(2.3, 0.25)).toBe(2.25)
    expect(snapPlacementBeat(2.55, 0.25)).toBe(2.5)
    expect(snapPlacementBeat(2.8, 0.25)).toBe(2.75)
  })

  it('eighth and longer notes keep their coarser grids', () => {
    expect(snapPlacementBeat(2.3, 0.5)).toBe(2)
    expect(snapPlacementBeat(2.6, 0.5)).toBe(2.5)
    expect(snapPlacementBeat(2.9, 1)).toBe(2)
  })
})

describe('exportMelodyToMIDI channel', () => {
  const melody = [makeNote(36, 0)]

  it('writes note events on channel 10 (0x99/0x89) when asked', () => {
    const data = exportMelodyToMIDI(melody, 120, 9)
    expect(data).not.toBeNull()
    const bytes = Array.from(data as Uint8Array)
    expect(bytes).toContain(0x99)
    expect(bytes).toContain(0x89)
    expect(bytes).not.toContain(0x90)
  })

  it('defaults to channel 1 (0x90/0x80)', () => {
    const data = exportMelodyToMIDI(melody, 120)
    expect(data).not.toBeNull()
    const bytes = Array.from(data as Uint8Array)
    expect(bytes).toContain(0x90)
    expect(bytes).not.toContain(0x99)
  })
})

describe('PianoRollEditor listener lifecycle', () => {
  it('registers every document/window listener with an abortable signal and severs them on destroy', () => {
    mockCanvasContext()
    const registered: { type: string; signal: AbortSignal | undefined }[] = []
    const origDoc = document.addEventListener.bind(document)
    const origWin = window.addEventListener.bind(window)
    const docSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, fn, opts) => {
        registered.push({
          type: String(type),
          signal: (opts as AddEventListenerOptions | undefined)?.signal,
        })
        origDoc(type, fn as EventListener, opts)
      })
    const winSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, fn, opts) => {
        registered.push({
          type: String(type),
          signal: (opts as AddEventListenerOptions | undefined)?.signal,
        })
        origWin(type, fn as EventListener, opts)
      })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new PianoRollEditor({ container, scale: [], bpm: 120 })

    expect(registered.length).toBeGreaterThan(0)
    for (const r of registered) {
      expect(
        r.signal,
        `listener "${r.type}" missing abort signal`,
      ).toBeDefined()
      expect(r.signal?.aborted).toBe(false)
    }

    editor.destroy()
    for (const r of registered) {
      expect(r.signal?.aborted, `listener "${r.type}" not severed`).toBe(true)
    }

    docSpy.mockRestore()
    winSpy.mockRestore()
  })
})
