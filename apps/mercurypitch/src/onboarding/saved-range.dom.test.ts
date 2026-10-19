// ============================================================
// A range this phone measured before, as the reveal draws one
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { voiceTypeHint } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { slideWindow } from './range-frames.test-fixtures'
import { readRange, readSlide } from './range-take'
import { rangeFromEnds, savedRange } from './saved-range'

const KEY = 'mercurypitch.voiceprints.v1'

/** A voiceprint kept on this phone: E2 to G4 unless told otherwise. */
function kept(fields: Record<string, unknown> = {}): unknown {
  return {
    id: 'kept',
    summary: {
      lowMidi: 40,
      highMidi: 67,
      semitones: 27,
      accuracy: null,
      steadiness: null,
    },
    twin: null,
    source: 'onboarding',
    takenAt: '2026-10-18T09:00:00.000Z',
    madeBy: 'anonymous',
    ...fields,
  }
}

function keep(...records: unknown[]): void {
  localStorage.setItem(KEY, JSON.stringify(records))
}

afterEach(() => {
  localStorage.clear()
})

describe('rangeFromEnds', () => {
  it('names both ends, the span and every semitone between them', () => {
    const range = rangeFromEnds(40, 67)

    expect(range.lowNote).toBe('E2')
    expect(range.highNote).toBe('G4')
    expect(range.semitones).toBe(27)
    expect(range.qualifyingMidis).toHaveLength(28)
    expect(range.qualifyingMidis[0]).toBe(40)
    expect(range.qualifyingMidis.at(-1)).toBe(67)
    expect(range.voiceHint).toBe(voiceTypeHint(40, 67))
  })

  it('gives the voice type and the twin the measured range gave', () => {
    const slides = [slideWindow(52, 40), slideWindow(45, 67)].map((frames) => {
      const reading = readSlide(frames)
      if (reading.kind !== 'done') throw new Error(reading.kind)
      return reading.frames
    })
    const measured = readRange(slides)
    if (measured.kind !== 'range') throw new Error(measured.kind)

    const again = rangeFromEnds(measured.range.lowMidi, measured.range.highMidi)

    expect(again.voiceHint).toBe(measured.range.voiceHint)
    expect(singerForRange(again)).toBe(singerForRange(measured.range))
    expect(singerForRange(again)).not.toBeNull()
  })
})

describe('savedRange', () => {
  it('is null on a phone that keeps no range', () => {
    expect(savedRange()).toBeNull()
  })

  it("is the range Keep's card shows: the newest one kept", () => {
    keep(
      kept({ id: 'older', takenAt: '2026-10-01T09:00:00.000Z' }),
      kept({
        id: 'newer',
        summary: {
          lowMidi: 45,
          highMidi: 72,
          semitones: 27,
          accuracy: null,
          steadiness: null,
        },
      }),
    )

    expect(savedRange()).toMatchObject({ lowNote: 'A2', highNote: 'C5' })
  })

  it('leaves out a range another account made, and a voiceprint with no range', () => {
    keep(
      kept({ id: 'theirs', madeBy: 'someone-else' }),
      kept({
        id: 'no-range',
        summary: {
          lowMidi: null,
          highMidi: null,
          semitones: null,
          accuracy: 80,
          steadiness: null,
        },
      }),
    )

    expect(savedRange()).toBeNull()
  })
})
