// ============================================================
// Tap judge tests — the kit's frame, on Lesson 17's two bars
// ============================================================
//
// Lesson 17 WEB-SPEC, Toys 7: beats 1,000 ms apart from beat 0, the pulse
// on beats 4 to 11, the written bars from beat 12 with their nine notes,
// the Ear Lab's 120 ms window and a bar of 7,380 ms. Lesson 8's backbeat,
// another shape on the same frame, keeps its own tests
// (lesson-08/take-judge.test.ts).

import { describe, expect, it } from 'vitest'
import type { TapTakeShape } from './tap-judge'
import { judgeTaps, lineUp, pulseSamples, TAP_WINDOW_MS, tapsWord, } from './tap-judge'

const BEAT = 1000
const BEAT0 = 5000
const TWO_BARS: TapTakeShape = {
  pulseFrom: 4,
  pulseTo: 11,
  judgedFrom: 12,
  onsets: [0, 1, 2, 4, 4.5, 5, 6, 6.5, 7],
}
const PULSE = [4, 5, 6, 7, 8, 9, 10, 11]

/** Beat `b`'s time on the page's clock, `off` ms late. */
const at = (b: number, off = 0): number => BEAT0 + b * BEAT + off

/** A take `delay` ms late throughout: the pulse beats, then the written notes. */
function take(
  delay: number,
  notes: readonly number[] = TWO_BARS.onsets,
): number[] {
  return [
    ...PULSE.map((b) => at(b, delay)),
    ...notes.map((b) => at(TWO_BARS.judgedFrom + b, delay)),
  ]
}

const judge = (taps: readonly number[]) =>
  judgeTaps(taps, BEAT0, BEAT, TWO_BARS)

describe('judgeTaps on Lesson 17 two bars', () => {
  it('lines the taps up by their delay, and finds all nine notes met in a bar of 7,380 ms', () => {
    // Act
    const j = judge(take(80))

    // Assert
    expect(j?.latencyMs).toBe(80)
    expect(j?.barMs).toBe(7380)
    expect(j?.verdict.met).toEqual(Array(9).fill(true))
    expect(j?.verdict.extras).toEqual([])
    expect(j?.taps).toEqual(
      TWO_BARS.onsets.map((b) => ({ at: b * BEAT, met: true })),
    )
  })

  it("measures each note's tap against the lined-up beat: 120 ms off meets, 121 ms does not", () => {
    // Arrange: notes 4 to 6 at 4,000, 4,500 and 5,000 ms, tapped off by these
    const off = [0, 0, 0, 100, -TAP_WINDOW_MS, TAP_WINDOW_MS + 1, 0, 0, 0]
    const taps = [
      ...PULSE.map((b) => at(b, 60)),
      ...TWO_BARS.onsets.map((b, i) => at(12 + b, 60 + off[i])),
    ]

    // Act
    const j = judge(taps)

    // Assert
    expect(j?.verdict.deviations.slice(3, 6)).toEqual([100, -120, null])
    expect(j?.verdict.extras).toEqual([5121])
    expect(j?.taps.filter((t) => !t.met)).toEqual([{ at: 5121, met: false }])
  })

  it('marks a tap where the half note holds, and a second tap on a note, as meeting none', () => {
    // Arrange: beat 4 of bar 1 is 3,000 ms in; the second tap on note 1 is 30 ms after the first
    const taps = [...take(0), at(12 + 3), at(12, 30)]

    // Act
    const j = judge(taps)

    // Assert
    expect(j?.verdict.met).toEqual(Array(9).fill(true))
    expect(j?.verdict.extras).toEqual([30, 3000])
    expect(j?.taps.slice(0, 3)).toEqual([
      { at: 0, met: true },
      { at: 30, met: false },
      { at: 1000, met: true },
    ])
    expect(j?.taps.find((t) => t.at === 3000)?.met).toBe(false)
  })

  it('takes taps from 120 ms before the first note to half a beat after the last, and no others', () => {
    // Arrange: the first note tapped 120 ms early; taps 121 ms before it, and at and past 7,500 ms
    const taps = [
      ...PULSE.map((b) => at(b)),
      at(12, -121),
      ...TWO_BARS.onsets.map((b) => at(12 + b, b === 0 ? -120 : 0)),
      at(12 + 7.5),
      at(12 + 7.5, 1),
    ]

    // Act
    const j = judge(taps)

    // Assert
    expect(j?.verdict.met).toEqual(Array(9).fill(true))
    expect(j?.verdict.deviations[0]).toBe(-120)
    expect(j?.verdict.extras).toEqual([7500])
    expect(j?.taps.map((t) => t.at)).toEqual([
      -120,
      ...TWO_BARS.onsets.slice(1).map((b) => b * BEAT),
      7500,
    ])
    expect(j?.rel).toHaveLength(taps.length)
  })

  it('lines up by at most 250 ms, where a 300 ms delay still meets every note', () => {
    // Act
    const j = judge(take(300))

    // Assert
    expect(j?.latencyMs).toBe(250)
    expect(j?.verdict.deviations).toEqual(Array(9).fill(50))
  })

  it('cannot line up four pulse taps, and takes no count-in or written tap as one', () => {
    // Arrange: beats 4 to 7 tapped, then the count-in's last beat and the written notes
    const taps = [
      at(3),
      ...[4, 5, 6, 7].map((b) => at(b, 40)),
      ...TWO_BARS.onsets.map((b) => at(12 + b, 40)),
    ]

    // Act
    const samples = pulseSamples(taps, BEAT0, BEAT, TWO_BARS)

    // Assert
    expect(samples).toEqual([40, 40, 40, 40])
    expect(lineUp(samples)).toBeNull()
    expect(judge(taps)).toBeNull()
    expect(lineUp([40, 40, 40, 40, 40])).toBe(40)
  })
})

describe('tapsWord', () => {
  it('counts taps in words from No to Nine, then in figures', () => {
    expect([0, 1, 2, 9, 10, 12].map(tapsWord)).toEqual([
      'No taps',
      'One tap',
      'Two taps',
      'Nine taps',
      '10 taps',
      '12 taps',
    ])
  })
})
