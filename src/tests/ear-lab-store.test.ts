// ============================================================
// Tests: ear-lab-store.ts — the practice/calibration split, rating
// flow, confusion bookkeeping and the Mercury Index snapshots.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROVISIONAL_ATTEMPTS } from '@/lib/ear/elo'
import { SPRINT_DRILL_IDS } from '@/lib/ear/sprint'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import { calibrationHistory, completeCalibrationRun, completeSprint, earAutoAdvance, earConfusions, earInfoOpen, earPlayerRating, earRevealHoldMs, isSprintComplete, latestCalibration, latestThresholdReading, markSprintSegmentDone, practiceIndexEstimate, recordIdentificationAnswer, recordThresholdReading, resetEarLabStore, setEarAutoAdvance, setEarInfoOpen, setEarRevealHoldMs, sprintCandidates, sprintHistory, sprintProgress, sprintStreak, thresholdHistory, todaysSprint, } from '@/stores/ear-lab-store'

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

describe('pacing', () => {
  it('starts with auto-advance on and the default hold', () => {
    expect(earAutoAdvance()).toBe(true)
    expect(earRevealHoldMs()).toBe(REVEAL_HOLD.defaultMs)
  })

  it('snaps the hold to the slider step and clamps it to the range', () => {
    expect(setEarRevealHoldMs(2750)).toBe(3000)
    expect(earRevealHoldMs()).toBe(3000)
    expect(setEarRevealHoldMs(100)).toBe(REVEAL_HOLD.min)
    expect(setEarRevealHoldMs(99999)).toBe(REVEAL_HOLD.max)
    expect(setEarRevealHoldMs(Number.NaN)).toBe(REVEAL_HOLD.defaultMs)
  })

  it('persists both and comes back with reset', () => {
    setEarAutoAdvance(false)
    setEarRevealHoldMs(4000)
    expect(localStorage.getItem('mercurypitch_ear_auto_advance')).toBe('false')
    expect(localStorage.getItem('mercurypitch_ear_reveal_hold_ms')).toBe('4000')
    resetEarLabStore()
    expect(earAutoAdvance()).toBe(true)
    expect(earRevealHoldMs()).toBe(REVEAL_HOLD.defaultMs)
  })
})

describe('the instrument card', () => {
  it('is folded until a drill unfolds it, and remembers per drill', () => {
    expect(earInfoOpen('hairline')).toBe(false)
    setEarInfoOpen('hairline', true)
    expect(earInfoOpen('hairline')).toBe(true)
    expect(earInfoOpen('leap')).toBe(false)
    expect(
      JSON.parse(localStorage.getItem('mercurypitch_ear_info_open') ?? '{}'),
    ).toEqual({ hairline: true })
    setEarInfoOpen('hairline', false)
    expect(earInfoOpen('hairline')).toBe(false)
    setEarInfoOpen('hairline', true)
    resetEarLabStore()
    expect(earInfoOpen('hairline')).toBe(false)
  })
})

describe('the silent-ladder re-seed', () => {
  const items = (
    record: Record<string, { rating: number; attempts: number }>,
  ) => localStorage.setItem('mercurypitch_ear_items', JSON.stringify(record))

  it("drops the ladder drills' tap items once, on load, and keeps the rest", async () => {
    items({
      'e-steps-up': { rating: 1300, attempts: 4 },
      'bassline:1451': { rating: 1250, attempts: 2 },
      'leap:m2': { rating: 1100, attempts: 9 },
    })
    localStorage.removeItem('mercurypitch_ear_items_reseed')
    vi.resetModules()
    const fresh = await import('@/stores/ear-lab-store')
    expect(Object.keys(fresh.earItemStates())).toEqual(['leap:m2'])
    expect(localStorage.getItem('mercurypitch_ear_items_reseed')).toBe(
      'ladder-sounds',
    )
    expect(fresh.reseedSilentLadderItems()).toBe(false)
    // Stamped: a later load keeps what the sounding ladder has rated.
    items({ 'e-steps-up': { rating: 1300, attempts: 4 } })
    vi.resetModules()
    const later = await import('@/stores/ear-lab-store')
    expect(Object.keys(later.earItemStates())).toEqual(['e-steps-up'])
  })
})
