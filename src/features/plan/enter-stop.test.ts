// ============================================================
// enterStop: one way into a stop of the plan
// ============================================================
//
// The plan layer and Home's card open a stop the same way: a tab is switched
// to, a page is navigated to, and a room's spotlight tour starts only when the
// person asked for it and the room has one. First Light keeps a path of its
// own, which also has to close First Light.
//
// The tab store is the real one. Only the edges are faked: the browser's
// navigation (jsdom cannot go anywhere) and the tour (which would open a real
// walkthrough).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AppStoreModule from '@/stores/app-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'
import type { PlanDest, PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { enterStop } from './enter-stop'

const mocks = vi.hoisted(() => ({
  hasPageTour: vi.fn<(tab: string) => boolean>(),
  startPageTour: vi.fn<(tab: string) => void>(),
}))

vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<typeof AppStoreModule>()),
  hasPageTour: mocks.hasPageTour,
  startPageTour: mocks.startPageTour,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

const stopAt = (dest: PlanDest): PlanStop => ({
  kind: 'start',
  dest,
  title: PLAN_DESTS[dest].room,
  why: '',
  chips: [],
})

/** The stops whose room is a tab of the app, and those that are a page of their own. */
const dests = Object.entries(PLAN_DESTS) as [
  PlanDest,
  (typeof PLAN_DESTS)[PlanDest],
][]
const TABS = dests.filter(([, d]) => d.target.kind === 'tab')
const PAGES = dests.filter(([, d]) => d.target.kind === 'page')

/** Where the person stands: a tab that is no stop's room, so every stop is a move. */
const START = 'settings'

let browser: { href: string }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPageTour.mockReturnValue(false)
  setActiveTab(START)
  browser = { href: '' }
  vi.stubGlobal('location', browser)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── A stop that is a tab ───────────────────────────────────────────────

describe('a stop that is a tab', () => {
  it('has stops of both kinds to test', () => {
    expect(TABS.length).toBeGreaterThan(0)
    expect(PAGES.length).toBeGreaterThan(0)
  })

  it.each(TABS)('switches to the %s tab and goes nowhere', (dest, room) => {
    const target = room.target as { kind: 'tab'; tab: string }
    expect(target.tab).not.toBe(START)

    enterStop(stopAt(dest))

    expect(activeTab()).toBe(target.tab)
    expect(browser.href).toBe('')
  })

  it('starts no tour unless one is asked for, even where the room has one', () => {
    mocks.hasPageTour.mockReturnValue(true)

    enterStop(stopAt('guitar'))
    enterStop(stopAt('guitar'), false)

    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })

  it("starts the room's tour, in the room, when asked and the room has one", () => {
    mocks.hasPageTour.mockReturnValue(true)
    const tabWhenStarted: string[] = []
    mocks.startPageTour.mockImplementation(() => {
      tabWhenStarted.push(activeTab())
    })

    enterStop(stopAt('guitar'), true)

    expect(mocks.hasPageTour).toHaveBeenCalledWith('guitar')
    expect(mocks.startPageTour).toHaveBeenCalledExactlyOnceWith('guitar')
    expect(tabWhenStarted).toEqual(['guitar'])
  })

  it('only enters a room that has no tour, when one is asked for', () => {
    mocks.hasPageTour.mockReturnValue(false)

    enterStop(stopAt('guitar'), true)

    expect(activeTab()).toBe('guitar')
    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })
})

// ── A stop that is a page ──────────────────────────────────────────────

describe('a stop that is a page', () => {
  it.each(PAGES)('goes to the page of %s', (dest, room) => {
    const target = room.target as { kind: 'page'; href: string }

    enterStop(stopAt(dest))

    expect(browser.href).toBe(target.href)
    expect(activeTab()).toBe(START)
  })

  it('starts no tour, since a page is not the app a tour can spotlight', () => {
    mocks.hasPageTour.mockReturnValue(true)

    enterStop(stopAt('karaokeNight'), true)

    expect(browser.href).toBe('/karaoke')
    expect(mocks.hasPageTour).not.toHaveBeenCalled()
    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })
})
