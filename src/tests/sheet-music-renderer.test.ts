import { afterAll, afterEach, beforeAll, describe, expect, it, vi, } from 'vitest'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import { beatToCursor, notationDurationBeats, notationKeySignature, quantizeNotationDuration, renderSheetMusic, xToBeat, } from '@/lib/sheet-music-renderer'
import type { MelodyItem } from '@/types'

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        measureText: (text: string) => ({
          width: text.length * 8,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
        }),
      }) as never,
  )
})

afterAll(() => {
  vi.restoreAllMocks()
})

function note(
  id: number,
  midi: number,
  startBeat: number,
  duration: number,
): MelodyItem {
  const { name, octave } = midiToNote(midi)
  return {
    id,
    note: { midi, name, octave, freq: midiToFreq(midi) },
    startBeat,
    duration,
  }
}

function render(melody: MelodyItem[], key = 'C', scaleType = 'major') {
  const container = document.createElement('div')
  container.style.color = '#e6edf3'
  document.body.append(container)
  const layout = renderSheetMusic({
    container,
    melody,
    key,
    scaleType,
    width: 900,
  })
  return { container, layout }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('sheet music theory conversion', () => {
  it('passes valid major key names to VexFlow', () => {
    expect(notationKeySignature('G', 'major')).toBe('G')
    expect(notationKeySignature('Bb', 'major')).toBe('Bb')
    expect(notationKeySignature('A#', 'major')).toBe('Bb')
    expect(notationKeySignature('F♯', 'major')).toBe('F#')
  })

  it('uses the relative-major signature for minor scales', () => {
    expect(notationKeySignature('A', 'natural-minor')).toBe('C')
    expect(notationKeySignature('C', 'harmonic-minor')).toBe('Eb')
    expect(notationKeySignature('F#', 'melodic-minor')).toBe('A')
  })

  it('assigns consistent values to dotted durations', () => {
    expect(notationDurationBeats('q', 1)).toBe(1.5)
    expect(notationDurationBeats('q', 2)).toBe(1.75)
    expect(notationDurationBeats('h', 2)).toBe(3.5)

    const durations = quantizeNotationDuration(3.75)
    const total = durations.reduce(
      (sum, duration) =>
        sum + notationDurationBeats(duration.code, duration.dots),
      0,
    )
    expect(total).toBe(3.75)
  })
})

describe('sheet music rendering', () => {
  it.each([
    ['G', 'major'],
    ['Bb', 'major'],
    ['C', 'natural-minor'],
  ])('renders %s %s without an invalid key signature', (key, scaleType) => {
    const { container, layout } = render(
      [note(1, 60, 0, 1), note(2, 66, 1, 1), note(3, 67, 2, 2)],
      key,
      scaleType,
    )

    expect(container.querySelector('svg')).not.toBeNull()
    expect(layout.notes.filter((item) => !item.isRest)).toHaveLength(3)
  })

  it('splits a sustained note at a barline without losing its beat range', () => {
    const { layout } = render([note(1, 64, 3, 3)])
    const renderedNote = layout.notes.filter((item) => item.melodyId === 1)

    expect(renderedNote).toHaveLength(2)
    expect(renderedNote[0]).toMatchObject({ startBeat: 3, endBeat: 4 })
    expect(renderedNote[1]).toMatchObject({ startBeat: 4, endBeat: 6 })
    expect(layout.totalBeats).toBe(6)
  })

  it('engraves exact simultaneous notes as a chord', () => {
    const { layout } = render([
      note(1, 60, 0, 2),
      note(2, 64, 0, 2),
      note(3, 67, 0, 2),
    ])
    const chord = layout.notes.filter((item) => !item.isRest)

    expect(chord).toHaveLength(3)
    expect(new Set(chord.map((item) => Math.round(item.x))).size).toBe(1)
    expect(new Set(chord.map((item) => Math.round(item.y))).size).toBe(3)
  })

  it('keeps cursor and click mappings inverse within a system', () => {
    const { layout } = render([
      note(1, 60, 0, 1),
      note(2, 62, 1, 1),
      note(3, 64, 2, 1),
      note(4, 65, 3, 1),
    ])
    const cursor = beatToCursor(layout, 2)
    const system = layout.systems[0]

    expect(cursor).not.toBeNull()
    expect(xToBeat(layout, system, cursor!.x)).toBeCloseTo(2, 4)
  })
})
