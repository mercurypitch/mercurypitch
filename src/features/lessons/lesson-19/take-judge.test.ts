// ============================================================
// Lesson 19 take judge tests — simulated takes of each tune's beat
// ============================================================
//
// WEB-SPEC, Tests 3 (FACTS 32 to 35): seeded takes at device delays line
// up between 0 and 250 ms and read "All 8 beats got a tap" or "All 12";
// 400 ms in the 6/8 tune past the cap; 3/4's beats tapped under the 6/8
// tune, and 6/8's under the 3/4, named; every eighth, beat 1 only and a
// hand drifting 5 % fast, which name no metre; no first pass, no second;
// the other metre's places and their window; counts in words; and each
// tap's tick where it fell, gold when it met its beat. The estimator and
// the judge are the app's own, through the kit's tap judge, never copied.

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import type { MetreKey } from './rhythm-views'
import { atOther, BAR_MS, FRAMES, judgeBeats, LINES, QUARTER_MS, } from './take-judge'

/** Beat 0 of the take on the page clock, ms. */
const BEAT0 = 5000

/** A normal deviate from a seeded generator (Box-Muller). */
function gauss(random: () => number): () => number {
  return () => {
    const u = Math.max(random(), 1e-12)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
  }
}

interface TakeOptions {
  readonly delay: number
  readonly jitter?: number
  /** The hand's lead, ms: negative is early. */
  readonly bias?: number
  readonly seed?: number
  /** Whether the first pass, with the click, got its taps. */
  readonly withClick?: boolean
  /** The second pass's taps, ms from its first beat; its beats by default. */
  readonly own?: readonly number[]
}

/** Simulated taps (page ms) at a device's delay, spread around the hand's lead: the first pass on its beats, the second as given. */
function take(key: MetreKey, o: TakeOptions): number[] {
  const f = FRAMES[key]
  const g = gauss(mulberry32(o.seed ?? 1))
  const spread = (ms: number): number =>
    BEAT0 + ms + o.delay + (o.bias ?? -20) + g() * (o.jitter ?? 20)
  const first = Array.from(
    { length: f.shape.pulseTo - f.shape.pulseFrom + 1 },
    (_, k) => (f.shape.pulseFrom + k) * f.beatMs,
  )
  const origin = f.shape.judgedFrom * f.beatMs
  const own = o.own ?? f.shape.onsets.map((b) => b * f.beatMs)
  return [
    ...(o.withClick === false ? [] : first.map(spread)),
    ...own.map((ms) => spread(origin + ms)),
  ]
}

/** Exact taps: no lead and no spread. */
const exact = (key: MetreKey, own?: readonly number[], delay = 100) =>
  take(key, { delay, bias: 0, jitter: 0, own })

const judge = (key: MetreKey, taps: readonly number[]) =>
  judgeBeats(key, taps, BEAT0)

/** `k` taps, `every` ms apart from `from`. */
const run = (k: number, every: number, from = 0): number[] =>
  Array.from({ length: k }, (_, i) => from + i * every)

describe('the frames', () => {
  it("counts each tune in its own beats: 6/8's dotted quarters of 1 s, 3/4's quarters of 0.67 s, eight and twelve judged (FACTS 32, 33)", () => {
    // Assert
    expect(FRAMES['6-8'].beatMs).toBe(1000)
    expect(FRAMES['3-4'].beatMs).toBeCloseTo(666.667, 2)
    expect(
      (['6-8', '3-4'] as const).map((k) => {
        const s = FRAMES[k].shape
        return [s.pulseFrom, s.pulseTo, s.judgedFrom, s.onsets.length]
      }),
    ).toEqual([
      [2, 9, 10, 8],
      [3, 14, 15, 12],
    ])
    expect(BAR_MS).toBe(2000)
  })

  it("places the other metre's beats: 3/4's two thirds and four thirds of a beat after each 6/8 bar's beat 1, 6/8's second beat a beat and a half after each 3/4 bar's", () => {
    // Assert: within the 120 ms window of each place, in every bar
    const Q = QUARTER_MS
    expect(
      [Q, 2 * Q, 2000 + Q + 119, 6000 + 2 * Q - 119, 2000 + Q + 121, 1000].map(
        (at) => atOther(FRAMES['6-8'], at),
      ),
    ).toEqual([true, true, true, true, false, false])
    expect(
      [1000, 3000, 7000 + 119, 1000 + 121, 0, 2000].map((at) =>
        atOther(FRAMES['3-4'], at),
      ),
    ).toEqual([true, true, true, false, false, false])
  })
})

describe('judgeBeats on simulated takes', () => {
  it('lines up delays of 0 to 250 ms and reads a clean take of either tune as every beat', () => {
    for (const key of ['6-8', '3-4'] as const)
      for (const delay of [0, 50, 100, 150, 200, 250])
        for (const seed of [1, 2, 3, 4, 5]) {
          // Act
          const r = judge(key, take(key, { delay, seed }))
          const label = `${key}, ${delay} ms, seed ${seed}`

          // Assert (FACTS 35)
          expect(r.latencyMs ?? -1, label).toBeGreaterThanOrEqual(0)
          expect(r.latencyMs ?? 999, label).toBeLessThanOrEqual(250)
          expect(r.line, label).toBe(
            key === '6-8' ? LINES.all(8) : LINES.all(12),
          )
        }
  })

  it('reads the same at 350 ms in the 6/8 tune and at 300 ms in the 3/4, the estimate held at 250', () => {
    // Act
    const six = judge('6-8', take('6-8', { delay: 350, jitter: 10 }))
    const three = judge('3-4', take('3-4', { delay: 300, jitter: 10 }))

    // Assert (FACTS 35)
    expect([six.latencyMs, three.latencyMs]).toEqual([250, 250])
    expect([six.line, three.line]).toEqual([
      'All 8 beats got a tap, and no tap fell between them.',
      'All 12 beats got a tap, and no tap fell between them.',
    ])
  })

  it('meets few beats at 400 ms in the 6/8 tune, the cap leaving the taps some 130 ms late', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      // Act
      const r = judge('6-8', take('6-8', { delay: 400, seed }))

      // Assert (FACTS 35)
      expect(r.latencyMs, `seed ${seed}`).toBe(250)
      expect(r.met, `seed ${seed}`).toBeLessThan(5)
      expect(r.line, `seed ${seed}`).toMatch(
        /^Beats with a tap: \d of 8\. .+ fell between the beats\.$/,
      )
    }
  })

  it("names 3/4's beats tapped under the 6/8 tune, and 6/8's under the 3/4", () => {
    // Act: three taps to each 6/8 bar; two to each 3/4 bar
    const threes = judge('6-8', exact('6-8', run(12, QUARTER_MS)))
    const twos = judge('3-4', exact('3-4', run(8, 1.5 * QUARTER_MS)))

    // Assert (FACTS 34, 35)
    expect(threes.line).toBe(
      "Beats with a tap: 4 of 8. Eight taps fell where 3/4's beats would be.",
    )
    expect(twos.line).toBe(
      "Beats with a tap: 4 of 12. Four taps fell where 6/8's second beat would be.",
    )
  })

  it('names no metre for every eighth, beat 1 alone, or a hand drifting 5 % fast', () => {
    // Act
    const eighths = judge('6-8', exact('6-8', run(24, QUARTER_MS / 2)))
    const ones = judge('6-8', exact('6-8', run(4, BAR_MS)))
    const drift = judge('6-8', exact('6-8', run(8, 950)))

    // Assert (FACTS 35): the eighths past the judge's bar are not counted
    expect(eighths.line).toBe(
      'Beats with a tap: 8 of 8. 15 taps fell between the beats.',
    )
    expect(ones.line).toBe('Beats with a tap: 4 of 8.')
    expect(drift.line).toBe(
      'Beats with a tap: 3 of 8. Five taps fell between the beats.',
    )
  })

  it('names the other metre only for four taps or more, two thirds of those over at least', () => {
    // Arrange: 6/8's beats, then three and four of 3/4's places, then four with three more elsewhere
    const beats = run(8, 1000)
    const places = [666.67, 2666.67, 4666.67, 6666.67]
    const elsewhere = [500, 2500, 4500]

    // Act
    const three = judge('6-8', exact('6-8', [...beats, ...places.slice(0, 3)]))
    const four = judge('6-8', exact('6-8', [...beats, ...places]))
    const mixed = judge(
      '6-8',
      exact('6-8', [...beats, ...places, ...elsewhere]),
    )

    // Assert
    expect(three.line).toBe(
      'Beats with a tap: 8 of 8. Three taps fell between the beats.',
    )
    expect(four.line).toBe(
      "Beats with a tap: 8 of 8. Four taps fell where 3/4's beats would be.",
    )
    expect(mixed.line).toBe(
      'Beats with a tap: 8 of 8. Seven taps fell between the beats.',
    )
  })

  it('says one tap in words, and a count from 10 in figures', () => {
    // Act
    const one = judge('3-4', exact('3-4', [...run(12, QUARTER_MS), 500]))
    const ten = judge(
      '3-4',
      exact('3-4', [...run(12, QUARTER_MS), ...run(10, QUARTER_MS, 330)]),
    )

    // Assert
    expect(one.line).toBe(
      'Beats with a tap: 12 of 12. One tap fell between the beats.',
    )
    expect(ten.line).toMatch(/^Beats with a tap: 12 of 12\. 10 taps fell/)
  })

  it('cannot line up a take with no taps while the click played, and says so', () => {
    // Act
    const r = judge('6-8', take('6-8', { delay: 100, withClick: false }))

    // Assert (FACTS 34)
    expect([r.line, r.latencyMs, r.met, r.ticks]).toEqual([
      LINES.notLined,
      null,
      0,
      [],
    ])
  })

  it('says no tap came once the click stopped, for a take that kept none', () => {
    // Act
    const r = judge('3-4', exact('3-4', []))

    // Assert (FACTS 34)
    expect(r.line).toBe(
      'No taps came once the click stopped. Keep tapping the beat while the tune plays again.',
    )
  })

  it('ticks each lined-up tap where it fell, in quarter notes from the judged first beat, gold when it met its beat', () => {
    // Act: beat 1 early by 60 ms, then a tap between beats 1 and 2
    const r = judge('6-8', exact('6-8', [-60, 500, ...run(7, 1000, 1000)]))

    // Assert
    expect(
      r.ticks.slice(0, 3).map((t) => [Number(t.beat.toFixed(3)), t.met]),
    ).toEqual([
      [-0.09, true],
      [0.75, false],
      [1.5, true],
    ])
    expect(r.ticks).toHaveLength(9)
  })
})
