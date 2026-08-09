// ============================================================
// Tests: ear-lab-store.ts — the practice/calibration split, rating
// flow, confusion bookkeeping and the Mercury Index snapshots.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'
import { calibrationHistory, completeCalibrationRun, completeSprint, earConfusions, earPlayerRating, isSprintComplete, latestCalibration, latestThresholdReading, markSprintSegmentDone, practiceIndexEstimate, recordIdentificationAnswer, recordThresholdReading, resetEarLabStore, sprintCandidates, sprintHistory, sprintProgress, sprintStreak, thresholdHistory, todaysSprint, } from '@/stores/ear-lab-store'

function answerHome(correct: boolean, expected = 'deg-4', answered = 'deg-5') {
  return recordIdentificationAnswer({
    drillId: 'home',
    itemId: `home:${expected}`,
    itemDifficulty: { rating: 1200, attempts: 0 },
    correct,
    guessRate: 1 / 7,
    expected,
    answered: correct ? expected : answered,
  })
}

beforeEach(() => {
  resetEarLabStore()
})

describe('identification answers', () => {
  it('moves the player rating with each answer', () => {
    const before = earPlayerRating('home').rating
    const after = answerHome(true)
    expect(after.rating).toBeGreaterThan(before)
    expect(earPlayerRating('home').rating).toBe(after.rating)
    expect(earPlayerRating('home').attempts).toBe(1)
  })

  it('books a confusion pair only on a miss', () => {
    answerHome(true)
    expect(earConfusions('home')).toEqual({})
    answerHome(false)
    answerHome(false)
    expect(earConfusions('home')).toEqual({ 'deg-4>deg-5': 2 })
  })

  it('keeps drills apart in the confusion map', () => {
    answerHome(false)
    recordIdentificationAnswer({
      drillId: 'stack',
      itemId: 'stack:maj',
      itemDifficulty: { rating: 1200, attempts: 0 },
      correct: false,
      guessRate: 1 / 6,
      expected: 'maj',
      answered: 'min',
    })
    expect(earConfusions('home')).toEqual({ 'deg-4>deg-5': 1 })
    expect(earConfusions('stack')).toEqual({ 'maj>min': 1 })
  })
})

describe('threshold readings', () => {
  it('returns the newest reading, filtered by source', () => {
    recordThresholdReading({
      drillId: 'hairline',
      value: 30,
      spread: 6,
      tracks: 1,
      source: 'practice',
    })
    recordThresholdReading({
      drillId: 'hairline',
      value: 22,
      spread: 4,
      tracks: 1,
      source: 'practice',
    })
    expect(latestThresholdReading('hairline')?.value).toBe(22)
    expect(latestThresholdReading('hairline', 'calibration')).toBeNull()
    expect(thresholdHistory('hairline')).toHaveLength(2)
  })
})

describe('practiceIndexEstimate', () => {
  it('reads zero before anything is measured', () => {
    expect(practiceIndexEstimate().value).toBe(0)
  })

  it('rises when a practice hairline reading lands', () => {
    recordThresholdReading({
      drillId: 'hairline',
      value: 12,
      spread: 3,
      tracks: 1,
      source: 'practice',
    })
    const estimate = practiceIndexEstimate()
    expect(estimate.value).toBeGreaterThan(0)
    expect(estimate.parts.resolution).toBeGreaterThan(0)
    expect(estimate.missing).toContain('function')
  })

  it('excludes a provisional rating and includes a settled one', () => {
    answerHome(true)
    expect(practiceIndexEstimate().parts.function).toBeUndefined()
    for (let i = 0; i < PROVISIONAL_ATTEMPTS; i++) answerHome(true)
    expect(practiceIndexEstimate().parts.function).toBeGreaterThan(0)
  })
})

describe('calibration runs', () => {
  it('stores readings as calibration-sourced and snapshots the index', () => {
    const run = completeCalibrationRun([
      { drillId: 'hairline', value: 15, spread: 2 },
    ])
    expect(run.index).toBeGreaterThan(0)
    expect(run.readings).toHaveLength(1)
    expect(latestThresholdReading('hairline', 'calibration')?.value).toBe(15)
    expect(latestCalibration()?.index).toBe(run.index)
  })

  it('improving readings raise the marked index run over run', () => {
    const first = completeCalibrationRun([
      { drillId: 'hairline', value: 25, spread: 3 },
    ])
    const second = completeCalibrationRun([
      { drillId: 'hairline', value: 14, spread: 2 },
    ])
    expect(second.index).toBeGreaterThan(first.index)
    expect(calibrationHistory()).toHaveLength(2)
    expect(calibrationHistory()[0].at).toBeGreaterThanOrEqual(
      calibrationHistory()[1].at,
    )
  })

  it('folds a settled Function rating into the calibration snapshot', () => {
    for (let i = 0; i <= PROVISIONAL_ATTEMPTS; i++) answerHome(true)
    const run = completeCalibrationRun([
      { drillId: 'hairline', value: 15, spread: 2 },
    ])
    expect(run.parts.function).toBeGreaterThanOrEqual(0)
    expect(run.parts.resolution).toBeGreaterThan(0)
  })
})

/** Same day arithmetic the streak uses: a date label, shifted. */
function shiftDay(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

describe('sprint candidates', () => {
  it('offers every runnable drill, all unmeasured at the start', () => {
    const candidates = sprintCandidates()
    expect(candidates.map((c) => c.drillId)).toEqual([...SPRINT_DRILL_IDS])
    expect(candidates.every((c) => c.score === null)).toBe(true)
  })

  it('scores a threshold drill once it has a reading', () => {
    recordThresholdReading({
      drillId: 'hairline',
      value: 9,
      spread: 2,
      tracks: 1,
      source: 'practice',
    })
    const hairline = sprintCandidates().find((c) => c.drillId === 'hairline')
    expect(hairline?.kind).toBe('threshold')
    expect(hairline?.score).toBeGreaterThan(0)
  })

  it('treats a provisional rating as unmeasured, not as a low score', () => {
    // One answer is a guess the Elo has not settled; ranking it as
    // "never measured" is what sends the sprint back to it.
    answerHome(true)
    expect(earPlayerRating('home').attempts).toBeLessThan(PROVISIONAL_ATTEMPTS)
    expect(
      sprintCandidates().find((c) => c.drillId === 'home')?.score,
    ).toBeNull()
  })
})

describe("today's sprint", () => {
  it('plans distinct drills and never more than the segment cap', () => {
    const plan = todaysSprint()
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.length).toBeLessThanOrEqual(3)
    const ids = plan.map((s) => s.drillId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(SPRINT_DRILL_IDS).toContain(id)
  })

  it('starts empty and books segments once each', () => {
    expect(sprintProgress().done).toEqual([])
    markSprintSegmentDone('hairline')
    markSprintSegmentDone('hairline')
    expect(sprintProgress().done).toEqual(['hairline'])
    markSprintSegmentDone('home')
    expect(sprintProgress().done).toEqual(['hairline', 'home'])
  })
})

describe('finishing a sprint', () => {
  it('marks the day complete and remembers it', () => {
    expect(isSprintComplete()).toBe(false)
    const closed = completeSprint()
    expect(closed.completedAt).not.toBeNull()
    expect(isSprintComplete()).toBe(true)
    expect(sprintHistory()).toEqual([sprintProgress().day])
  })

  it('cannot be closed twice in a day', () => {
    const first = completeSprint()
    const again = completeSprint()
    expect(again.completedAt).toBe(first.completedAt)
    expect(sprintHistory()).toHaveLength(1)
  })

  it('counts one day once it is done', () => {
    expect(sprintStreak()).toBe(0)
    completeSprint()
    expect(sprintStreak()).toBe(1)
  })

  it('does not read as broken before today is played', () => {
    completeSprint()
    const today = sprintProgress().day
    // Tomorrow morning, yesterday's run still anchors the streak.
    expect(sprintStreak(shiftDay(today, 1))).toBe(1)
  })

  it('breaks once a whole day passes with no sprint', () => {
    completeSprint()
    const today = sprintProgress().day
    expect(sprintStreak(shiftDay(today, 2))).toBe(0)
  })
})
