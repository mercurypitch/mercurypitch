// ============================================================
// Take reading tests — every line a sung note can earn, on synthetic frames
// ============================================================
//
// The frames are what the F0 stream hands over: a time, a frequency and a
// confidence every 16 ms, silent until the voice starts. Each case is one of
// WEB-SPEC's (Toys 7, "Tests"), plus the edges either side of each band, a
// sweep that holds the page's band to Voice Mirror's own scorer, and the
// guided-voice claims check over every line.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import { scoreMatchTake } from '@/lib/mirror/metrics'
import type { TakeReading } from './take'
import { canTryAgain, countLine, countRun, MAX_TRIES, NONE_HEARD_LINE, NOT_STEADY_LINE, octaveLine, readingLine, readTake, TRICKY_LINE, trickyAfter, } from './take'

const HOP = 0.016
const A3 = 57

/**
 * A take: `wait` seconds of silence, then `voice` seconds of a steady note
 * `cents` from MIDI `midi`, as the stream would deliver it.
 */
function take(midi: number, cents: number, voice = 3, wait = 0.5): F0Frame[] {
  const frames: F0Frame[] = []
  const hz = 440 * 2 ** ((midi * 100 + cents - 6900) / 1200)
  for (let t = 0; t < wait + voice; t += HOP) {
    const sung = t >= wait
    frames.push({ t, f0: sung ? hz : 0, conf: sung ? 0.95 : 0 })
  }
  return frames
}

const read = (cents: number, midi = A3): TakeReading =>
  readTake(take(midi, cents), A3)

describe('readTake', () => {
  it('reads a note 12 cents above as right in the middle, the tightest band', () => {
    // Act
    const r = read(12)

    // Assert
    expect(r.line).toBe("Right in the middle: 12 cents above Merc's note.")
    expect([r.band, r.landed, r.octaveLine]).toEqual(['middle', true, null])
  })

  it("reads a note 20 cents above as in the band: LESSON.md's example line", () => {
    // Act
    const r = read(20)

    // Assert
    expect(r.line).toBe("In the band: 20 cents above Merc's note.")
    expect([r.band, r.landed, r.octaveLine]).toEqual(['band', true, null])
  })

  it('reads a note 45 cents below as close, outside the band', () => {
    // Act
    const r = read(-45)

    // Assert
    expect(r.line).toBe(
      "Close: 45 cents below Merc's note. Listen again, then aim a touch higher.",
    )
    expect(r.landed).toBe(false)
  })

  it('reads a note 200 cents below as about two semitones below, nearer a different note', () => {
    // Act
    const r = read(-200)

    // Assert
    expect(r.line).toBe(
      'About two semitones below, nearer a different note. Listen again, then slide up to the band.',
    )
    expect(r.band).toBe('outside')
  })

  it('reads a note 120 cents above as about a semitone, sliding down', () => {
    // Act
    const r = read(120)

    // Assert
    expect(r.line).toBe(
      'About a semitone above, nearer a different note. Listen again, then slide down to the band.',
    )
  })

  it('counts an octave below and 25 cents high as in the band, and says it is the same note', () => {
    // Act
    const r = read(-1200 + 25)

    // Assert
    expect(r.line).toBe("In the band: 25 cents above Merc's note.")
    expect(r.octaveLine).toBe('You sang it an octave lower: same note.')
    expect(r.octaves).toBe(-1)
  })

  it('calls an octave below and 55 cents high close, with no octave line', () => {
    // Act
    const r = read(-1200 + 55)

    // Assert
    expect(r.line).toBe(
      "Close: 55 cents above Merc's note. Listen again, then aim a touch lower.",
    )
    expect(r.octaveLine).toBeNull()
  })

  it('never calls an octave below and 200 cents high the same note', () => {
    // Act
    const r = read(-1200 + 200)

    // Assert
    expect(r.line).toMatch(
      /^About two semitones above, nearer a different note/,
    )
    expect(r.octaveLine).toBeNull()
  })

  it('names an octave higher too', () => {
    // Act
    const r = read(1200 - 5)

    // Assert
    expect(r.octaveLine).toBe('You sang it an octave higher: same note.')
  })

  it('gives no reading at all for 0.4 s of voice: not a steady note, never a low score', () => {
    // Act
    const r = readTake(take(A3, 0, 0.4), A3)

    // Assert
    expect(r).toMatchObject({ steady: false, d: null, landed: false })
    expect(r.line).toBe(NOT_STEADY_LINE)
  })

  it('gives no reading for a silent take', () => {
    // Act
    const r = readTake(take(A3, 0, 0), A3)

    // Assert
    expect(r.steady).toBe(false)
  })

  it('leaves the attack out: a scoop into the note does not pull the reading', () => {
    // Arrange: 0.25 s sliding up from 150 cents low, then the note itself
    const frames = take(A3, 0)
    const hz = (c: number): number => 440 * 2 ** ((A3 * 100 + c - 6900) / 1200)
    const scooped = frames.map((f) =>
      f.f0 > 0 && f.t < 0.75
        ? { ...f, f0: hz(-150 + ((f.t - 0.5) / 0.25) * 150) }
        : f,
    )

    // Act
    const r = readTake(scooped, A3)

    // Assert
    expect(r.band).toBe('middle')
    expect(Math.abs(r.d ?? 99)).toBeLessThan(2)
  })
})

describe('the reading lines', () => {
  it('speak of one cent in the singular, and of being on the note at zero', () => {
    expect(readingLine(1)).toBe(
      "Right in the middle: 1 cent above Merc's note.",
    )
    expect(readingLine(0.3)).toBe("Right in the middle: on Merc's note.")
  })

  it("add the octave line only within 50 cents of Merc's note", () => {
    expect(octaveLine(50, -1)).toBe('You sang it an octave lower: same note.')
    expect(octaveLine(51, -1)).toBeNull()
    expect(octaveLine(10, 0)).toBeNull()
  })
})

describe("the page's band against Voice Mirror's scorer", () => {
  it('agrees on every steady take within 60 cents', () => {
    // Arrange: Voice Mirror names the bands bullseye, hit and close
    const theirs = { bullseye: 'middle', hit: 'band', close: 'close' } as const
    const offsets = [0, 5, 10, 14, 16, 20, 30, 34, 36, 45, 55, 59]

    for (const offset of [...offsets, ...offsets.map((o) => -o)]) {
      // Act
      const frames = take(A3, offset)
      const ours = readTake(frames, A3).band
      const mirror = scoreMatchTake(frames, A3).band

      // Assert
      expect(mirror in theirs, `${offset}`).toBe(true)
      expect(ours, `${offset} cents`).toBe(
        theirs[mirror as keyof typeof theirs],
      )
    }
  })
})

describe('countRun and countLine', () => {
  const steady = (cents: number): TakeReading => read(cents)
  const unsteady = readTake(take(A3, 0, 0.4), A3)

  it('counts three heard notes, two in the band, as 2 of your 3, with the learning line', () => {
    // Act
    const c = countRun([[steady(10)], [steady(-20)], [steady(-200)]])

    // Assert
    expect(countLine(c)).toBe(
      'This time, 2 of your 3 notes landed in the band.',
    )
    expect(trickyAfter(c)).toBe(true)
  })

  it('leaves out a note with no steady take, never counting it as a miss', () => {
    // Act
    const c = countRun([[steady(5)], [unsteady], [steady(80)]])

    // Assert
    expect(countLine(c)).toBe(
      'This time, 1 of the 2 notes we heard landed in the band.',
    )
  })

  it('gives no count at all when no note was heard', () => {
    // Act
    const c = countRun([[unsteady], [unsteady, unsteady], []])

    // Assert
    expect(countLine(c)).toBeNull()
    expect(trickyAfter(c)).toBe(false)
    expect(NONE_HEARD_LINE).toBe("We didn't hear a steady note this time.")
  })

  it('counts each note by its last steady take: a later steady take replaces an earlier one', () => {
    // Act
    const better = countRun([
      [steady(-200), steady(5)],
      [steady(0)],
      [steady(0)],
    ])
    const worse = countRun([
      [steady(5), steady(-200)],
      [steady(0)],
      [steady(0)],
    ])

    // Assert
    expect(better.landed).toBe(3)
    expect(worse.landed).toBe(2)
  })

  it('lets a take that was not steady replace nothing', () => {
    // Act
    const c = countRun([[steady(5), unsteady], [steady(0)], [steady(0)]])

    // Assert
    expect(c).toEqual({ heard: 3, landed: 3, of: 3 })
    expect(trickyAfter(c)).toBe(false)
  })
})

describe('the three-try limit', () => {
  it('offers Again after a first and a second try, and only Next after the third', () => {
    // Act
    const offers = [1, 2, 3].map(canTryAgain)

    // Assert
    expect(MAX_TRIES).toBe(3)
    expect(offers).toEqual([true, true, false])
  })
})

describe('the claims check (src/lib/guided-voice/claims.ts)', () => {
  it('passes every line a take or a run can show as a finding', () => {
    // Arrange: every band, both directions, every octave, every count shape
    const lines = new Set<string>([
      NOT_STEADY_LINE,
      NONE_HEARD_LINE,
      TRICKY_LINE,
    ])
    for (let d = -600; d <= 600; d += 5) lines.add(readingLine(d))
    for (const o of [-2, -1, 1, 2]) lines.add(octaveLine(0, o) ?? '')
    for (const [heard, landed] of [
      [3, 0],
      [3, 2],
      [3, 3],
      [2, 1],
      [1, 0],
    ])
      lines.add(countLine({ heard, landed, of: 3 }) ?? '')

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })
})
