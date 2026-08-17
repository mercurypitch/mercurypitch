// ============================================================
// "N of 5 min" moves while Home is on screen
// ============================================================
//
// Repro: finish practice with Home mounted (or watch it after the
// crediting fix) — the goal bar and the streak card sat frozen because
// the page read minutes once per mount and its streak resource had no
// dependency on the record version. The readout is now a memo keyed on
// sessionRecordVersion, and the streak resource refetches on the same
// signal.

import { readFileSync } from 'node:fs'
import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const minutes = vi.hoisted(() => ({ value: 0 }))

vi.mock('@/db/services/session-service', async () => {
  const { createSignal } = await import('solid-js')
  const [get, set] = createSignal(0)
  return { sessionRecordVersion: get, __setVersion: set }
})
vi.mock('@/db/services/practice-minutes', () => ({
  DAILY_GOAL_MS: 300_000,
  getTodayScoredMinutes: () => minutes.value,
}))

import * as sessionService from '@/db/services/session-service'
import { createDailyGoalProgress } from '@/features/home/daily-goal'

const setVersion = (
  sessionService as unknown as { __setVersion: (v: number) => void }
).__setVersion

beforeEach(() => {
  setVersion(0)
  minutes.value = 0
})

describe('createDailyGoalProgress', () => {
  it('recomputes when a session record lands', () => {
    createRoot((dispose) => {
      const goal = createDailyGoalProgress()
      expect(goal()).toEqual({ minutes: 0, met: false, pct: 0 })

      // A run finishes and is credited while Home stays mounted.
      minutes.value = 3
      setVersion(1)
      expect(goal()).toEqual({ minutes: 3, met: false, pct: 60 })

      minutes.value = 6
      setVersion(2)
      expect(goal()).toEqual({ minutes: 6, met: true, pct: 100 })
      dispose()
    })
  })

  it('does not recompute without the version signal', () => {
    // The memo's dependency IS the fix: minutes alone are not reactive.
    createRoot((dispose) => {
      const goal = createDailyGoalProgress()
      expect(goal().minutes).toBe(0)
      minutes.value = 5
      expect(goal().minutes).toBe(0)
      dispose()
    })
  })
})

describe('HomePage reads the live sources', () => {
  const source = readFileSync('src/pages/HomePage.tsx', 'utf8')

  it('routes the goal bar through the reactive readout', () => {
    expect(source).toContain('createDailyGoalProgress()')
    expect(source).not.toContain('const minutesToday = getTodayScoredMinutes()')
  })

  it('keys the streak resource on the record version', () => {
    expect(source).toMatch(
      /createResource\(\s*sessionRecordVersion,\s*getStreakState,?\s*\)/,
    )
  })
})
