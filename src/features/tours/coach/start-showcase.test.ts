// startShowcase: the walk's place in the app. It mounts in the coach's root,
// ends a Merc tour on screen first, holds the app's offers while it runs,
// reports how it ended, and is gone from the page before Start here opens,
// so a tour that follows never shares the screen with the walk's Merc. The
// walk itself is Showcase.test.tsx's; here the tab bar is absent unless a
// case lays one out, so the walk is over as soon as it starts.

import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coachBusy, showcaseOn } from '@/lib/coach-state'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'

const fakes = vi.hoisted(() => ({
  trackGuide: vi.fn(),
  endCoachTour: vi.fn(),
  bannerOpen: false,
}))
vi.mock('@/lib/guide-funnel', () => ({ trackGuide: fakes.trackGuide }))
vi.mock('./start', () => ({
  COACH_ROOT_ID: 'coach-root',
  endCoachTour: fakes.endCoachTour,
  warmCoach: () => undefined,
}))
vi.mock('@/lib/consent', () => ({
  isConsentBannerOpen: () => fakes.bannerOpen,
}))
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

import { startShowcase } from './start-showcase'

const PLAN = { start: { dest: 'sing' } }
const MENU = { phone: false, scope: 'all', mode: 'advanced' } as const

/** One group of the top bar, laid out, so the walk has a stop to stand at. */
function oneGroup(): void {
  const group = document.createElement('div')
  group.dataset.tabGroup = 'you'
  group.getBoundingClientRect = () =>
    ({
      top: 8,
      left: 100,
      width: 200,
      height: 40,
      bottom: 48,
      right: 300,
    }) as DOMRect
  document.body.append(group)
}

beforeEach(() => {
  vi.clearAllMocks()
  fakes.bannerOpen = false
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('startShowcase', () => {
  it("mounts in the coach's root, after ending a Merc tour on screen", () => {
    oneGroup()
    void startShowcase(PLAN, { ...MENU, enterStart: vi.fn() })

    expect(fakes.endCoachTour).toHaveBeenCalledOnce()
    const root = document.getElementById('coach-root')
    expect(root?.querySelector('[data-testid="showcase"]')).not.toBeNull()
    document
      .querySelector<HTMLElement>('[data-testid="showcase-skip"]')
      ?.click()
  })

  it('holds the offers while it runs, and lets them go once Start here has opened', async () => {
    oneGroup()
    const busyAtStart: boolean[] = []
    const walk = startShowcase(PLAN, {
      ...MENU,
      enterStart: () => busyAtStart.push(coachBusy()),
    })
    expect(showcaseOn()).toBe(true)

    document
      .querySelector<HTMLElement>('[data-testid="showcase-skip"]')
      ?.click()
    await walk

    // Up while Start here opened (its tour takes the offers over), down after.
    expect(busyAtStart).toEqual([true])
    expect(showcaseOn()).toBe(false)
  })

  it('is gone from the page before Start here opens, and opens it once', async () => {
    const rootAtStart: (HTMLElement | null)[] = []
    const enterStart = vi.fn(() => {
      rootAtStart.push(document.getElementById('coach-root'))
    })

    const result = await startShowcase(PLAN, { ...MENU, enterStart })

    expect(result).toBe('done')
    expect(enterStart).toHaveBeenCalledExactlyOnceWith(PLAN.start)
    expect(rootAtStart).toEqual([null])
  })

  it('reports showcase_done at the end', async () => {
    await startShowcase(PLAN, { ...MENU, enterStart: vi.fn() })

    expect(fakes.trackGuide.mock.calls).toEqual([['showcase_done']])
  })

  it('reports showcase_skipped on Skip, and still opens Start here', async () => {
    oneGroup()
    const enterStart = vi.fn()
    const onEnd = vi.fn()
    const walk = startShowcase(PLAN, { ...MENU, enterStart, onEnd })

    document
      .querySelector<HTMLElement>('[data-testid="showcase-skip"]')
      ?.click()

    expect(await walk).toBe('skipped')
    expect(fakes.trackGuide.mock.calls).toEqual([['showcase_skipped']])
    expect(enterStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('skipped')
  })

  it('is one walk however often it is asked for', async () => {
    oneGroup()
    const enterStart = vi.fn()
    const first = startShowcase(PLAN, { ...MENU, enterStart })
    const second = startShowcase(PLAN, { ...MENU, enterStart })

    expect(second).toBe(first)
    expect(document.querySelectorAll('#coach-root')).toHaveLength(1)
    document
      .querySelector<HTMLElement>('[data-testid="showcase-skip"]')
      ?.click()
    await first
    expect(enterStart).toHaveBeenCalledOnce()
  })

  it('waits under the cookie banner, with Skip up', () => {
    oneGroup()
    fakes.bannerOpen = true
    const enterStart = vi.fn()

    void startShowcase(PLAN, { ...MENU, enterStart })

    expect(document.querySelector('[data-testid="showcase-line"]')).toBeNull()
    expect(enterStart).not.toHaveBeenCalled()
    document
      .querySelector<HTMLElement>('[data-testid="showcase-skip"]')
      ?.click()
    expect(enterStart).toHaveBeenCalledOnce()
  })
})
