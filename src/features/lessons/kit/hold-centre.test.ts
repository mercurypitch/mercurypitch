// ============================================================
// Centre-line reading tests — a held note with a wave, on synthetic frames
// ============================================================
//
// The frames are what the F0 stream hands over, every 16 ms from the take
// opening (the kit's test hop): half a second of silence, then a note whose
// distance from A3 follows a wave, then silence, all through Voice Mirror's
// own `preprocess`, as every hold is read. Each case runs at twelve phases
// of the wave against the frames, and its numbers are WEB-SPEC's (Tests, 8
// and 10; FACTS 43, 44, 46), from the writer's model of both readers.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { CentredReading } from './hold-centre'
import { centreOf, readCentredHold, vibratoLine, windowStarts, } from './hold-centre'
import type { HoldReading } from './hold-take'
import { fmtSeconds, holdSummary, readHold } from './hold-take'

const HOP = 0.016
const A3 = 57
const WAIT = 0.5
const PHASES = Array.from({ length: 12 }, (_, k) => (k * 2 * Math.PI) / 12)

/** A note's distance from A3, cents, at `s` seconds into the voice. */
type Line = (s: number) => number

/**
 * A take: half a second of silence, `voice` seconds of a note whose
 * distance from A3 follows `cents`, then 0.6 s of silence; `drop` takes
 * every frame out between two times of the take, as a stalled page does.
 */
function take(
  cents: Line,
  o: { voice?: number; drop?: readonly [number, number] } = {},
): F0Frame[] {
  const voice = o.voice ?? 10
  const frames: F0Frame[] = []
  for (let k = 0; k * HOP < WAIT + voice + 0.6; k++) {
    const t = k * HOP
    if (o.drop !== undefined && t >= o.drop[0] && t < o.drop[1]) continue
    const s = t - WAIT
    const on = s >= 0 && s < voice
    frames.push({
      t,
      f0: on ? 440 * 2 ** ((A3 * 100 + cents(s) - 6900) / 1200) : 0,
      conf: on ? 0.95 : 0,
    })
  }
  return frames
}

/** ±`extent` cents at `rate` swings a second from `from` on, at phase `ph`, round a middle `base`. */
const sine =
  (
    extent: number,
    rate: number,
    ph: number,
    o: { from?: number; base?: Line } = {},
  ): Line =>
  (s) =>
    (o.base?.(s) ?? 0) +
    (s >= (o.from ?? 0) ? extent * Math.sin(2 * Math.PI * rate * s + ph) : 0)

/** ±`extent` cents at `r0` swings a second until `t0`, its rate rising linearly from there to `r1` at `t1`. */
const chirp =
  (
    extent: number,
    r0: number,
    r1: number,
    t0: number,
    t1: number,
    ph: number,
  ): Line =>
  (s) => {
    let turns = r0 * Math.min(s, t0)
    if (s > t0) {
      const v = Math.min(s, t1) - t0
      turns += r0 * v + ((r1 - r0) * v * v) / (2 * (t1 - t0))
      if (s > t1) turns += r1 * (s - t1)
    }
    return extent * Math.sin(2 * Math.PI * turns + ph)
  }

/** Each phase's reading by this reader, and by today's on the same frames. */
function atPhases(
  line: (ph: number) => Line,
  o: { voice?: number; length?: number; drop?: readonly [number, number] } = {},
): { centred: CentredReading[]; today: HoldReading[] } {
  const length = o.length ?? 10
  const centred: CentredReading[] = []
  const today: HoldReading[] = []
  for (const ph of PHASES) {
    const frames = take(line(ph), o)
    centred.push(readCentredHold(frames, A3, length))
    today.push(readHold(frames, A3, length))
  }
  return { centred, today }
}

/** The lowest and highest of a reading's numbers, over the twelve phases. */
const span = (xs: readonly number[]): [number, number] => [
  Math.min(...xs),
  Math.max(...xs),
]
const inBand = (rs: readonly HoldReading[]): [number, number] =>
  span(rs.map((r) => r.inBand))
/** The extents described, NaN where a phase found no vibrato. */
const extents = (rs: readonly CentredReading[]): [number, number] =>
  span(rs.map((r) => r.vibrato?.extent ?? Number.NaN))

describe('windowStarts (Toys 6, "Find the vibrato, window by window")', () => {
  it('starts a 3 s window at the trimmed start and every 0.5 s, the last ending at the trimmed end', () => {
    // Act
    const starts = windowStarts(0.4, 9.8)

    // Assert
    expect(starts).toHaveLength(14)
    expect(starts[0]).toBe(0.4)
    expect(starts[12]).toBeCloseTo(6.4, 9)
    expect(starts[13]).toBeCloseTo(6.8, 9)
  })

  it('judges a trimmed span of 3.0 s or less as one window', () => {
    // Assert
    expect(windowStarts(0.4, 3.4)).toEqual([0.4])
    expect(windowStarts(0.4, 2.1)).toEqual([0.4])
  })
})

describe('readCentredHold (Tests, 8)', () => {
  it("reads a ±50 wave at six swings a second round Merc's note in the band for all 10 seconds, where today's reader gives 6.1 to 6.4", () => {
    // Act
    const { centred, today } = atPhases((ph) => sine(50, 6, ph))

    // Assert
    for (const r of centred) {
      expect(r.line).toBe('In the band for all 10 seconds.')
      expect(r.vibrato?.rate).toBe(6)
    }
    const [lo, hi] = extents(centred)
    expect(lo).toBeGreaterThanOrEqual(40)
    expect(hi).toBeLessThanOrEqual(50)
    const [tlo, thi] = inBand(today)
    expect(tlo).toBeGreaterThanOrEqual(6.1)
    expect(thi).toBeLessThanOrEqual(6.4)
  })

  it('reads the same wave at least 9.8 when its rate rises from 6.0 to 7.2 over its last 1.7 s', () => {
    // Act
    const { centred } = atPhases((ph) => chirp(50, 6, 7.2, 8.3, 10, ph))

    // Assert
    expect(inBand(centred)[0]).toBeGreaterThanOrEqual(9.8)
  })

  it("reads a ±50 wave that starts 8 s in, and one that starts 6 s in, at least 9.8, where today's reader gives 9.2 to 9.3 and 8.4 to 8.6", () => {
    for (const [from, todayLo, todayHi] of [
      [8, 9.2, 9.3],
      [6, 8.4, 8.6],
    ]) {
      // Act
      const { centred, today } = atPhases((ph) => sine(50, 6, ph, { from }))

      // Assert
      expect(inBand(centred)[0], `from ${from} s`).toBeGreaterThanOrEqual(9.8)
      const [lo, hi] = extents(centred)
      expect(lo, `from ${from} s`).toBeGreaterThanOrEqual(40)
      expect(hi, `from ${from} s`).toBeLessThanOrEqual(50)
      const [tlo, thi] = inBand(today)
      expect(tlo, `today, from ${from} s`).toBeGreaterThanOrEqual(todayLo)
      expect(thi, `today, from ${from} s`).toBeLessThanOrEqual(todayHi)
    }
  })

  it('reads a wave whose rate drifts over the hold at least 9.8: ±50 from 5.5 to 6.5 a second, ±60 from 5.0 to 7.0', () => {
    for (const [extent, r0, r1, lo, hi] of [
      [50, 5.5, 6.5, 40, 50],
      [60, 5, 7, 45, 55],
    ]) {
      // Act
      const { centred } = atPhases((ph) => chirp(extent, r0, r1, 0, 10, ph))

      // Assert
      expect(inBand(centred)[0], `±${extent}`).toBeGreaterThanOrEqual(9.8)
      const [elo, ehi] = extents(centred)
      expect(elo, `±${extent}`).toBeGreaterThanOrEqual(lo)
      expect(ehi, `±${extent}`).toBeLessThanOrEqual(hi)
    }
  })

  it("reads a ±60 wave at 5.5 a second, wider than the band, as 10.0, where today's reader gives 3.9 to 4.0", () => {
    // Act
    const { centred, today } = atPhases((ph) => sine(60, 5.5, ph))

    // Assert
    expect(inBand(centred)).toEqual([10, 10])
    for (const r of centred) expect(r.vibrato?.rate).toBe(5.5)
    const [lo, hi] = extents(centred)
    expect(lo).toBeGreaterThanOrEqual(45)
    expect(hi).toBeLessThanOrEqual(55)
    const [tlo, thi] = inBand(today)
    expect(tlo).toBeGreaterThanOrEqual(3.9)
    expect(thi).toBeLessThanOrEqual(4)
  })

  it('lets a middle that drifts leave the band: ±40 round a middle rising 60 cents over 10 s reads 5.6 to 5.9, the middle leaving at 5.8 s', () => {
    // Act
    const { centred } = atPhases((ph) =>
      sine(40, 6, ph, { base: (s) => 6 * s }),
    )

    // Assert
    const [lo, hi] = inBand(centred)
    expect(lo).toBeGreaterThanOrEqual(5.6)
    expect(hi).toBeLessThanOrEqual(5.9)
    for (const r of centred) {
      const left = r.middle?.find((p) => p.t > WAIT + 1 && p.cents > 35)
      expect(Math.abs((left?.t ?? 0) - (WAIT + 5.8))).toBeLessThanOrEqual(0.1)
    }
  })

  it("finds no vibrato in a ±50 wave at two swings a second, and reads it as today's reader does, 4.8 to 4.9, with no vibrato line", () => {
    // Act
    const { centred, today } = atPhases((ph) => sine(50, 2, ph))

    // Assert
    centred.forEach((r, i) => {
      expect(r.vibrato).toBeNull()
      expect(r.middle).toBeNull()
      expect(r.line).toBe(today[i].line)
      expect(r.inBand).toBe(today[i].inBand)
    })
    const [lo, hi] = inBand(centred)
    expect(lo).toBeGreaterThanOrEqual(4.8)
    expect(hi).toBeLessThanOrEqual(4.9)
  })

  it('finds none in a straight hold with ±5 cents of noise, and reads it exactly as today, line for line', () => {
    // Arrange: twelve draws of noise, each its own
    let seed = 22
    const noise = (): number => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return (seed / 2 ** 31) * 10 - 5
    }
    for (let k = 0; k < 12; k++) {
      const draw = Array.from({ length: 700 }, noise)
      const frames = take((s) => draw[Math.min(699, Math.floor(s / HOP))])

      // Act
      const r = readCentredHold(frames, A3, 10)

      // Assert
      const { middle, vibrato, ...reading } = r
      expect([middle, vibrato]).toEqual([null, null])
      expect(reading).toEqual(readHold(frames, A3, 10))
    }
  })

  it('finds none in a ±8 wave at six a second, and reads it as today', () => {
    // Act
    const { centred, today } = atPhases((ph) => sine(8, 6, ph))

    // Assert
    centred.forEach((r, i) => {
      expect(r.vibrato).toBeNull()
      const { middle: _m, vibrato: _v, ...reading } = r
      expect(reading).toEqual(today[i])
    })
  })

  it('reads the ±50 wave an octave lower the same, with the octave line', () => {
    // Act
    const low = readCentredHold(
      take((s) => -1200 + 50 * Math.sin(2 * Math.PI * 6 * s)),
      A3,
      10,
    )
    const at = readCentredHold(
      take((s) => 50 * Math.sin(2 * Math.PI * 6 * s)),
      A3,
      10,
    )

    // Assert
    expect([low.inBand, low.line, low.octaves]).toEqual([
      at.inBand,
      at.line,
      -1,
    ])
    expect(low.octaveLine).toBe('You sang it an octave lower: same note.')
    expect(low.vibrato).toEqual(at.vibrato)
  })

  it("reads a hold that stops at 4 s at least 3.8 of its 4.0 seconds, with Lesson 5's stopped-early line, where today's reader gives 2.4 to 2.5", () => {
    // Act
    const { centred, today } = atPhases((ph) => sine(50, 6, ph), { voice: 4 })

    // Assert
    for (const r of centred) {
      expect(r.stoppedAt).toBe(4)
      expect(r.inBand).toBeGreaterThanOrEqual(3.8)
      expect(r.line).toBe(
        `You stopped after about 4 seconds, in the band for ${fmtSeconds(r.inBand)} of them. Stopping early is fine.`,
      )
    }
    const [tlo, thi] = inBand(today)
    expect(tlo).toBeGreaterThanOrEqual(2.4)
    expect(thi).toBeLessThanOrEqual(2.5)
  })

  it('changes the reading by at most 0.1 s for a stall of 0.3 s with no frames mid-hold', () => {
    // Act
    const stalled = atPhases((ph) => sine(50, 6, ph), { drop: [6, 6.3] })
    const whole = atPhases((ph) => sine(50, 6, ph))

    // Assert
    stalled.centred.forEach((r, i) => {
      expect(Math.abs(r.inBand - whole.centred[i].inBand)).toBeLessThanOrEqual(
        0.1 + 1e-9,
      )
    })
  })

  it('judges a hold whose trimmed frames span 3.0 s or less as one window, and still finds its wave', () => {
    // Act: 3.5 s sung, so 2.9 s once trimmed
    const { centred } = atPhases((ph) => sine(50, 6, ph), { voice: 3.5 })

    // Assert
    for (const r of centred) {
      expect(r.vibrato?.rate).toBe(6)
      expect(r.inBand).toBeGreaterThanOrEqual(3.3)
    }
  })
})

describe('the vibrato line and the summary (Tests, 10)', () => {
  it('describes a wave in words, the rate to 0.1 without a trailing .0, the extent in whole cents', () => {
    // Assert
    expect(vibratoLine({ rate: 5.6, extent: 38 })).toBe(
      'The note had a wave: about 5.6 swings a second, ±38 cents.',
    )
    expect(vibratoLine({ rate: 6, extent: 60 })).toBe(
      'The note had a wave: about 6 swings a second, ±60 cents.',
    )
  })

  it('takes the rate as the median of the finding windows: a wave at 5.0 for 7 s, then 7.0', () => {
    // Act
    const r = readCentredHold(
      take((s) =>
        s < 7
          ? 50 * Math.sin(2 * Math.PI * 5 * s)
          : 50 * Math.sin(2 * Math.PI * (35 + 7 * (s - 7))),
      ),
      A3,
      10,
    )

    // Assert: most windows lie in the first seven seconds
    expect(r.vibrato?.rate).toBe(5)
  })

  it('describes a ±50 sine as ±50, within 1, on frames that skip the median filter', () => {
    for (const ph of PHASES) {
      // Arrange: the held run itself, as the reader is handed it
      const frames = Array.from({ length: 626 }, (_, k) => ({
        t: k * HOP,
        cents: A3 * 100 + 50 * Math.sin(2 * Math.PI * 6 * k * HOP + ph),
      }))

      // Act
      const centre = centreOf({
        frames,
        folded: frames.map((f) => f.cents - A3 * 100),
        hop: HOP,
      })

      // Assert
      expect(Math.abs((centre?.vibrato.extent ?? 0) - 50)).toBeLessThanOrEqual(
        1,
      )
    }
  })

  it('scores nothing and advises nothing in the line', () => {
    // Act
    const lines = [
      vibratoLine({ rate: 5.6, extent: 38 }),
      vibratoLine({ rate: 6, extent: 60 }),
    ]

    // Assert
    for (const line of lines) {
      expect(line).not.toMatch(/score|good|great|better|try|should|need/i)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
    }
  })

  it("says the middle of your line in Lesson 22's summary, and keeps Lesson 5's own", () => {
    // Arrange
    const read = (x: number): HoldReading => ({
      ...readHold(
        take(() => 0),
        A3,
        10,
      ),
      inBand: x,
    })

    // Assert
    expect(holdSummary(read(9.8), read(9.6), 'the middle of your line')).toBe(
      'This time the middle of your line was in the band for 9.8 of 10 seconds, then 9.6 of 10.',
    )
    expect(holdSummary(read(8.4), read(9.6))).toBe(
      'This time your line was in the band for 8.4 of 10 seconds, then 9.6 of 10.',
    )
  })
})
