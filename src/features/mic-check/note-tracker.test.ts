import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { NoteTrackerState, PitchReading } from './note-tracker'
import { HOLD_TOLERANCE_CENTS, initialNoteTracker, LAND_MS, RELEASE_MS, trackNote, } from './note-tracker'

const FRAME_MS = 16
const A4 = 440

/** A sung frame at `cents` from MIDI `midi`, loud and clear. */
const sung = (at: number, midi: number, cents = 0): PitchReading => ({
  f0: midiToFrequency(midi + cents / 100),
  clarity: 0.9,
  rms: 0.05,
  at,
})

const unvoiced = (at: number): PitchReading => ({
  f0: 0,
  clarity: 0,
  rms: 0.001,
  at,
})

/** Feed readings in order; return the final state and every onset time. */
function run(
  readings: readonly PitchReading[],
  from: NoteTrackerState = initialNoteTracker(),
): { state: NoteTrackerState; onsets: number[] } {
  let state = from
  const onsets: number[] = []
  for (const reading of readings) {
    const step = trackNote(state, reading)
    state = step.state
    if (step.onset) onsets.push(reading.at)
  }
  return { state, onsets }
}

const frames = (from: number, to: number, make: (at: number) => PitchReading) =>
  Array.from({ length: Math.floor((to - from) / FRAME_MS) + 1 }, (_, i) =>
    make(from + i * FRAME_MS),
  )

describe('trackNote', () => {
  it('lands a held note once, after LAND_MS', () => {
    const { state, onsets } = run(frames(0, 400, (at) => sung(at, 69)))
    expect(onsets).toHaveLength(1)
    expect(onsets[0]).toBeGreaterThanOrEqual(LAND_MS)
    expect(onsets[0]).toBeLessThan(LAND_MS + 2 * FRAME_MS)
    expect(state.held?.midi).toBe(69)
    expect(state.held?.f0).toBeCloseTo(A4, 3)
    expect(Math.abs(state.held?.cents ?? 99)).toBeLessThan(0.01)
  })

  it('never lands a pitch that does not last', () => {
    const blip = frames(0, LAND_MS - 2 * FRAME_MS, (at) => sung(at, 69))
    const { state, onsets } = run([...blip, unvoiced(LAND_MS)])
    expect(onsets).toEqual([])
    expect(state.held).toBeNull()
  })

  it('ignores murky or near-silent frames', () => {
    const murky = frames(0, 400, (at) => ({ ...sung(at, 69), clarity: 0.3 }))
    const whisper = frames(0, 400, (at) => ({ ...sung(at, 69), rms: 0.001 }))
    expect(run(murky).state.held).toBeNull()
    expect(run(whisper).state.held).toBeNull()
  })

  it('holds the note through a short gap and lets go after a long one', () => {
    const held = run(frames(0, 300, (at) => sung(at, 64))).state
    const short = run(frames(310, 310 + RELEASE_MS - 40, unvoiced), held).state
    expect(short.held?.midi).toBe(64)
    const long = run(frames(310, 310 + RELEASE_MS + 40, unvoiced), held).state
    expect(long.held).toBeNull()
  })

  it('reads a bend as cents on the same note, inside the tolerance', () => {
    const held = run(frames(0, 300, (at) => sung(at, 60))).state
    const bent = run(
      frames(316, 600, (at) => sung(at, 60, 40)),
      held,
    )
    expect(bent.onsets).toEqual([])
    expect(bent.state.held?.midi).toBe(60)
    expect(bent.state.held?.cents).toBeCloseTo(40, 3)
  })

  it('does not flicker between two names on the rounding boundary', () => {
    const held = run(frames(0, 300, (at) => sung(at, 60))).state
    const edge = HOLD_TOLERANCE_CENTS - 10
    const hovering = run(
      frames(316, 900, (at) => sung(at, 60, edge)),
      held,
    )
    expect(hovering.onsets).toEqual([])
    expect(hovering.state.held?.midi).toBe(60)
  })

  it('lands the next note when the voice moves a semitone, keeping the old one meanwhile', () => {
    const held = run(frames(0, 300, (at) => sung(at, 60))).state
    const early = run(
      frames(316, 316 + LAND_MS / 2, (at) => sung(at, 61)),
      held,
    )
    expect(early.state.held?.midi).toBe(60)
    const moved = run(
      frames(316, 700, (at) => sung(at, 61)),
      held,
    )
    expect(moved.onsets).toHaveLength(1)
    expect(moved.state.held?.midi).toBe(61)
  })
})
