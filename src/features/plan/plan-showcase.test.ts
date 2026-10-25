// runPlanShowcase: what the plan's two hosts do with "Show me around". The
// offers are held from the tap, before the showcase's code has arrived; the
// showcase is handed the plan and the menu as it stands; Start here is begun
// (counted, marked, the menu made whole) and opened with its tour once, as
// the showcase hands over; and a showcase that cannot start still opens Start
// here. The coach's showcase and enterStop are fakes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShowcaseOptions } from '@/features/tours/coach/start-showcase'
import { setShowcaseOn, showcaseOn } from '@/lib/coach-state'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import type { Plan, PlanStop } from './build-plan'
import { buildPlan } from './build-plan'

const fakes = vi.hoisted(() => ({
  startShowcase: vi.fn(),
  warmShowcase: vi.fn(),
  enterStop: vi.fn(),
  fail: false,
}))
vi.mock('@/features/tours/coach/start-showcase', () => ({
  startShowcase: (plan: unknown, opts: unknown) => {
    if (fakes.fail) throw new Error('no showcase')
    return fakes.startShowcase(plan, opts)
  },
  warmShowcase: fakes.warmShowcase,
}))
vi.mock('./enter-stop', () => ({ enterStop: fakes.enterStop }))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => true }))

import { runPlanShowcase, warmPlanShowcase } from './plan-showcase'

const PLAN: Plan = buildPlan({ q1: 'singing', q2: null, q3: [], q4: [] })

/** The options the showcase was handed, once it has been. */
async function handed(): Promise<ShowcaseOptions<PlanStop>> {
  await vi.waitFor(() => {
    expect(fakes.startShowcase).toHaveBeenCalled()
  })
  return fakes.startShowcase.mock.calls[0]?.[1] as ShowcaseOptions<PlanStop>
}

beforeEach(() => {
  vi.clearAllMocks()
  fakes.fail = false
  setShowcaseOn(false)
  setPracticeScope('guitar')
  setUiMode('simple')
})

afterEach(() => {
  setShowcaseOn(false)
  setPracticeScope('all')
  setUiMode('advanced')
})

describe('runPlanShowcase', () => {
  it('holds the offers at once, before its code has arrived', () => {
    runPlanShowcase(PLAN, vi.fn())

    expect(showcaseOn()).toBe(true)
    expect(fakes.startShowcase).not.toHaveBeenCalled()
  })

  it('hands the showcase the plan and the menu as it stands', async () => {
    runPlanShowcase(PLAN, vi.fn())

    const opts = await handed()
    expect(fakes.startShowcase.mock.calls[0]?.[0]).toBe(PLAN)
    expect(opts).toMatchObject({ phone: true, scope: 'guitar', mode: 'simple' })
  })

  it('begins Start here, then opens it with its tour, once, as the showcase hands over', async () => {
    const order: string[] = []
    const begin = vi.fn(() => order.push('begin'))
    fakes.enterStop.mockImplementation(() => order.push('enter'))
    runPlanShowcase(PLAN, begin)
    const opts = await handed()
    // Nothing is begun while Merc walks: the menu widens as Start here opens.
    expect(begin).not.toHaveBeenCalled()

    opts.enterStart(PLAN.start)
    opts.enterStart(PLAN.start)

    expect(order).toEqual(['begin', 'enter'])
    expect(fakes.enterStop).toHaveBeenCalledExactlyOnceWith(PLAN.start, true)
  })

  it('still opens Start here, and lets the offers go, when the showcase cannot start', async () => {
    fakes.fail = true
    const begin = vi.fn()

    runPlanShowcase(PLAN, begin)

    await vi.waitFor(() => {
      expect(fakes.enterStop).toHaveBeenCalledExactlyOnceWith(PLAN.start, true)
    })
    expect(begin).toHaveBeenCalledOnce()
    expect(showcaseOn()).toBe(false)
  })
})

describe('warmPlanShowcase', () => {
  it('fetches the showcase, which warms the coach', async () => {
    warmPlanShowcase()

    await vi.waitFor(() => {
      expect(fakes.warmShowcase).toHaveBeenCalledOnce()
    })
    expect(fakes.startShowcase).not.toHaveBeenCalled()
  })
})
