// ============================================================
// Hold reading tests — every line a held note can earn, on synthetic frames
// ============================================================
//
// The frames are what the F0 stream hands over: a time, a frequency and a
// confidence every 16 ms from the take opening, silent until the voice
// starts. Each case is one of WEB-SPEC's (Toys 6, "Tests"), plus the edges
// of the time it reports and the guided-voice claims check over every line.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { HoldReading } from './hold-take'
import { countedTake, fmtSeconds, hasReading, holdChartWords, holdSummary, NO_START_LINE, readHold, } from './hold-take'
import { NOT_STEADY_LINE } from './take'

const HOP = 0.016
const A3 = 57
const WAIT = 0.5

/** Cents from MIDI `midi`, as hertz. */
const hzOf = (midi: number, cents: number): number =>
  440 * 2 ** ((midi * 100 + cents - 6900) / 1200)

/**
 * A take: `wait` seconds of silence, then `voice` seconds of a note whose
 * distance from A3 at `s` seconds into the voice is `cents(s)` (null for a
 * break), then silence until `end`.
 */
function take(
  cents: (s: number) => number | null,
  voice: number,
  o: { wait?: number; end?: number; hop?: number } = {},
): F0Frame[] {
  const wait = o.wait ?? WAIT
  const hop = o.hop ?? HOP
  const end = o.end ?? wait + voice + 0.1
  const frames: F0Frame[] = []
  for (let k = 0; k * hop < end; k++) {
    const t = k * hop
    const s = t - wait
    const c = s >= 0 && s < voice ? cents(s) : null
    frames.push({
      t,
      f0: c === null ? 0 : hzOf(A3, c),
      conf: c === null ? 0 : 0.95,
    })
  }
  return frames
}

const steady =
  (cents: number): ((s: number) => number) =>
  () =>
    cents

/** A take with no frame at all from `from` to `to` seconds: the page stalled, so nothing was analysed. */
const without = (frames: F0Frame[], from: number, to: number): F0Frame[] =>
  frames.filter((f) => f.t < from - 1e-9 || f.t >= to - 1e-9)

describe('readHold (Toys 6, Tests)', () => {
  it('reads a steady A3 for 10 s as in the band for all 10 seconds', () => {
    // Act
    const r = readHold(take(steady(0), 10.2), A3, 10)

    // Assert
    expect(r.line).toBe('In the band for all 10 seconds.')
    expect([r.kind, r.inBand, r.of, r.settled, r.share]).toEqual([
      'read',
      10,
      10,
      0,
      1,
    ])
    expect(r.octaveLine).toBeNull()
  })

  it('reads one 0.05 s stretch outside the band as 9.9 of the 10 seconds, never all', () => {
    // Arrange: 50 cents high for three frames, 4.5 s in
    const cents = (s: number): number => (s >= 4.5 && s < 4.55 ? 50 : 0)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert
    expect(r.inBand).toBe(9.9)
    expect(r.line).toMatch(/^In the band for 9\.9 of the 10 seconds\. /)
    expect(r.line).not.toContain('all')
  })

  it('gives the settled line with 0.6 for a take that starts 80 cents low and stays in the band from 0.6 s', () => {
    // Arrange
    const cents = (s: number): number => (s < 0.6 ? -80 : 0)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert
    expect(r.settled).toBe(0.6)
    expect(r.line).toBe(
      `In the band for ${fmtSeconds(r.inBand)} of the 10 seconds. It settled after about 0.6 seconds.`,
    )
    expect(r.inBand).toBeGreaterThanOrEqual(9.3)
    expect(r.inBand).toBeLessThanOrEqual(9.4)
  })

  it('says a line in the band from its first frame settled straight away', () => {
    // Arrange: in the band, but one short stretch above it, so not "all"
    const cents = (s: number): number => (s >= 6 && s < 6.2 ? 60 : 5)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert
    expect(r.settled).toBe(0)
    expect(r.line).toBe(
      'In the band for 9.8 of the 10 seconds. It settled straight away.',
    )
  })

  it('reads a take whose median sits in the band but never stays half a second as in short stretches', () => {
    // Arrange: 0.4 s 10 cents high, then 0.2 s 70 cents high, over and over
    const cents = (s: number): number => (s % 0.6 < 0.4 ? 10 : 70)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert
    expect(r.settled).toBeNull()
    expect(r.line).toBe(
      `In the band for ${fmtSeconds(r.inBand)} of the 10 seconds, in short stretches.`,
    )
    expect(r.share).toBeGreaterThan(0.5)
    expect(r.share).toBeLessThan(0.8)
  })

  it('gives the close line for a steady take 45 cents low', () => {
    // Act
    const r = readHold(take(steady(-45), 10.2), A3, 10)

    // Assert
    expect(r.line).toBe(
      "Your note sat about 45 cents below Merc's, close to the band. Listen again, then aim a touch higher.",
    )
    expect([r.inBand, r.settled]).toEqual([0, null])
  })

  it("gives Lesson 3's distance line, in semitones, beyond 60 cents", () => {
    // Act
    const r = readHold(take(steady(-100), 10.2), A3, 10)

    // Assert
    expect(r.line).toBe(
      'About a semitone below, nearer a different note. Listen again, then slide up to the band.',
    )
  })

  it('gives the stopped line with 3 for a voice that stops at 3.0 s of a fifteen-second hold', () => {
    // Arrange: the take ends a second after the voice stops, as listen.ts ends it
    const frames = take(steady(0), 3, { end: WAIT + 3 + 1.2 })

    // Act
    const r = readHold(frames, A3, 15)

    // Assert
    expect(r.stoppedAt).toBe(3)
    expect(r.of).toBe(3)
    expect(r.line).toBe(
      `You stopped after about 3 seconds, in the band for ${fmtSeconds(r.inBand)} of them. Stopping early is fine.`,
    )
    expect(r.inBand).toBeLessThanOrEqual(3)
    expect(r.share).toBeCloseTo(r.inBand / 15, 9)
  })

  it('ends a hold at the first break of more than a second, whatever follows it', () => {
    // Arrange: 2 s of voice, 1.2 s of silence, then the voice again
    const cents = (s: number): number | null => (s >= 2 && s < 3.2 ? null : 0)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert
    expect(r.stoppedAt).toBe(2)
    expect(r.line).toMatch(/^You stopped after about 2 seconds/)
  })

  it('adds the octave line for an octave below and 20 cents high', () => {
    // Act
    const r = readHold(take(steady(-1200 + 20), 10.2), A3, 10)

    // Assert
    expect(r.line).toBe('In the band for all 10 seconds.')
    expect(r.octaveLine).toBe('You sang it an octave lower: same note.')
    expect(r.octaves).toBe(-1)
  })

  it('gives the close line and no octave line for an octave below and 55 cents high', () => {
    // Act
    const r = readHold(take(steady(-1200 + 55), 10.2), A3, 10)

    // Assert
    expect(r.line).toBe(
      "Your note sat about 55 cents above Merc's, close to the band. Listen again, then aim a touch lower.",
    )
    expect(r.octaveLine).toBeNull()
  })

  it('gives no steady note for 0.4 s of voice, never a low reading', () => {
    // Act
    const r = readHold(take(steady(0), 0.4), A3, 10)

    // Assert
    expect(r).toMatchObject({ kind: 'unsteady', inBand: 0, d: null })
    expect(r.line).toBe(NOT_STEADY_LINE)
  })

  it("gives the didn't-hear-you-start line when no voiced frame comes within 6 s", () => {
    // Act
    const none = readHold(take(steady(0), 0, { end: 6.05 }), A3, 10)
    const late = readHold(take(steady(0), 3, { wait: 6.5 }), A3, 10)

    // Assert
    expect(none.kind).toBe('silent')
    expect(none.line).toBe(NO_START_LINE)
    expect(late.kind).toBe('silent')
  })
})

describe('the time a hold reports', () => {
  it('carries the voice across the gaps a busy page leaves between frames', () => {
    // Act: a frame every 33 ms, as a phone delivers them when it drops frames
    const r = readHold(take(steady(0), 10.2, { hop: 0.033 }), A3, 10)

    // Assert
    expect(r.line).toBe('In the band for all 10 seconds.')
  })

  it('counts a break in the voice as time outside the band, and as a break in the settling', () => {
    // Arrange: in the band, with a 0.3 s break 0.3 s in
    const cents = (s: number): number | null => (s >= 0.3 && s < 0.6 ? null : 0)

    // Act
    const r = readHold(take(cents, 10.2), A3, 10)

    // Assert: the break costs its 0.3 s, and the reading rounds down past it
    expect(10 - r.inBand).toBeGreaterThanOrEqual(0.3 - 1e-9)
    expect(10 - r.inBand).toBeLessThanOrEqual(0.4 + 1e-9)
    expect(r.settled).toBe(0.6)
  })

  it('carries the voice across a stall of the page, where it analysed nothing at all', () => {
    // Arrange: the page stalls for 0.4 s, 4 s into the voice, and again at the hold's end
    const frames = without(
      without(take(steady(0), 10.2), WAIT + 4, WAIT + 4.4),
      WAIT + 9.8,
      WAIT + 10.1,
    )

    // Act
    const r = readHold(frames, A3, 10)

    // Assert
    expect(r.line).toBe('In the band for all 10 seconds.')
    expect([r.inBand, r.settled]).toEqual([10, 0])
  })

  it('does not let a stall early on move when the line settled', () => {
    // Act
    const r = readHold(
      without(take(steady(0), 10.2), WAIT + 0.2, WAIT + 0.5),
      A3,
      10,
    )

    // Assert
    expect(r.settled).toBe(0)
    expect(r.inBand).toBe(10)
  })

  it('counts a stall the note left the band across as outside it, as a heard frame would be', () => {
    // Arrange: in the band, then 60 cents high for a second from 4.8 s, the page stalling just before
    const cents = (s: number): number => (s >= 4.8 && s < 5.8 ? 60 : 0)
    const stalled = without(take(cents, 10.2), WAIT + 4.5, WAIT + 4.8)
    const heard = take((s) => (s >= 4.5 && s < 4.8 ? null : cents(s)), 10.2)

    // Act
    const a = readHold(stalled, A3, 10)
    const b = readHold(heard, A3, 10)

    // Assert: the stall and the second outside both cost their time
    expect(a.inBand).toBeGreaterThanOrEqual(8.6)
    expect(a.inBand).toBeLessThanOrEqual(8.7)
    expect(a.inBand).toBe(b.inBand)
  })

  it('never reads a stall of the page as the singer stopping, even a long one', () => {
    // Act: no frame at all for 1.2 s, 3 s in
    const r = readHold(
      without(take(steady(0), 10.2), WAIT + 3, WAIT + 4.2),
      A3,
      10,
    )

    // Assert: a stall that long is not carried, but it is no stop either
    expect([r.stoppedAt, r.of]).toEqual([null, 10])
    expect(r.inBand).toBeGreaterThanOrEqual(8.7)
    expect(r.inBand).toBeLessThanOrEqual(8.8)
    expect(r.line).toMatch(/^In the band for 8\.\d of the 10 seconds\. /)
  })

  it('reads nothing past the hold, however long the take ran on', () => {
    // Act
    const r = readHold(take(steady(0), 14), A3, 10)

    // Assert
    expect([r.inBand, r.of, r.line]).toEqual([
      10,
      10,
      'In the band for all 10 seconds.',
    ])
  })
})

describe('the counted take and the summary', () => {
  const read = (cents: number, length = 10): HoldReading =>
    readHold(take(steady(cents), length + 0.2), A3, length)
  const unsteady = readHold(take(steady(0), 0.4), A3, 10)

  it('counts each hold by its latest take with a reading', () => {
    // Arrange
    const first = read(-45)
    const second = read(0)

    // Act + Assert
    expect(countedTake([first, second])).toBe(second)
    expect(countedTake([first, second, unsteady])).toBe(second)
    expect(countedTake([unsteady])).toBeNull()
    expect([hasReading(first), hasReading(unsteady), hasReading(null)]).toEqual(
      [true, false, false],
    )
  })

  it('gives both readings after the fifteen-second hold, or the first alone', () => {
    // Arrange
    const first = read(0)
    const second = read(0, 15)

    // Act + Assert
    expect(holdSummary(first, second)).toBe(
      'This time your line was in the band for 10 of 10 seconds, then 15 of 15.',
    )
    expect(holdSummary(first, null)).toBe(
      'This time your line was in the band for 10 of 10 seconds.',
    )
    expect(holdSummary(null, second)).toBeNull()
  })

  it("speaks the chart's words after a hold (REQ-GVC-085)", () => {
    // Arrange
    const settled = readHold(
      take((s) => (s < 0.5 ? -80 : 0), 10.2),
      A3,
      10,
    )

    // Act + Assert
    expect(holdChartWords('A3', settled)).toBe(
      `Merc's note A3; your line in the band for ${fmtSeconds(settled.inBand)} of 10 seconds, settled after 0.5 seconds`,
    )
    expect(holdChartWords('A3', unsteady)).toBe(
      "Merc's note A3; no steady note heard",
    )
  })
})

describe('the claims check (src/lib/guided-voice/claims.ts)', () => {
  it('passes every line a hold can show as a finding', () => {
    // Arrange: every kind of line, both directions, both lengths
    const lines = new Set<string>([NO_START_LINE, NOT_STEADY_LINE])
    for (const length of [10, 15]) {
      for (let c = -600; c <= 600; c += 7) {
        const r = readHold(take(steady(c), length + 0.2), A3, length)
        lines.add(r.line)
        if (r.octaveLine !== null) lines.add(r.octaveLine)
      }
      const stopped = readHold(take(steady(0), 3, { end: 5 }), A3, length)
      lines.add(stopped.line)
      const short = readHold(
        take((s) => (s % 0.6 < 0.4 ? 10 : 70), length + 0.2),
        A3,
        length,
      )
      lines.add(short.line)
      const settled = readHold(
        take((s) => (s < 0.6 ? -80 : 0), length + 0.2),
        A3,
        length,
      )
      lines.add(settled.line)
      lines.add(holdChartWords('A3', settled))
      lines.add(holdSummary(settled, settled) ?? '')
    }

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })
})
