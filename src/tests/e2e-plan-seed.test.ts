// ============================================================
// The e2e plan seed is a record the plan reads as settled, and dismissOverlays plants it
// ============================================================
//
// dismissOverlays spends First Light's welcome so that a spec's reload does not
// meet the intro. That makes the reload a returning visit, and the opening
// takeover puts the plan layer in front of a returning visitor who has no plan
// record. It leaves a run that sets `window.E2E_TEST_MODE` alone, and about half
// the specs do not set it, so the helper settles the plan as well: a record for
// a plan that was turned down long ago.
//
// The record is built in one module that imports no Playwright
// (src/e2e/helpers/plan-seed.ts), so that it can be loaded here and held to the
// plan's own reader and rules. A change to the record's format then fails this
// file, and not every spec that calls the helper.

import type { Page } from '@playwright/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answeredPlanSeed, settledPlanSeed, thisWeeksPlanSeed, } from '@/e2e/helpers/plan-seed'
import { dismissOverlays } from '@/e2e/helpers/ui'
import { buildPlan, PLAN_DESTS, planStops } from '@/features/plan/build-plan'
import { planCardKind } from '@/features/plan/plan-card-rules'
import { PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import { isPlanRecordV1 } from '@/features/plan/plan-record'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('the seed', () => {
  it("is stored under the plan record's own key", () => {
    expect(settledPlanSeed().key).toBe(PLAN_RECORD_KEY)
  })

  it("is a record the plan's own reader accepts, so the takeover finds a plan on file", async () => {
    const seed = settledPlanSeed()
    expect(isPlanRecordV1(JSON.parse(seed.value))).toBe(true)

    localStorage.setItem(seed.key, seed.value)
    vi.resetModules()
    const { planRecord } = await import('@/features/plan/plan-store')

    expect(planRecord()).toEqual(JSON.parse(seed.value))
  })

  it("is a plan turned down, which the sync never sends, and out of Home's card week now and later", () => {
    const record: unknown = JSON.parse(settledPlanSeed().value)
    expect(isPlanRecordV1(record)).toBe(true)
    if (!isPlanRecordV1(record)) return

    expect(record.status).toBe('declined')
    for (const now of [Date.now(), Date.now() + 10 * YEAR_MS]) {
      expect(planCardKind({ record, dismissed: false, now })).toBeNull()
    }
  })
})

describe('the answered seed', () => {
  it("is a record the plan's own reader accepts, under its own key", async () => {
    const seed = answeredPlanSeed()
    expect(seed.key).toBe(PLAN_RECORD_KEY)
    expect(isPlanRecordV1(JSON.parse(seed.value))).toBe(true)

    localStorage.setItem(seed.key, seed.value)
    vi.resetModules()
    const { planRecord } = await import('@/features/plan/plan-store')

    expect(planRecord()?.status).toBe('answered')
  })

  it("is a plan whose Start here is the Sing room, and out of Home's card week", () => {
    const record: unknown = JSON.parse(answeredPlanSeed().value)
    if (!isPlanRecordV1(record)) throw new Error('a plan record')

    const start = buildPlan(record.choices).start
    expect(PLAN_DESTS[start.dest].target).toEqual({
      kind: 'tab',
      tab: 'singing',
    })
    for (const now of [Date.now(), Date.now() + 10 * YEAR_MS]) {
      expect(planCardKind({ record, dismissed: false, now })).toBeNull()
    }
  })
})

describe("this week's seed", () => {
  const NOW = '2026-10-27T09:00:00.000Z'

  it("is a record the plan's own reader accepts, under its own key, dated as asked", () => {
    const seed = thisWeeksPlanSeed(NOW)
    const record: unknown = JSON.parse(seed.value)

    expect(seed.key).toBe(PLAN_RECORD_KEY)
    expect(isPlanRecordV1(record)).toBe(true)
    expect((record as { at: string }).at).toBe(NOW)
  })

  it('is a plan Home shows as its card, with three stops, on the day it is dated', () => {
    const record: unknown = JSON.parse(thisWeeksPlanSeed(NOW).value)
    if (!isPlanRecordV1(record)) throw new Error('a plan record')

    expect(
      planCardKind({ record, dismissed: false, now: Date.parse(NOW) }),
    ).toBe('plan')
    expect(planStops(buildPlan(record.choices))).toHaveLength(3)
  })
})

describe('dismissOverlays', () => {
  /** A page whose evaluate runs the function here, in jsdom, as a browser would. */
  const page = {
    evaluate: async (run: (given: unknown) => unknown, given: unknown) =>
      run(given),
    waitForTimeout: async () => undefined,
  } as unknown as Page

  it('settles the plan beside the welcome it spends', async () => {
    await dismissOverlays(page)

    expect(localStorage.getItem('pitchperfect_welcome_version')).not.toBeNull()
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(settledPlanSeed().value)
  })

  it('keeps a plan record a spec seeded for itself', async () => {
    const own = JSON.stringify({ own: 'record' })
    localStorage.setItem(PLAN_RECORD_KEY, own)

    await dismissOverlays(page)

    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBe(own)
  })
})
