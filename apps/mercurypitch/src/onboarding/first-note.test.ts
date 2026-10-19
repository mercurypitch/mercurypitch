// ============================================================
// First note: the floor, the onset, the take and the settled note
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { FLOOR_SEC, LOUD_RMS, NUDGE_SEC, ONSET_RMS, onsetBar, readTake, TAKE_MAX_SEC, TAKE_SEC, } from './first-note'

const RATE = 100

/** Frames from `from` to `to` s at RATE a second. */
function span(
  from: number,
  to: number,
  frame: (t: number) => Omit<PitchFrame, 't'>,
): PitchFrame[] {
  const out: PitchFrame[] = []
  for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) {
    const t = i / RATE
    out.push({ t, ...frame(t) })
  }
  return out
}

const quiet =
  (rms = 0.002) =>
  () => ({ f0: 0, conf: 0, rms })
const sung =
  (hz: number, rms = 0.1) =>
  () => ({ f0: hz, conf: 0.95, rms })

describe('readTake', () => {
  it('learns the room before judging anything in it', () => {
    expect(readTake([])).toEqual({ kind: 'floor' })
    expect(readTake(span(0, FLOOR_SEC - 0.05, sung(220)))).toEqual({
      kind: 'floor',
    })
  })

  it('waits for a voice, and nudges after NUDGE_SEC of none', () => {
    expect(readTake(span(0, 2, quiet()))).toEqual({
      kind: 'waiting',
      nudge: false,
    })
    expect(readTake(span(0, NUDGE_SEC + 0.1, quiet()))).toEqual({
      kind: 'waiting',
      nudge: true,
    })
  })

  it('starts the take on a voiced onset, not on the clock', () => {
    const frames = [...span(0, 2, quiet()), ...span(2, 3.5, sung(220))]
    const reading = readTake(frames)
    expect(reading.kind).toBe('taking')
    if (reading.kind !== 'taking') return
    expect(reading.onset).toBeCloseTo(2, 5)
    expect(reading.progress).toBeCloseTo((3.49 - 2) / TAKE_SEC, 2)
  })

  it('names the note held across the take', () => {
    const frames = [
      ...span(0, 1, quiet()),
      ...span(1, 1 + TAKE_SEC + 0.05, sung(220)),
    ]
    const reading = readTake(frames)
    expect(reading).toMatchObject({ kind: 'done', note: { note: 'A3' } })
  })

  it('names no note it did not hear settle', () => {
    // Loud, but never voiced: a clap, a cough, a door. It gets the longest
    // take there is, in case it turns into a note, and then no name.
    const noise = () => ({ f0: 0, conf: 0, rms: 0.2 })
    const at3 = [...span(0, 1, quiet()), ...span(1, 1 + TAKE_SEC + 0.05, noise)]
    expect(readTake(at3)).toMatchObject({ kind: 'taking', progress: 1 })
    const frames = [
      ...span(0, 1, quiet()),
      ...span(1, 1 + TAKE_MAX_SEC + 0.05, noise),
    ]
    expect(readTake(frames)).toEqual({ kind: 'done', note: null })
  })

  it('keeps a slow screen listening until it has heard enough', () => {
    // Three frames a second: the pitch stream reads once a screen frame.
    const slow = (from: number, to: number): PitchFrame[] => {
      const out: PitchFrame[] = []
      for (let k = 0; from + k / 3 < to; k++) {
        out.push({ t: from + k / 3, f0: 220, conf: 0.95, rms: 0.1 })
      }
      return out
    }
    const quietStart = span(0, 1, quiet())
    // Three seconds in: ten heard frames, too few to name a note.
    const short = readTake([...quietStart, ...slow(1, 1 + TAKE_SEC + 0.01)])
    expect(short).toMatchObject({ kind: 'taking', progress: 1 })
    // A little longer, and the note is named.
    const named = readTake([...quietStart, ...slow(1, 1 + TAKE_SEC + 1)])
    expect(named).toMatchObject({ kind: 'done', note: { note: 'A3' } })
  })

  it('names a note the voice held when a slow screen hears two', () => {
    // The probe's voice: A4, a short silence, then C5. Three frames a
    // second hear six of the A4 and, by the time the take has twelve, six
    // of the C5: an even split, whose mean is a note nobody sang.
    const at3 = (from: number, count: number, hz: number): PitchFrame[] =>
      Array.from({ length: count }, (_, k) => ({
        t: from + k / 3,
        f0: hz,
        conf: 0.95,
        rms: 0.1,
      }))
    const frames = [
      ...span(0, 1, quiet()),
      ...at3(1, 6, 440),
      ...at3(3, 6, 523.25),
    ]
    expect(readTake(frames)).toMatchObject({
      kind: 'done',
      note: { note: 'A4' },
    })
  })

  it("sets the bar by the room's own noise, within its limits", () => {
    // A noisy room: its floor sets a bar a quiet voice cannot clear.
    const noisy = [
      ...span(0, FLOOR_SEC, quiet(0.006)),
      ...span(FLOOR_SEC, 3, sung(220, 0.015)),
    ]
    expect(readTake(noisy).kind).toBe('waiting')
    // A singer already singing as the mic opened: the bar stops at
    // LOUD_RMS, and the same voice starts the take.
    const already = span(0, 2, sung(220, 0.2))
    expect(readTake(already).kind).toBe('taking')
  })
})

describe('onsetBar', () => {
  it('is the floor times its headroom, between ONSET_RMS and LOUD_RMS', () => {
    expect(onsetBar(0)).toBe(ONSET_RMS)
    expect(onsetBar(0.004)).toBeCloseTo(0.014, 6)
    expect(onsetBar(0.5)).toBe(LOUD_RMS)
  })
})
