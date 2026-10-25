// ============================================================
// enterStop and widenMenuFor: the two things a way into a stop does
// ============================================================
//
// The plan layer, Home's card and the showcase's end open a stop the same way:
// a tab is switched to, a page is navigated to, and a room's tour starts only
// when the person asked for it ("Show me around") and the room has one: its
// Merc tour where it has one, else its spotlight tour. Karaoke Night is the
// one page with a tour, opened by its address. First Light keeps a path of
// its own for a tapped card, which also has to close First Light.
//
// Before that, a menu that hides the stop's room is made whole, and the
// person is told. That is `widenMenuFor`, its own function because First
// Light's path bypasses enterStop and the plan layer must make the menu whole
// before its host hears of the stop, so neither can have it folded in.
//
// The tab and settings stores are the real ones, and so is startRoomTour,
// handed to the room tour door (src/lib/room-tour-door.ts) as App hands it.
// Only the edges are faked: the browser's navigation (jsdom cannot go
// anywhere), the tours (a real walkthrough, or the coach's layer) and the
// toast (which is the notifications store's to draw).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeScope, UiMode } from '@/features/tabs/constants'
import type { CoachTour } from '@/features/tours/coach/types'
import { startRoomTour } from '@/features/tours/room-tour'
import { coachActive, setCoachActive } from '@/lib/coach-state'
import { provideRoomTourDoor } from '@/lib/room-tour-door'
import type * as AppStoreModule from '@/stores/app-store'
import type * as NotificationsStoreModule from '@/stores/notifications-store'
import { practiceScope, setPracticeScope, setUiMode, uiMode, } from '@/stores/settings-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'
import type { PlanDest, PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { enterStop, widenMenuFor } from './enter-stop'
import { MENU_WHOLE } from './plan-copy'

const mocks = vi.hoisted(() => ({
  hasPageTour: vi.fn<(tab: string) => boolean>(),
  startPageTour: vi.fn<(tab: string) => void>(),
  showNotification: vi.fn<(message: string) => void>(),
  startCoachTour: vi.fn(),
}))

// The Merc tours by tab: none, until a case lists one.
const registry = vi.hoisted(() => ({
  COACH_TOURS: {} as Record<string, unknown>,
}))
vi.mock('@/features/tours/coach-tours', () => registry)
vi.mock('@/features/tours/coach/start', () => ({
  startCoachTour: mocks.startCoachTour,
}))

vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<typeof AppStoreModule>()),
  hasPageTour: mocks.hasPageTour,
  startPageTour: mocks.startPageTour,
}))

vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationsStoreModule>()),
  showNotification: mocks.showNotification,
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

provideRoomTourDoor(startRoomTour)

beforeEach(() => {
  vi.clearAllMocks()
  registry.COACH_TOURS = {}
  setCoachActive(null)
  mocks.hasPageTour.mockReturnValue(false)
  setActiveTab(START)
  setPracticeScope('all')
  setUiMode('advanced')
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

  it("starts the room's Merc tour, in the room, where it has one", async () => {
    const tour: CoachTour = { key: 'sing', steps: [] }
    registry.COACH_TOURS = {
      guitar: { key: 'sing', load: async () => tour },
    }
    mocks.hasPageTour.mockReturnValue(true)

    enterStop(stopAt('guitar'), true)

    // Named at once, while it loads, so no offer lands on it.
    expect(activeTab()).toBe('guitar')
    expect(coachActive()).toBe('sing')
    await vi.waitFor(() => {
      expect(mocks.startCoachTour).toHaveBeenCalledWith(tour, { phone: false })
    })
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

  it("opens Karaoke Night at its tour's address when the tour is asked for", () => {
    enterStop(stopAt('karaokeNight'), true)

    expect(browser.href).toBe('/karaoke?tour=first')
    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })

  it.each(PAGES.filter(([dest]) => dest !== 'karaokeNight'))(
    'opens %s plainly, with no tour of its own to ask for',
    (dest, room) => {
      const target = room.target as { kind: 'page'; href: string }
      mocks.hasPageTour.mockReturnValue(true)

      enterStop(stopAt(dest), true)

      expect(browser.href).toBe(target.href)
      expect(mocks.startPageTour).not.toHaveBeenCalled()
    },
  )
})

// ── A menu that hides the stop ─────────────────────────────────────────

describe('widenMenuFor', () => {
  // The menu is the scope (which instrument) and the mode (Simple or not). A
  // scope is blamed only when a whole menu would show the room: a room that
  // Simple mode hides stays hidden whatever the scope, and a page is no room
  // of the menu at all.
  type Case = [
    label: string,
    scope: PracticeScope,
    mode: UiMode,
    dest: PlanDest,
  ]

  const widens: Case[] = [
    ['a piano menu, for the Sing room', 'piano', 'advanced', 'sing'],
    ['a guitar menu, for the Jam room', 'guitar', 'advanced', 'jam'],
    [
      'a piano menu in Simple mode, for the Sing room',
      'piano',
      'simple',
      'sing',
    ],
  ]
  const leavesAlone: Case[] = [
    ['a singing menu, for the Sing room', 'singing', 'advanced', 'sing'],
    ['a whole menu, for the Sing room', 'all', 'advanced', 'sing'],
    [
      'a piano menu, for Home, which every scope has',
      'piano',
      'advanced',
      'homeSession',
    ],
    [
      'a piano menu, for Karaoke Night, which is a page',
      'piano',
      'advanced',
      'karaokeNight',
    ],
    [
      'Simple mode, for the Jam room, which only Simple mode hides',
      'all',
      'simple',
      'jam',
    ],
    [
      'a piano menu in Simple mode, for the Jam room, which a whole menu would still hide',
      'piano',
      'simple',
      'jam',
    ],
  ]

  it.each(widens)(
    '%s: makes the menu whole and says so',
    (_, scope, mode, dest) => {
      setPracticeScope(scope)
      setUiMode(mode)

      widenMenuFor(stopAt(dest))

      expect([practiceScope(), uiMode()]).toEqual(['all', mode])
      expect(mocks.showNotification.mock.calls).toEqual([[MENU_WHOLE]])
    },
  )

  it.each(leavesAlone)(
    '%s: leaves the menu alone and says nothing',
    (_, scope, mode, dest) => {
      setPracticeScope(scope)
      setUiMode(mode)

      widenMenuFor(stopAt(dest))

      expect([practiceScope(), uiMode()]).toEqual([scope, mode])
      expect(mocks.showNotification).not.toHaveBeenCalled()
    },
  )

  it('says it once, however many times it is asked', () => {
    setPracticeScope('piano')

    widenMenuFor(stopAt('sing'))
    widenMenuFor(stopAt('sing'))

    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
  })

  it('goes nowhere itself: the stop is for enterStop to open', () => {
    setPracticeScope('piano')

    widenMenuFor(stopAt('sing'))

    expect(activeTab()).toBe(START)
    expect(browser.href).toBe('')
    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })

  it('is not folded into enterStop, which moves the person and leaves the menu as it is', () => {
    setPracticeScope('piano')

    enterStop(stopAt('sing'))

    expect(activeTab()).toBe('singing')
    expect(practiceScope()).toBe('piano')
    expect(mocks.showNotification).not.toHaveBeenCalled()
  })
})
