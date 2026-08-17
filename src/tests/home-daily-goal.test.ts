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
vi.mock('@/db/services/user-service', async () => {
  const { createSignal } = await import('solid-js')
  const [get, set] = createSignal(0)
  return { authVersion: get, __setAuthVersion: set }
})

import * as sessionService from '@/db/services/session-service'
import * as userService from '@/db/services/user-service'
import { createDailyGoalProgress } from '@/features/home/daily-goal'

const setVersion = (
  sessionService as unknown as { __setVersion: (v: number) => void }
).__setVersion
const setAuthVersion = (
  userService as unknown as { __setAuthVersion: (v: number) => void }
).__setAuthVersion

beforeEach(() => {
  setVersion(0)
  setAuthVersion(0)
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

  it('recomputes when the signed-in account changes', () => {
    // Minutes are stored per owner: sign-out (or sign-in) swaps whose day
    // the bar shows, and the memo must notice without a navigation.
    createRoot((dispose) => {
      const goal = createDailyGoalProgress()
      minutes.value = 4
      expect(goal().minutes).toBe(0)

      setAuthVersion(1) // sign-out: the anonymous owner has 4 minutes today
      expect(goal().minutes).toBe(4)
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

  it('keys the streak resource on the record AND auth versions', () => {
    expect(source).toMatch(
      /createResource\(\s*\(\) => \[sessionRecordVersion\(\), authVersion\(\)\],\s*getStreakState,?\s*\)/,
    )
  })

  it('keys the week strip on the record and auth versions too', () => {
    // It used to fetch once per mount: a run finished or a sign-out while
    // Home stayed open left last account's week on screen.
    expect(source).toMatch(
      /createResource\(\s*\(\) => \[sessionRecordVersion\(\), authVersion\(\)\],\s*\(\) => loadSessionRecords\(300\),?\s*\)/,
    )
  })
})
