// Studio MIDI render key tests — the key is 16 hex digits, the same whatever order the notes are kept in, their ids and the next id, and a written-out default; it changes with every field that changes the sound, the lane's sound and the renderer's version; and the fixture's key is pinned, so a change to the hash shows.
import { describe, expect, it } from 'vitest'
import type { StudioNote, StudioSequence } from '../model/types'
import { MIDI_RENDER_VERSION, studioMidiRenderKey } from './render-key'

const NOTES: readonly StudioNote[] = [
  { id: 1, pitch: 60, startTick: 0, lengthTicks: 480, velocity: 0.8 },
  { id: 2, pitch: 64, startTick: 0, lengthTicks: 480, velocity: 0.6 },
  { id: 3, pitch: 67, startTick: 960, lengthTicks: 960, velocity: 0.7874 },
]

const SEQUENCE: StudioSequence = {
  id: 'sequence-1',
  ppq: 960,
  tempoBpm: 120,
  lengthTicks: 3840,
  nextNoteId: 4,
  notes: NOTES,
}

const key = (sequence: Partial<StudioSequence> = {}) =>
  studioMidiRenderKey({ ...SEQUENCE, ...sequence }, 'piano')

/** The sequence with its note `index` changed by `change`. */
const changed = (index: number, change: Partial<StudioNote>) =>
  key({
    notes: NOTES.map((note, at) =>
      at === index ? { ...note, ...change } : note,
    ),
  })

describe('studioMidiRenderKey', () => {
  it('is 16 hex digits, pinned for one sequence at this render version', () => {
    expect(MIDI_RENDER_VERSION).toBe(1)
    expect(key()).toBe('49b8eedc4891b2e3')
  })

  it('is the same whatever order the notes are kept in', () => {
    expect(key({ notes: [...NOTES].reverse() })).toBe(key())
    expect(key({ notes: [NOTES[2], NOTES[0], NOTES[1]] })).toBe(key())
  })

  it('is the same for notes renumbered and another next id, which change no sound', () => {
    const renumbered = NOTES.map((note, index) => ({ ...note, id: 10 + index }))
    expect(key({ notes: renumbered, nextNoteId: 13 })).toBe(key())
    expect(key({ id: 'another' })).toBe(key())
  })

  it('reads a default left out as the default written out', () => {
    expect(changed(0, { releaseVelocity: 0.5, channel: 0 })).toBe(key())
  })

  it.each<[string, Partial<StudioNote>]>([
    ['pitch', { pitch: 61 }],
    ['start', { startTick: 1 }],
    ['length', { lengthTicks: 481 }],
    ['velocity', { velocity: 0.8001 }],
    ['release velocity', { releaseVelocity: 0.25 }],
    ['channel', { channel: 9 }],
  ])("changes with a note's %s", (_field, change) => {
    expect(changed(2, change)).not.toBe(key())
  })

  it("changes with the sequence's tempo, its length, a note more or less, and the lane's sound", () => {
    const keys = [
      key(),
      key({ tempoBpm: 121 }),
      key({ lengthTicks: 3841 }),
      key({ notes: NOTES.slice(1) }),
      key({ notes: [] }),
      studioMidiRenderKey(SEQUENCE, 'drums'),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
})
