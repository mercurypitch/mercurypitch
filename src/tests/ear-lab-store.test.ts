// ============================================================
// Tests: ear-lab-store.ts — the practice/calibration split, rating
// flow, confusion bookkeeping and the Mercury Index snapshots.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import { calibrationHistory, completeCalibrationRun, earConfusions, earPlayerRating, latestCalibration, latestThresholdReading, practiceIndexEstimate, recordIdentificationAnswer, recordThresholdReading, resetEarLabStore, thresholdHistory, } from '@/stores/ear-lab-store'

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
