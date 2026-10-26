// ============================================================
// Weekly Check-up — then and now from the voiceprint history
// ============================================================
//
// Table cases for the comparison's rules: when one exists at all, which takes
// each side reads, the best-of-two rule, what an unclean range counts for,
// where each threshold sits, the words either side of it, and the practice
// counted in between. The history is plain data, in no particular order.

import { describe, expect, it } from 'vitest'
import type { MirrorSummary } from '@/lib/mirror/metrics'
import type { CheckupChange, CheckupTake } from './then-and-now'
import { ABOUT_THE_SAME, changeWords, CHECKUP_THRESHOLDS, historyNote, periodLine, practiceBetween, practiceLine, sideDays, thenAndNow, thenAndNowFacts, } from './then-and-now'

const DAY = 24 * 60 * 60 * 1000
const START = Date.parse('2026-10-05T12:00:00.000Z')
const at = (day: number): string => new Date(START + day * DAY).toISOString()

// G2 to C4 (43 to 60), a clean baritone read; A3 to A3 is not clean.
function reading(overrides: Partial<MirrorSummary> = {}): MirrorSummary {
  const low = overrides.lowMidi ?? 43
  const high = overrides.highMidi ?? 60
  return {
    lowMidi: low,
    highMidi: high,
    semitones: low === null || high === null ? null : high - low,
    accuracy: 60,
    steadiness: 70,
    ...overrides,
  }
}

const sung = (day: number, overrides: Partial<MirrorSummary> = {}) => ({
  takenAt: at(day),
  summary: reading(overrides),
})

const days = (takes: readonly CheckupTake[] | undefined): number[] =>
  (takes ?? []).map((take) =>
    Math.round((Date.parse(take.takenAt) - START) / DAY),
  )

describe('when there is a comparison', () => {
  it('has none with no take', () => {
    expect(thenAndNow([])).toBeNull()
  })

  it('has none with one take', () => {
    expect(thenAndNow([sung(0)])).toBeNull()
  })

  it('has none for two takes 6 days apart', () => {
    expect(thenAndNow([sung(0), sung(6)])).toBeNull()
  })

  it('compares two takes 7 days apart, one on each side', () => {
    const comparison = thenAndNow([sung(7), sung(0)])

    expect(days(comparison?.then.takes)).toEqual([0])
    expect(days(comparison?.now.takes)).toEqual([7])
  })
})

describe('which takes each side reads', () => {
  it('takes the next take within the week into Then, and the one before the newest into Now', () => {
    const comparison = thenAndNow([sung(0), sung(3), sung(20), sung(25)])

    expect(days(comparison?.then.takes)).toEqual([0, 3])
    expect(days(comparison?.now.takes)).toEqual([20, 25])
  })

  it('ignores a third take in the first week', () => {
    const comparison = thenAndNow([
      sung(0),
      sung(1),
      sung(3, { accuracy: 99 }),
      sung(14),
    ])

    expect(days(comparison?.then.takes)).toEqual([0, 1])
    expect(days(comparison?.now.takes)).toEqual([14])
    expect(comparison?.then.accuracy).toBe(60)
  })

  it('leaves the take before the newest out of Now when it is a week or more earlier', () => {
    const comparison = thenAndNow([sung(0), sung(7), sung(14)])

    expect(days(comparison?.now.takes)).toEqual([14])
  })

  it('never reads one take on both sides', () => {
    const comparison = thenAndNow([sung(0), sung(5), sung(10)])

    expect(days(comparison?.then.takes)).toEqual([0, 5])
    expect(days(comparison?.now.takes)).toEqual([10])
  })

  it('counts practice from Then’s last take to Now’s first', () => {
    const comparison = thenAndNow([sung(0), sung(3), sung(20), sung(25)])

    expect(comparison?.between).toEqual({
      from: START + 3 * DAY,
      to: START + 20 * DAY,
    })
  })
})

describe('the best-of-two rule', () => {
  it('reads each side as the best of its takes, per metric', () => {
    const comparison = thenAndNow([
      sung(0, { lowMidi: 45, highMidi: 60, accuracy: 70, steadiness: 50 }),
      sung(2, { lowMidi: 43, highMidi: 62, accuracy: 55, steadiness: 64 }),
      sung(20, { lowMidi: 41, highMidi: 64, accuracy: 66, steadiness: 80 }),
      sung(22, { lowMidi: 45, highMidi: 60, accuracy: 81, steadiness: 72 }),
    ])

    expect(comparison?.then).toMatchObject({
      range: { lowMidi: 43, highMidi: 62, semitones: 19 },
      accuracy: 70,
      steadiness: 64,
    })
    expect(comparison?.now).toMatchObject({
      range: { lowMidi: 41, highMidi: 64, semitones: 23 },
      accuracy: 81,
      steadiness: 80,
    })
  })

  it('never counts an unclean range read, but still counts its scores', () => {
    const comparison = thenAndNow([
      sung(0, { lowMidi: 57, highMidi: 57, accuracy: 72, steadiness: 75 }),
      sung(9, { lowMidi: 43, highMidi: 60 }),
    ])

    expect(comparison?.then.range).toBeNull()
    expect(comparison?.then.accuracy).toBe(72)
    expect(comparison?.then.steadiness).toBe(75)
    expect(comparison?.changes.range).toBeNull()
  })

  it('takes the clean range of two when the other read was not clean', () => {
    const comparison = thenAndNow([
      sung(0, { lowMidi: 57, highMidi: 57 }),
      sung(1, { lowMidi: 45, highMidi: 59 }),
      sung(9),
    ])

    expect(comparison?.then.range).toEqual({
      lowMidi: 45,
      highMidi: 59,
      semitones: 14,
    })
  })

  it('reads no range from a take that measured none', () => {
    const comparison = thenAndNow([
      sung(0, { lowMidi: null, highMidi: null }),
      sung(9),
    ])

    expect(comparison?.then.range).toBeNull()
  })
})

describe('the thresholds', () => {
  // Span from 17 semitones (G2 to C4); points from 60 accuracy, 70 steadiness.
  const rangeTo = (high: number) =>
    thenAndNow([sung(0), sung(9, { highMidi: high })])?.changes.range
  const accuracyTo = (value: number) =>
    thenAndNow([sung(0), sung(9, { accuracy: value })])?.changes.accuracy
  const steadinessTo = (value: number) =>
    thenAndNow([sung(0), sung(9, { steadiness: value })])?.changes.steadiness

  it.each([
    ['range 1 semitone wider', () => rangeTo(61), ABOUT_THE_SAME],
    ['range 2 semitones wider', () => rangeTo(62), '2 semitones wider'],
    ['range 1 semitone narrower', () => rangeTo(59), ABOUT_THE_SAME],
    ['range 2 semitones narrower', () => rangeTo(58), '2 semitones narrower'],
    ['accuracy up 4', () => accuracyTo(64), ABOUT_THE_SAME],
    ['accuracy up 5', () => accuracyTo(65), 'accuracy up 5'],
    ['accuracy down 4', () => accuracyTo(56), ABOUT_THE_SAME],
    ['accuracy down 5', () => accuracyTo(55), 'accuracy down 5'],
    ['steadiness up 4', () => steadinessTo(74), ABOUT_THE_SAME],
    ['steadiness up 5', () => steadinessTo(75), 'steadiness up 5'],
    ['steadiness down 4', () => steadinessTo(66), ABOUT_THE_SAME],
    ['steadiness down 5', () => steadinessTo(65), 'steadiness down 5'],
  ])('words %s', (_case, change, words) => {
    // Act
    const said = changeWords(change() as CheckupChange)

    // Assert
    expect(said).toBe(words)
  })

  it('names nothing under a threshold, with no sign, arrow or praise', () => {
    const change = accuracyTo(64) as CheckupChange

    expect(change.named).toBe(false)
    expect(changeWords(change)).not.toMatch(/[+−\-↑↓→]|up|down|better|great/i)
  })

  it('says a fall as plainly as a rise', () => {
    const fall = changeWords(steadinessTo(61) as CheckupChange, { short: true })
    const rise = changeWords(steadinessTo(79) as CheckupChange, { short: true })

    expect(fall).toBe('Down 9')
    expect(rise).toBe('Up 9')
  })

  it('keeps the thresholds in one place: 2 semitones, 5 and 5 points', () => {
    expect(CHECKUP_THRESHOLDS).toEqual({ range: 2, accuracy: 5, steadiness: 5 })
  })
})

describe('practice in between', () => {
  const between = { from: START + 2 * DAY, to: START + 20 * DAY }

  it('counts the sessions saved between the sides, each once', () => {
    const sessions = [
      { id: 'a', endedAt: at(1) },
      { id: 'b', endedAt: at(5) },
      { id: 'b', endedAt: at(5) },
      { id: 'c', endedAt: '', startedAt: at(9) },
      { id: 'd', endedAt: at(19) },
      { id: 'e', endedAt: at(21) },
    ]

    expect(practiceBetween(sessions, between)).toBe(3)
  })

  it('says the count only from one up', () => {
    expect(practiceLine(0)).toBeNull()
    expect(practiceLine(1)).toBe('1 practice session in between')
    expect(practiceLine(9)).toBe('9 practice sessions in between')
  })
})

describe('the words around the readings', () => {
  it('says signed out that the readings are this browser’s', () => {
    expect(historyNote(false)).toMatch(/this browser/)
    expect(historyNote(true)).toBeNull()
  })

  it('dates each side, and the card’s period from first to last', () => {
    const comparison = thenAndNow([sung(0), sung(4), sung(14)])
    if (comparison === null) throw new Error('no comparison')

    expect(sideDays(comparison.then, START)).toBe('5 Oct and 9 Oct')
    expect(sideDays(comparison.now, START)).toBe('19 Oct')
    expect(periodLine(comparison)).toBe('5 Oct – 19 Oct 2026')
  })
})

describe("the share card's facts", () => {
  it('names the changes that reached their thresholds, then the practice', () => {
    const comparison = thenAndNow([
      sung(0, { lowMidi: 43, highMidi: 60, accuracy: 64 }),
      sung(14, { lowMidi: 41, highMidi: 64, accuracy: 78, steadiness: 72 }),
    ])
    if (comparison === null) throw new Error('no comparison')

    expect(thenAndNowFacts(comparison, 9)).toEqual([
      { value: 'G2–C4 → F2–E4', label: '6 semitones wider' },
      { value: '64 → 78', label: 'accuracy up 14' },
      { value: '9', label: 'practice sessions in between' },
    ])
  })

  it('never puts a change under its threshold on the card', () => {
    const comparison = thenAndNow([
      sung(0),
      sung(14, { highMidi: 61, accuracy: 64, steadiness: 66 }),
    ])
    if (comparison === null) throw new Error('no comparison')

    const facts = thenAndNowFacts(comparison, 0)

    // Now's own readings fill the card, and no change is claimed.
    expect(facts).toEqual([
      { value: 'G2–C#4', label: 'range now' },
      { value: '64', label: 'accuracy now' },
      { value: '66', label: 'steadiness now' },
    ])
    for (const fact of facts) {
      expect(`${fact.value} ${fact.label}`).not.toMatch(
        /→|up|down|wider|narrower|about the same|G2–C4|60|70/,
      )
    }
  })
})
