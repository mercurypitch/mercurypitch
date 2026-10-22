// ============================================================
// Lesson 8 take judge tests — simulated takes, as verify08.py § 7 runs them
// ============================================================
//
// WEB-SPEC, Tests 5 (FACTS 41, 42, 44): seeded takes at device delays of 0
// to 300 ms line up and read as a backbeat; a delay past half a beat
// cannot be lined up; the lines for taps a beat early, on every beat, off
// the beat and missing; 120 ms either side counts and 121 ms does not; the
// 250 ms cap; fewer than five pulse samples; a second tap on one beat
// matches no beat; counts in words. The estimator and the judge are the
// app's own, imported (take-judge.ts), never copied.

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { judgeBackbeat, LINES, takeLine, tapsWord, WINDOW_MS, } from './take-judge'

const P = 60000 / 90
const PULSE = [4, 5, 6, 7, 8, 9, 10, 11]
const BACK = Array.from({ length: 16 }, (_, i) => 12 + i)
const TARGETS = BACK.filter((b) => b % 2 === 1)
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
  readonly jitter: number
  readonly bias?: number
  readonly seed: number
  readonly pulse?: 'every' | 'backbeat'
  readonly back?: 'backbeat' | 'every' | 'none' | 'offbeats'
  readonly early?: readonly number[]
}

/** Simulated taps (page ms): `delay` is the device's, `bias` the hand's lead (negative is early). */
function take(o: TakeOptions): number[] {
  const g = gauss(mulberry32(o.seed))
  const at = (beat: number) =>
    BEAT0 + beat * P + o.delay + (o.bias ?? -20) + g() * o.jitter
  const pulse =
    o.pulse === 'backbeat' ? PULSE.filter((b) => b % 2 === 1) : PULSE
  const back = {
    backbeat: TARGETS,
    every: BACK,
    none: [],
    offbeats: BACK.filter((b) => b % 2 === 0).map((b) => b + 0.5),
  }[o.back ?? 'backbeat']
  return [
    ...pulse.map(at),
    ...back.map((b) => at(o.early?.includes(b) === true ? b - 1 : b)),
  ]
}

const judge = (taps: number[]) => judgeBackbeat(taps, BEAT0, P)

describe('judgeBackbeat on simulated takes', () => {
  it('lines up delays of 0 to 300 ms by 0 to 250 ms, and reads taps spread 20 ms as a backbeat', () => {
    for (const delay of [0, 100, 200, 250, 300])
      for (const jitter of [20, 40])
        for (const seed of [1, 2, 3, 4, 5]) {
          // Act
          const r = judge(take({ delay, jitter, seed }))
          const label = `${delay} ms, ${jitter} ms, seed ${seed}`

          // Assert
          expect(r.latencyMs, label).not.toBeNull()
          expect(r.latencyMs ?? -1).toBeGreaterThanOrEqual(0)
          expect(r.latencyMs ?? 999).toBeLessThanOrEqual(250)
          // a 40 ms spread around a 20 ms lead puts a tap past 120 ms now and then
          if (jitter === 20) expect(r.line, label).toBe(LINES.backbeat)
          else expect(r.onBackbeat, label).toBeGreaterThanOrEqual(7)
          expect(r.onOneThree, label).toBe(0)
        }
  })

  it('counts two taps a beat early as landing on 1 or 3', () => {
    // Act
    const r = judge(take({ delay: 200, jitter: 30, seed: 2, early: [15, 23] }))

    // Assert
    expect(r.line).toBe('On 2 and 4: 6 of 8. Two taps landed on 1 or 3.')
  })

  it('says every beat is not a backbeat', () => {
    // Act
    const r = judge(take({ delay: 150, jitter: 30, seed: 4, back: 'every' }))

    // Assert
    expect(r.line).toBe(
      "That's every beat: 8 on 2 and 4 and 8 on 1 and 3. A backbeat is 2 and 4 only.",
    )
  })

  it('says so when nothing came in the last four bars', () => {
    // Act
    const r = judge(take({ delay: 150, jitter: 30, seed: 5, back: 'none' }))

    // Assert
    expect(r.line).toBe(LINES.none)
  })

  it('cannot line up four pulse samples, and says how to tap', () => {
    // Act
    const r = judge(
      take({ delay: 150, jitter: 30, seed: 6, pulse: 'backbeat' }),
    )

    // Assert
    expect(r.line).toBe(LINES.notLined)
    expect(r.latencyMs).toBeNull()
    expect(r.ticks.flat()).toEqual([])
  })

  it('counts the "and"s between beats as matching no beat', () => {
    // Act
    const r = judge(take({ delay: 150, jitter: 30, seed: 7, back: 'offbeats' }))

    // Assert
    expect(r.line).toBe('On 2 and 4: 0 of 8. Eight taps matched no beat.')
  })

  it('cannot see a delay past half a beat, and describes taps that matched no beat', () => {
    // Act
    const r = judge(take({ delay: 400, jitter: 20, seed: 8 }))

    // Assert
    expect(r.line).toBe('On 2 and 4: 0 of 8. Seven taps matched no beat.')
  })
})

describe('the window and the cap', () => {
  /** A beat of 500 ms (120 BPM), so a tap's distance from its beat is exact. */
  const B = 500
  /** Pulse taps exactly on their beats, so the take lines up by 0, and backbeat taps shifted as given. */
  const exact = (shift: (beat: number) => number) => [
    ...PULSE.map((b) => BEAT0 + b * B),
    ...TARGETS.map((b) => BEAT0 + b * B + shift(b)),
  ]
  const judge = (taps: number[]) => judgeBackbeat(taps, BEAT0, B)

  it('counts a tap 120 ms either side of its beat, and not one 121 ms off', () => {
    // Act
    const late = judge(exact((b) => (b === 13 ? WINDOW_MS : 0)))
    const early = judge(exact((b) => (b === 13 ? -WINDOW_MS : 0)))
    const over = judge(exact((b) => (b === 13 ? WINDOW_MS + 1 : 0)))

    // Assert
    expect(WINDOW_MS).toBe(120)
    expect(late.latencyMs).toBe(0)
    expect(late.line).toBe(LINES.backbeat)
    expect(early.line).toBe(LINES.backbeat)
    expect(over.line).toBe('On 2 and 4: 7 of 8. One tap matched no beat.')
  })

  it('lines up by at most 250 ms, and a 300 ms delay still lands inside the window', () => {
    // Act
    const taps = [
      ...PULSE.map((b) => BEAT0 + b * P + 300),
      ...TARGETS.map((b) => BEAT0 + b * P + 300),
    ]
    const r90 = judgeBackbeat(taps, BEAT0, P)

    // Assert: 50 ms over, inside the window
    expect(r90.latencyMs).toBe(250)
    expect(r90.line).toBe(LINES.backbeat)
  })

  it('lines up from five pulse samples, not four', () => {
    // Arrange
    const back = TARGETS.map((b) => BEAT0 + b * B)

    // Act
    const four = judge([
      ...PULSE.slice(0, 4).map((b) => BEAT0 + b * B),
      ...back,
    ])
    const five = judge([
      ...PULSE.slice(0, 5).map((b) => BEAT0 + b * B),
      ...back,
    ])

    // Assert
    expect(four.line).toBe(LINES.notLined)
    expect(five.line).toBe(LINES.backbeat)
  })

  it('serves each beat one tap, so a second tap on a beat matches no beat', () => {
    // Act
    const r = judge([...exact(() => 0), BEAT0 + 13 * B + 30])

    // Assert
    expect(r.onBackbeat).toBe(8)
    expect(r.line).toBe('On 2 and 4: 8 of 8. One tap matched no beat.')
  })

  it('draws the lined-up taps of the last four bars as ticks, a row a bar, gold on 2 and 4', () => {
    // Act
    const r = judge([...exact(() => 0), BEAT0 + 14 * B])

    // Assert
    expect(r.ticks).toHaveLength(4)
    const first = [...r.ticks[0]].sort((a, b) => a.beat - b.beat)
    expect(first.map((t) => [t.beat, t.gold])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ])
    for (const row of r.ticks.slice(1))
      expect(row.map((t) => t.gold)).toEqual([true, true])
  })
})

describe('the lines', () => {
  it('counts in words from One to Nine, then in figures', () => {
    // Assert
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(tapsWord)).toEqual([
      'One tap',
      'Two taps',
      'Three taps',
      'Four taps',
      'Five taps',
      'Six taps',
      'Seven taps',
      'Eight taps',
      'Nine taps',
    ])
    expect(tapsWord(10)).toBe('10 taps')
  })

  it('picks the first line that applies', () => {
    // Assert
    expect(takeLine(0, 0, 0)).toBe(LINES.none)
    expect(takeLine(7, 6, 0)).toBe(
      "That's every beat: 7 on 2 and 4 and 6 on 1 and 3. A backbeat is 2 and 4 only.",
    )
    expect(takeLine(8, 0, 0)).toBe(LINES.backbeat)
    expect(takeLine(8, 0, 1)).toBe(
      'On 2 and 4: 8 of 8. One tap matched no beat.',
    )
    expect(takeLine(5, 1, 2)).toBe(
      'On 2 and 4: 5 of 8. One tap landed on 1 or 3. Two taps matched no beat.',
    )
    expect(takeLine(3, 0, 0)).toBe('On 2 and 4: 3 of 8.')
  })

  it('describes the taps, never the person, in lines the claims check passes', () => {
    // Arrange
    const lines = [
      ...Object.values(LINES),
      takeLine(8, 8, 0),
      takeLine(5, 1, 2),
      takeLine(0, 0, 8),
    ]

    for (const line of lines) {
      // Assert
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
      expect(line).not.toMatch(/\b(good|great|well done|perfect|you're)\b/i)
    }
  })
})
