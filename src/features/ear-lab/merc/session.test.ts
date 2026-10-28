// What today's three moved, for the day's close: a first reading stays
// a first reading when the drill runs again, the day's first "before"
// is kept, and a staircase says its before and after in one unit.

import { describe, expect, it } from 'vitest'
import type { RatingPlate, ThresholdPlate } from '@/features/ear-lab/stage-room'
import { recordTodayMove, todayMoveOf, todayMoves } from './session'

const threshold = (over: Partial<ThresholdPlate>): ThresholdPlate => ({
  kind: 'threshold',
  value: 9.5,
  format: (value) => value.toFixed(1),
  unit: 'cents',
  unitShort: ' ¢',
  lowerIsBetter: true,
  previous: 12,
  calibration: false,
  provisional: false,
  note: '',
  trials: 14,
  turns: 8,
  replays: 0,
  ...over,
})

const rating = (over: Partial<RatingPlate>): RatingPlate => ({
  kind: 'rating',
  rating: 1204,
  before: 1180,
  source: 'Leap rating',
  settling: null,
  rounds: 12,
  right: 8,
  outcomes: [],
  slips: [],
  ...over,
})

describe("today's moves", () => {
  it('keep a first reading a first reading when the drill runs again', () => {
    const day = '2026-10-28'
    recordTodayMove(day, {
      drillId: 'span',
      before: null,
      after: '4 notes',
      caption: 'practice',
    })
    recordTodayMove(day, {
      drillId: 'span',
      before: '4 notes',
      after: '5 notes',
      caption: 'practice',
    })
    expect(todayMoves(day)).toEqual([
      { drillId: 'span', before: null, after: '5 notes', caption: 'practice' },
    ])
  })

  it("keep the day's first before across runs", () => {
    const day = '2026-10-29'
    recordTodayMove(day, {
      drillId: 'hairline',
      before: '12.0 ¢',
      after: '10.1 ¢',
      caption: 'practice',
    })
    recordTodayMove(day, {
      drillId: 'hairline',
      before: '10.1 ¢',
      after: '9.5 ¢',
      caption: 'practice',
    })
    expect(todayMoves(day)[0]?.before).toBe('12.0 ¢')
    expect(todayMoves(day)[0]?.after).toBe('9.5 ¢')
  })
})

describe("a run's move, from its plate", () => {
  it('says a staircase before and after in the same unit', () => {
    expect(todayMoveOf('hairline', threshold({}))).toEqual({
      drillId: 'hairline',
      before: '12.0 ¢',
      after: '9.5 ¢',
      caption: 'practice',
    })
    expect(
      todayMoveOf('hairline', threshold({ previous: null }))?.before,
    ).toBeNull()
  })

  it('says a rating from and to, and nothing for a run that measured nothing', () => {
    expect(todayMoveOf('leap', rating({ settling: 3 }))).toEqual({
      drillId: 'leap',
      before: '1180',
      after: '1204',
      caption: 'rating, settling',
    })
    expect(todayMoveOf('leap', rating({ rounds: 0 }))).toBeNull()
    expect(todayMoveOf('hairline', threshold({ value: null }))).toBeNull()
  })
})
