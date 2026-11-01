import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundOutcome } from './leap-machine'
import type { LeapRound } from './leap-round'
import type { LeapKind } from './leap-rules'
import { LEAP_LEVELS } from './leap-rules'
import { callMoment, detailLine, keepLeapRun, landedMoment, leapRows, missedMoment, resultMoment, summarizeRun, } from './leap-run'

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

const up = (size: LeapKind['size']): LeapKind => ({ size, up: true })
const down = (size: LeapKind['size']): LeapKind => ({ size, up: false })

function round(index: number, kind: LeapKind, from = 55): LeapRound {
  return { index, kind, from, to: from + (kind.up ? kind.size : -kind.size) }
}

function landed(index: number, kind: LeapKind, seconds: number): RoundOutcome {
  return {
    round: round(index, kind),
    landed: true,
    cents: -8,
    seconds,
    matched: true,
    voiced: true,
    short: null,
    heardAgain: false,
  }
}

function missed(
  index: number,
  kind: LeapKind,
  extra: Partial<RoundOutcome> = {},
): RoundOutcome {
  return {
    round: round(index, kind),
    landed: false,
    cents: null,
    seconds: null,
    matched: true,
    voiced: true,
    short: null,
    heardAgain: false,
    ...extra,
  }
}

describe('A Leap run', () => {
  beforeEach(() => {
    recorded.calls = []
    localStorage.removeItem('mp_leap_bests')
  })

  it('sums its landings and how quickly they came', () => {
    const summary = summarizeRun([
      landed(0, up(5), 0.4),
      missed(1, up(7)),
      landed(2, up(9), 0.8),
    ])
    expect(summary).toMatchObject({ landed: 2, rounds: 3, voiced: true })
    expect(summary.seconds).toBeCloseTo(0.6)
    expect(summary.cents).toBeCloseTo(8)
    expect(detailLine(summary)).toBe('Landed in 0.6 s on average')
    expect(detailLine(summarizeRun([missed(0, up(5))]))).toBeNull()
  })

  it('lists each leap once, its tries in the run order', () => {
    const rows = leapRows(
      [
        landed(0, up(5), 0.5),
        missed(1, up(7)),
        landed(2, up(5), 0.4),
        landed(3, up(7), 0.6),
        missed(4, up(9)),
        landed(5, up(9), 0.7),
      ],
      LEAP_LEVELS.singer,
    )
    expect(rows.map((row) => row.name)).toEqual([
      'Up a fourth',
      'Up a fifth',
      'Up a sixth',
    ])
    expect(rows.map((row) => row.song?.title)).toEqual([
      'Here Comes the Bride',
      'Twinkle, Twinkle, Little Star',
      'My Bonnie Lies over the Ocean',
    ])
    expect(rows[1].tries.map((t) => [t.round.index, t.landed])).toEqual([
      [1, false],
      [3, true],
    ])
    expect(rows.map((row) => row.landed)).toEqual([2, 1, 1])
    // A leap down has no song.
    expect(
      leapRows([missed(0, down(7))], LEAP_LEVELS.singer)[0].song,
    ).toBeNull()
  })

  it('names Professional leaps by the interval alone, its sixth a major one', () => {
    const rows = leapRows(
      [missed(0, up(9)), landed(1, up(8), 0.5), missed(2, up(7))],
      LEAP_LEVELS.professional,
    )
    expect(rows.map((row) => row.name)).toEqual([
      'Up a major sixth',
      'Up a minor sixth',
      'Up a fifth',
    ])
    expect(rows.map((row) => row.song)).toEqual([null, null, null])
  })

  it('has Merc name the song where the level does, and only for a leap that has one', () => {
    expect(callMoment(LEAP_LEVELS.learning, up(7))).toBe('callMatch')
    expect(callMoment(LEAP_LEVELS.singer, up(9))).toBe('call')
    expect(callMoment(LEAP_LEVELS.professional, up(7))).toBe('callPlain')
    expect(callMoment(LEAP_LEVELS.singer, up(3))).toBe('callPlain')
    expect(landedMoment(LEAP_LEVELS.singer, up(5))).toBe('landedSong')
    expect(landedMoment(LEAP_LEVELS.professional, up(5))).toBe('landed')
  })

  it('says whether a miss fell short, went past or was never sung', () => {
    expect(missedMoment(missed(0, up(7), { voiced: false }))).toBe(
      'missedSilent',
    )
    expect(missedMoment(missed(0, up(7), { short: true }))).toBe('missedShort')
    expect(missedMoment(missed(0, up(7), { short: false }))).toBe('missedOver')
    expect(missedMoment(missed(0, up(7)))).toBe('missed')
  })

  it('keeps a run with a voice once, and its best per level', () => {
    const summary = summarizeRun([
      landed(0, up(5), 0.5),
      landed(1, up(7), 0.7),
      missed(2, up(9)),
    ])
    const kept = keepLeapRun('singer', summary, 1_000)
    expect(kept).toEqual({ kept: true, improved: false })
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({
      type: 'leap-cliffs',
      score: 67,
      metrics: { leapsLanded: 2, leaps: 3 },
    })
    expect(resultMoment(summary, kept)).toBe('resultMost')
  })

  it('keeps nothing of a run with no voice', () => {
    const summary = summarizeRun([
      missed(0, up(5), { voiced: false }),
      missed(1, up(7), { voiced: false }),
    ])
    const kept = keepLeapRun('learning', summary)
    expect(kept).toEqual({ kept: false, improved: false })
    expect(recorded.calls).toEqual([])
    expect(resultMoment(summary, kept)).toBe('silentRun')
  })
})
