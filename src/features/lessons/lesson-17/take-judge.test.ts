// ============================================================
// Lesson 17 take judge tests — simulated takes of the two written bars
// ============================================================
//
// WEB-SPEC, Tests 4 (FACTS 32 to 35): seeded takes at device delays of 0
// to 350 ms line up between 0 and 250 ms and read "All 9 notes got a tap,
// and no tap fell between them."; 400 ms and 450 ms past the cap; a tap on
// beat 4 of bar 1; eighths tapped as quarters; one "and" missed; every
// beat of the written bars; taps in the beat bars only; no beat taps; the
// window's edge; counts in words; and each tap's tick where it fell, gold
// when it met its note. The estimator and the judge are the app's own,
// through the kit's tap judge, never copied.

import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { BEAT_MS, judgeBars, LINES, TAKE, TAKE_ONSETS } from './take-judge'

/** Beat 0 of the take on the page clock, ms. */
const BEAT0 = 5000
const PULSE = [4, 5, 6, 7, 8, 9, 10, 11]
/** The written bars' notes, in beats from beat 0. */
const NOTES = TAKE_ONSETS.map((b) => TAKE.judgedFrom + b)

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
  /** Which beats of the beat bars get a tap. */
  readonly pulse?: readonly number[]
  /** Which beats of the written part get a tap, from beat 0. */
  readonly written?: readonly number[]
}

/** Simulated taps (page ms) at a device's delay, spread around the hand's lead. */
function take(o: TakeOptions): number[] {
  const g = gauss(mulberry32(o.seed ?? 1))
  const at = (beat: number): number =>
    BEAT0 + beat * BEAT_MS + o.delay + (o.bias ?? -20) + g() * (o.jitter ?? 20)
  return [...(o.pulse ?? PULSE).map(at), ...(o.written ?? NOTES).map(at)]
}

const judge = (taps: readonly number[]) => judgeBars(taps, BEAT0)

describe('judgeBars on simulated takes', () => {
  it('lines up delays of 0 to 350 ms by 0 to 250 ms, and reads a clean take as all nine', () => {
    for (const delay of [0, 50, 100, 150, 200, 250])
      for (const seed of [1, 2, 3, 4, 5]) {
        // Act
        const r = judge(take({ delay, seed }))
        const label = `${delay} ms, seed ${seed}`

        // Assert (FACTS 35)
        expect(r.latencyMs ?? -1, label).toBeGreaterThanOrEqual(0)
        expect(r.latencyMs ?? 999, label).toBeLessThanOrEqual(250)
        expect(r.line, label).toBe(LINES.all)
      }
  })

  it('reads the same at 300 ms with no lead', () => {
    // Act
    const r = judge(take({ delay: 300, bias: 0 }))

    // Assert
    expect(r.line).toBe(LINES.all)
  })

  it('meets few notes at 400 ms, the cap leaving the taps about 130 ms late, and none at 450 ms, with no clause on the "and"s', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      // Act
      const at400 = judge(take({ delay: 400, seed }))
      const at450 = judge(take({ delay: 450, seed }))

      // Assert (FACTS 35)
      expect(at400.latencyMs, `seed ${seed}`).toBe(250)
      expect(at400.met, `seed ${seed}`).toBeLessThan(5)
      expect(at400.line, `seed ${seed}`).toMatch(
        /^Notes with a tap: \d of 9\. .*fell between the notes\.$/,
      )
      expect(at450.line, `seed ${seed}`).toBe(
        'Notes with a tap: 0 of 9. Nine taps fell between the notes.',
      )
    }
  })

  it('reads a tap on beat 4 of bar 1, where the half note holds', () => {
    // Act
    const r = judge(take({ delay: 100, written: [...NOTES, 15] }))

    // Assert
    expect(r.line).toBe(
      'Notes with a tap: 9 of 9. One tap came on beat 4 of bar 1, where the half note holds.',
    )
  })

  it('reads eighths tapped as quarters, one "and" missed, and every beat of the written bars', () => {
    // Arrange: bar 2's beats without their "and"s, then without one
    const quarters = NOTES.filter((b) => b % 1 === 0)
    const oneAnd = NOTES.filter((b) => b !== 16.5)

    // Act
    const asQuarters = judge(take({ delay: 100, written: quarters }))
    const missedOne = judge(take({ delay: 100, written: oneAnd }))
    const everyBeat = judge(
      take({ delay: 100, written: [12, 13, 14, 15, 16, 17, 18, 19] }),
    )

    // Assert (FACTS 35)
    expect(asQuarters.line).toBe(
      'Notes with a tap: 7 of 9. The two notes on ‘and’ got none.',
    )
    expect(missedOne.line).toBe(
      'Notes with a tap: 8 of 9. One note on ‘and’ got none.',
    )
    expect(everyBeat.line).toBe(
      'Notes with a tap: 7 of 9. One tap came on beat 4 of bar 1, where the half note holds. The two notes on ‘and’ got none.',
    )
  })

  it("counts taps between the notes in words, after the held beat's as more", () => {
    // Arrange: two taps off the beat in bar 1, then the held beat's too
    const between = [...NOTES, 12.5, 13.5]

    // Act
    const two = judge(take({ delay: 100, written: between }))
    const more = judge(take({ delay: 100, written: [...between, 15] }))

    // Assert
    expect(two.line).toBe(
      'Notes with a tap: 9 of 9. Two taps fell between the notes.',
    )
    expect(more.line).toBe(
      'Notes with a tap: 9 of 9. One tap came on beat 4 of bar 1, where the half note holds. Two more taps fell between the notes.',
    )
    expect(LINES.moreBetween(1)).toBe('One more tap fell between the notes.')
    expect(LINES.between(10)).toBe('10 taps fell between the notes.')
  })

  it('reads taps in the beat bars only, and a take with no beat taps', () => {
    // Act
    const noneWritten = judge(take({ delay: 100, written: [] }))
    const noPulse = judge(take({ delay: 100, pulse: [] }))

    // Assert (FACTS 35)
    expect(noneWritten.line).toBe(LINES.none)
    expect(noPulse.line).toBe(LINES.notLined)
    expect(noPulse.latencyMs).toBeNull()
    expect(noPulse.ticks).toEqual([])
  })

  it('needs five beat taps that agree to line a take up', () => {
    // Act: taps on the dot, so none is set aside as an outlier
    const four = judge(take({ delay: 100, jitter: 0, pulse: [4, 5, 6, 7] }))
    const five = judge(take({ delay: 100, jitter: 0, pulse: [4, 5, 6, 7, 8] }))

    // Assert
    expect(four.line).toBe(LINES.notLined)
    expect(five.line).toBe(LINES.all)
  })

  it('meets a note 120 ms either side once lined up, and no further', () => {
    // Arrange: lined up at exactly 100 ms, the first note's tap moved
    const at = (offset: number): number[] => [
      ...PULSE.map((b) => BEAT0 + b * BEAT_MS + 100),
      BEAT0 + 12 * BEAT_MS + 100 + offset,
      ...NOTES.slice(1).map((b) => BEAT0 + b * BEAT_MS + 100),
    ]

    // Act
    const edges = [-121, -120, 120, 121].map((o) => judge(at(o)).met)

    // Assert (FACTS 33)
    expect(edges).toEqual([8, 9, 9, 8])
  })

  it('draws each tap where it fell, gold when it met its note', () => {
    // Act: a clean take with one tap off the beat
    const r = judge(
      take({ delay: 100, jitter: 0, bias: 0, written: [...NOTES, 13.5] }),
    )

    // Assert (FACTS 34): ticks at their beats from the written bars' first
    expect(r.ticks.map((t) => [Number(t.beat.toFixed(3)), t.met])).toEqual([
      [0, true],
      [1, true],
      [1.5, false],
      [2, true],
      [4, true],
      [4.5, true],
      [5, true],
      [6, true],
      [6.5, true],
      [7, true],
    ])
  })
})

describe('the lines', () => {
  it('say only what the lesson showed, in lines the claims check passes', () => {
    const lines = [
      LINES.notLined,
      LINES.none,
      LINES.all,
      LINES.count(7),
      LINES.held,
      LINES.bothAnd,
      LINES.oneAnd,
      LINES.between(2),
      LINES.moreBetween(2),
    ]
    for (const line of lines)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text: line })
          .violations,
        line,
      ).toEqual([])
  })
})
