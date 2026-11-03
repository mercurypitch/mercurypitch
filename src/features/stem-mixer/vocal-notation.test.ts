// ============================================================
// Vocal notation — the mixer's shown notes as a score and as MIDI
// ============================================================

import { describe, expect, it } from 'vitest'
import type { EditableNote } from './pitch-edit-model'
import { safeBpm, shownNotesToMelody, shownNotesToMidiEvents, } from './vocal-notation'

describe('shownNotesToMelody', () => {
  it('turns seconds into beats at the given tempo', () => {
    const m = shownNotesToMelody(
      [{ id: 'a', startBeat: 0.5, endBeat: 1.0, midi: 69 }],
      120,
    )
    expect(m).toHaveLength(1)
    expect(m[0].startBeat).toBe(1)
    expect(m[0].duration).toBe(1)
    expect(m[0].note).toMatchObject({ midi: 69, name: 'A', octave: 4 })
    expect(m[0].note.freq).toBeCloseTo(440, 3)
  })

  it('snaps starts and ends to a sixteenth (0.25 beat)', () => {
    const [n] = shownNotesToMelody(
      [{ id: 'a', startBeat: 0.26, endBeat: 0.9, midi: 60 }],
      120,
    )
    expect(n.startBeat).toBe(0.5)
    expect(n.duration).toBe(1.25)
  })

  it('keeps a note shorter than the grid at one grid step', () => {
    const [n] = shownNotesToMelody(
      [{ id: 'a', startBeat: 1.0, endBeat: 1.02, midi: 60 }],
      120,
    )
    expect(n.duration).toBe(0.25)
  })

  it('clips an overlap so the line stays one note at a time', () => {
    const m = shownNotesToMelody(
      [
        { id: 'a', startBeat: 0, endBeat: 1.0, midi: 60 },
        { id: 'b', startBeat: 0.75, endBeat: 1.5, midi: 62 },
      ],
      60,
    )
    expect(m[0].startBeat + m[0].duration).toBeLessThanOrEqual(m[1].startBeat)
    expect(m.every((x) => x.duration > 0)).toBe(true)
  })

  it('drops a note that clipping would leave with no length', () => {
    // Both snap to beat 0; the line can only hold one of them there.
    const m = shownNotesToMelody(
      [
        { id: 'a', startBeat: 0, endBeat: 0.5, midi: 60 },
        { id: 'b', startBeat: 0.01, endBeat: 0.5, midi: 64 },
      ],
      120,
    )
    expect(m).toHaveLength(1)
    expect(m[0].duration).toBeGreaterThan(0)
  })

  it('keeps two halves of a split note as two notes', () => {
    const m = shownNotesToMelody(
      [
        { id: 'a', startBeat: 0, endBeat: 0.5, midi: 60 },
        { id: 'b', startBeat: 0.5, endBeat: 1.0, midi: 60 },
      ],
      120,
    )
    expect(m.map((x) => [x.startBeat, x.duration])).toEqual([
      [0, 1],
      [1, 1],
    ])
  })

  it('sorts by start and numbers ids from 1', () => {
    const m = shownNotesToMelody(
      [
        { id: 'b', startBeat: 2, endBeat: 2.5, midi: 64 },
        { id: 'a', startBeat: 0, endBeat: 0.5, midi: 60 },
      ],
      60,
    )
    expect(m.map((x) => x.id)).toEqual([1, 2])
    expect(m.map((x) => x.note.midi)).toEqual([60, 64])
  })

  it('leaves out a note whose times are not numbers', () => {
    const notes: EditableNote[] = [
      { id: 'a', startBeat: Number.NaN, endBeat: 1, midi: 60 },
      { id: 'b', startBeat: 1, endBeat: 1.5, midi: 62 },
    ]
    expect(shownNotesToMelody(notes, 120).map((x) => x.note.midi)).toEqual([62])
  })

  it('returns [] for no notes', () =>
    expect(shownNotesToMelody([], 120)).toEqual([]))
})

describe('safeBpm', () => {
  it.each([[0], [Number.NaN], [-5], [undefined], [null]])(
    'falls back to 120 for %s',
    (v) => expect(safeBpm(v as number)).toBe(120),
  )
  it('keeps a real tempo', () => expect(safeBpm(92.02)).toBe(92.02))
})

describe('shownNotesToMidiEvents', () => {
  it('places ticks at the tempo', () => {
    const [e] = shownNotesToMidiEvents(
      [{ id: 'a', startBeat: 0.5, endBeat: 1.0, midi: 69 }],
      120,
    )
    expect(e).toEqual({ midi: 69, tickOn: 480, tickOff: 960 })
  })

  it('never starts a same-pitch note before the previous one ends (after a split)', () => {
    const ev = shownNotesToMidiEvents(
      [
        { id: 'a', startBeat: 0, endBeat: 0.5004, midi: 60 },
        { id: 'b', startBeat: 0.5, endBeat: 1.0, midi: 60 },
      ],
      120,
    )
    expect(ev[0].tickOff).toBeLessThanOrEqual(ev[1].tickOn)
    expect(ev.every((x) => x.tickOff > x.tickOn)).toBe(true)
  })

  it('clips an edited same-pitch overlap at the next attack', () => {
    const ev = shownNotesToMidiEvents(
      [
        { id: 'a', startBeat: 0, endBeat: 1.0, midi: 60 },
        { id: 'b', startBeat: 0.5, endBeat: 1.5, midi: 60 },
      ],
      120,
    )
    expect(ev).toEqual([
      { midi: 60, tickOn: 0, tickOff: 480 },
      { midi: 60, tickOn: 480, tickOff: 1440 },
    ])
  })

  it('keeps the sung timing of different pitches, overlap included', () => {
    const ev = shownNotesToMidiEvents(
      [
        { id: 'a', startBeat: 0, endBeat: 1.0, midi: 60 },
        { id: 'b', startBeat: 0.75, endBeat: 1.5, midi: 62 },
      ],
      120,
    )
    expect(ev).toEqual([
      { midi: 60, tickOn: 0, tickOff: 960 },
      { midi: 62, tickOn: 720, tickOff: 1440 },
    ])
  })

  it('gives a note too short for one tick a tick of its own', () => {
    const [e] = shownNotesToMidiEvents(
      [{ id: 'a', startBeat: 1, endBeat: 1.0001, midi: 60 }],
      120,
    )
    expect(e.tickOff - e.tickOn).toBe(1)
  })

  it('reads an unknown tempo as 120', () => {
    const [e] = shownNotesToMidiEvents(
      [{ id: 'a', startBeat: 0.5, endBeat: 1.0, midi: 69 }],
      Number.NaN,
    )
    expect(e).toEqual({ midi: 69, tickOn: 480, tickOff: 960 })
  })
})
