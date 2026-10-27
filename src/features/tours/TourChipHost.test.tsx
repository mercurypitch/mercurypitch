// @vitest-environment jsdom
// ============================================================
// TourChipHost — a tab's first-visit tour offer, by the page title
// ============================================================
//
// The eleven cases the corner toast was held to (usePageTourOffer.test.tsx,
// removed with it) are kept here case for case, then the chip's own: which
// tour a tap starts, a tab change ending a Merc tour, the pause a running
// tour holds, and the contextual offers offerTourOnce asks for.
//
// The chip loads once, before the cases (warmTourChip), so each offer shows
// as it is made. What an offer does while the chip is still loading is
// TourChipHost.lazy.test.tsx's.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { setCoachActive, setShowcaseOn } from '@/lib/coach-state'
import type { CoachTour } from '@/lib/coach-types'
import type { ActiveTab } from '@/types'

const store = vi.hoisted(() => ({
  hasPageTour: vi.fn((_tab: string) => true),
  startPageTour: vi.fn(),
  trackTour: vi.fn(),
  walkthrough: (() => false) as () => boolean,
  setWalkthrough: ((_v: boolean) => undefined) as (v: boolean) => void,
  retire: (() => undefined) as () => void,
}))
vi.mock('@/stores', async () => {
  const { createSignal } = await import('solid-js')
  const [walkthroughActive, setWalkthroughActive] = createSignal(false)
  const [tourOfferRetired, setRetired] = createSignal(0)
  store.walkthrough = walkthroughActive
  store.setWalkthrough = setWalkthroughActive
  store.retire = () => setRetired((n) => n + 1)
  return {
    hasPageTour: (tab: string) => store.hasPageTour(tab),
    startPageTour: (tab: string) => store.startPageTour(tab),
    // The store's room tour of the Guide's kind, which startRoomTour starts
    // for a tab with no Merc tour: its page tour, for every tab these cases
    // use (only Singing has a Guide section, and here it has Merc's).
    hasGuideRoomTour: (tab: string) => store.hasPageTour(tab),
    startGuideRoomTour: (tab: string) => store.startPageTour(tab),
    pageTourKey: (tab: string) =>
      tab === 'guitar' ? null : tab === 'home' ? 'home' : 'ear-lab',
    walkthroughActive,
    tourOfferRetired,
  }
})
vi.mock('@/lib/guide-funnel', () => ({
  trackTour: (...args: unknown[]) => store.trackTour(...args),
}))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => false }))

const coach = vi.hoisted(() => ({
  startCoachTour: vi.fn(async () => ({
    end: () => undefined,
    ended: Promise.resolve('exit' as const),
  })),
  endCoachTour: vi.fn(),
}))
vi.mock('@/components/coach/start', () => coach)

const SING_TOUR: CoachTour = {
  key: 'sing',
  steps: [
    { id: 'mic', kind: 'show', title: 'Tap to start', body: '', merc: 'point' },
  ],
}
const registry = vi.hoisted(() => ({
  COACH_TOURS: {} as Record<string, unknown>,
}))
vi.mock('./coach-tours', () => registry)

import { startRoomTour } from './room-tour'
import { requestTourChip, TourChipHost, warmTourChip } from './TourChipHost'

const KEY = (tab: string): string => `pitchperfect_page_tour_offered_${tab}`
const chip = (): HTMLElement | null => screen.queryByTestId('tour-chip')
/** The offer that follows a lifted pause waits one microtask. */
const settle = (): Promise<void> => Promise.resolve()

function mount(initial: string, initiallyPaused = false) {
  const [tab, setTab] = createSignal(initial as ActiveTab)
  const [paused, setPaused] = createSignal(initiallyPaused)
  render(() => <TourChipHost tab={tab} paused={paused} />)
  return { setTab: (t: string) => setTab(t as ActiveTab), setPaused }
}

beforeAll(async () => {
  expect(await warmTourChip()).toBe(true)
})

beforeEach(() => {
  localStorage.clear()
  store.hasPageTour.mockReset().mockReturnValue(true)
  store.startPageTour.mockClear()
  store.trackTour.mockClear()
  store.setWalkthrough(false)
  coach.startCoachTour.mockClear()
  coach.endCoachTour.mockClear()
  registry.COACH_TOURS = {}
  setCoachActive(null)
  setShowcaseOn(false)
})

afterEach(() => {
  cleanup()
})

describe('TourChipHost: what the toast was held to', () => {
  it('offers a tab once, and marks it offered only when the chip shows', () => {
    mount('home')

    expect(chip()).toHaveTextContent('New to Home? Take a quick tour.')
    expect(localStorage.getItem(KEY('home'))).toBe('true')
  })

  it('reports an offer once, when the chip shows', () => {
    mount('home')

    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'home']])
  })

  it('still shows the offer when the tab has no tour key to report', () => {
    mount('guitar')

    expect(chip()).not.toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY('guitar'))).toBe('true')
  })

  it('keeps the chip when the walkthrough flag changes on the same tab', () => {
    mount('home')
    store.setWalkthrough(true)
    store.setWalkthrough(false)

    expect(chip()).not.toBeNull()
    expect(store.trackTour).toHaveBeenCalledTimes(1)
  })

  it('does not burn the offer while the walkthrough is up', () => {
    store.setWalkthrough(true)
    mount('home')

    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBe(null)
  })

  it('clears the old offer and makes a new one when the tab changes', () => {
    const { setTab } = mount('home')
    setTab('ear-lab')

    expect(chip()).toHaveTextContent('New to Ear Lab? Take a quick tour.')
    expect(store.trackTour.mock.calls).toEqual([
      ['tour_offer', 'home'],
      ['tour_offer', 'ear-lab'],
    ])
  })

  it('waits while First Light, the plan or What’s New is open, and spends nothing', async () => {
    const { setTab } = mount('home', true)
    setTab('ear-lab')
    await settle()

    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBe(null)
    expect(localStorage.getItem(KEY('ear-lab'))).toBe(null)
  })

  it('offers the tab on screen once the pause lifts', async () => {
    const { setPaused } = mount('home', true)
    setPaused(false)
    expect(chip()).toBeNull()
    await settle()

    expect(chip()).toHaveTextContent('New to Home? Take a quick tour.')
    expect(localStorage.getItem(KEY('home'))).toBe('true')
  })

  it('stays out of a tour that starts as the pause lifts', async () => {
    const { setTab, setPaused } = mount('home', true)
    setTab('ear-lab')
    setPaused(false)
    store.setWalkthrough(true)
    await settle()

    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('ear-lab'))).toBe(null)
  })

  it('keeps the chip when what the pause reads changes and the pause does not', () => {
    const [tab] = createSignal('home' as ActiveTab)
    const [storeLanded, setStoreLanded] = createSignal(false)
    const paused = (): boolean => {
      storeLanded()
      return false
    }
    render(() => <TourChipHost tab={tab} paused={paused} />)
    expect(chip()).not.toBeNull()

    setStoreLanded(true)

    expect(chip()).not.toBeNull()
    expect(store.trackTour).toHaveBeenCalledTimes(1)
  })

  it('retires a shown offer when the pause returns', () => {
    const { setPaused } = mount('home')
    expect(chip()).not.toBeNull()
    setPaused(true)

    expect(chip()).toBeNull()
  })
})

describe('TourChipHost: the chip', () => {
  it('offers a tour once per tab', () => {
    const { setTab } = mount('home')
    setTab('ear-lab')
    setTab('home')

    expect(chip()).toBeNull()
    expect(
      store.trackTour.mock.calls.filter(([, key]) => key === 'home'),
    ).toHaveLength(1)
  })

  it('starts the Merc tour where one exists', async () => {
    const load = vi.fn(async () => SING_TOUR)
    registry.COACH_TOURS = { singing: { key: 'sing', load } }
    store.hasPageTour.mockReturnValue(false)
    mount('singing')

    expect(chip()).toHaveTextContent('Merc can show you around, 30 s')
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'sing']])
    fireEvent.click(screen.getByText('Merc can show you around, 30 s'))
    await vi.waitFor(() => expect(coach.startCoachTour).toHaveBeenCalled())

    expect(coach.startCoachTour).toHaveBeenCalledWith(SING_TOUR, {
      phone: false,
    })
    expect(chip()).toBeNull()
    expect(store.startPageTour).not.toHaveBeenCalled()
  })

  it('hands the offer back when the Merc tour it started does not load, so a later visit offers it again', async () => {
    const load = vi.fn(async (): Promise<CoachTour> => {
      throw new Error('chunk')
    })
    registry.COACH_TOURS = { singing: { key: 'sing', load } }
    store.hasPageTour.mockReturnValue(false)
    mount('singing')
    expect(localStorage.getItem(KEY('singing'))).toBe('true')

    fireEvent.click(screen.getByText('Merc can show you around, 30 s'))
    await vi.waitFor(() => expect(load).toHaveBeenCalled())

    // The chip comes back as Merc lets go: the same offer, so seeing it
    // spends nothing and reports nothing.
    await vi.waitFor(() =>
      expect(chip()).toHaveTextContent('Merc can show you around, 30 s'),
    )
    expect(localStorage.getItem(KEY('singing'))).toBeNull()
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'sing']])
    expect(coach.startCoachTour).not.toHaveBeenCalled()

    // A later visit (chunk recovery's reload is one) offers the tour again.
    cleanup()
    mount('singing')
    expect(chip()).toHaveTextContent('Merc can show you around, 30 s')
    expect(localStorage.getItem(KEY('singing'))).toBe('true')
    expect(store.trackTour).toHaveBeenCalledTimes(2)
  })

  it('spends a handed-back offer on Not now', async () => {
    const load = vi.fn(async (): Promise<CoachTour> => {
      throw new Error('chunk')
    })
    registry.COACH_TOURS = { singing: { key: 'sing', load } }
    store.hasPageTour.mockReturnValue(false)
    mount('singing')
    fireEvent.click(screen.getByText('Merc can show you around, 30 s'))
    await vi.waitFor(() => expect(chip()).not.toBeNull())
    expect(localStorage.getItem(KEY('singing'))).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('singing'))).toBe('true')
  })

  it('starts the old tour elsewhere', () => {
    mount('home')
    fireEvent.click(screen.getByText('New to Home? Take a quick tour.'))

    expect(store.startPageTour).toHaveBeenCalledWith('home')
    expect(coach.startCoachTour).not.toHaveBeenCalled()
    expect(chip()).toBeNull()
  })

  it('offers nothing on a tab with no tour of either kind', () => {
    store.hasPageTour.mockReturnValue(false)
    mount('settings')

    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('settings'))).toBe(null)
  })

  it('goes on Not now, and the tab is not offered again', () => {
    const { setTab } = mount('home')
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(chip()).toBeNull()
    setTab('ear-lab')
    setTab('home')

    expect(chip()).toBeNull()
    expect(store.startPageTour).not.toHaveBeenCalled()
  })

  it('ends a Merc tour when the tab changes', async () => {
    const { setTab } = mount('singing')
    setCoachActive('sing')
    expect(coach.endCoachTour).not.toHaveBeenCalled()
    setTab('home')

    await vi.waitFor(() => expect(coach.endCoachTour).toHaveBeenCalledOnce())
  })

  it('has nothing to end when no Merc tour runs', async () => {
    const { setTab } = mount('singing')
    setTab('home')
    store.setWalkthrough(true)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(coach.endCoachTour).not.toHaveBeenCalled()
  })

  it('ends a Merc tour when the legacy spotlight starts', async () => {
    mount('home')
    setCoachActive('sing')
    store.setWalkthrough(true)

    await vi.waitFor(() => expect(coach.endCoachTour).toHaveBeenCalledOnce())
  })

  it('offers nothing on a tab whose tour another door started, once it is over', async () => {
    // Arrange: the showcase holds the screen, then hands over to Start
    // here's tour (enterStop), as the plan's Show me around does.
    registry.COACH_TOURS = {
      singing: { key: 'sing', load: vi.fn(async () => SING_TOUR) },
    }
    store.hasPageTour.mockReturnValue(false)
    setShowcaseOn(true)
    mount('singing')
    startRoomTour('singing')
    setShowcaseOn(false)
    await vi.waitFor(() => expect(coach.startCoachTour).toHaveBeenCalled())

    // Act: the tour is over, and Merc lets go of the screen.
    setCoachActive(null)
    await settle()

    // Assert
    expect(chip()).toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()
  })

  it('waits for a running Merc tour', async () => {
    setCoachActive('sing')
    mount('home')
    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBe(null)

    setCoachActive(null)
    await settle()
    expect(chip()).not.toBeNull()
  })

  it("waits for Merc's showcase after the plan, and spends no offer under it", async () => {
    setShowcaseOn(true)
    mount('home')
    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBe(null)

    setShowcaseOn(false)
    await settle()
    expect(chip()).not.toBeNull()
  })

  it('goes when a drill or a stage takes the page', () => {
    mount('ear-lab')
    expect(chip()).not.toBeNull()
    store.retire()

    expect(chip()).toBeNull()
  })

  it('offers nothing where storage will not record the offer', () => {
    // The suite's storage is a plain double (setup-common.ts), so the spy
    // goes on it rather than on Storage.prototype.
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    mount('home')
    setItem.mockRestore()

    expect(chip()).toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()
  })
})

describe('the offer, spent once the chip has been seen', () => {
  // jsdom has no IntersectionObserver; this one is driven by hand, as the
  // page would scroll the chip in and out of view.
  let report: ((share: number) => void) | null = null

  beforeEach(() => {
    report = null
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly callback: IntersectionObserverCallback) {}
        observe(target: Element): void {
          report = (share) =>
            this.callback(
              [
                {
                  target,
                  isIntersecting: share > 0,
                  intersectionRatio: share,
                } as IntersectionObserverEntry,
              ],
              this as unknown as IntersectionObserver,
            )
        }
        disconnect(): void {
          report = null
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('spends nothing while the chip is scrolled away, and spends it once half of it is on screen', () => {
    mount('home')
    expect(chip()).not.toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()

    report?.(0.2)
    expect(localStorage.getItem(KEY('home'))).toBeNull()
    report?.(0.6)

    expect(localStorage.getItem(KEY('home'))).toBe('true')
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'home']])
    report?.(1)
    expect(store.trackTour).toHaveBeenCalledOnce()
  })

  it('leaves an offer nobody saw for the next visit', () => {
    const { setTab } = mount('home')
    expect(chip()).not.toBeNull()
    setTab('ear-lab')

    expect(localStorage.getItem(KEY('home'))).toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()
  })

  it('spends a contextual offer once it is seen, too', () => {
    store.hasPageTour.mockReturnValue(false)
    mount('karaoke')
    requestTourChip({
      key: 'mixer',
      storageKey: 'pitchperfect_mixer_tour_offered',
      line: 'New to the mixer? Take a quick tour.',
      onStart: () => undefined,
    })
    expect(chip()).not.toBeNull()
    expect(localStorage.getItem('pitchperfect_mixer_tour_offered')).toBeNull()

    report?.(0.5)
    expect(localStorage.getItem('pitchperfect_mixer_tour_offered')).toBe('true')
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'mixer']])
  })
})

describe('requestTourChip', () => {
  it('shows a chip that offerTourOnce asks for', () => {
    store.hasPageTour.mockReturnValue(false)
    mount('karaoke')
    const onStart = vi.fn()
    requestTourChip({
      key: 'mixer',
      storageKey: 'pitchperfect_mixer_tour_offered',
      line: 'New to the mixer? Take a quick tour.',
      onStart,
    })

    expect(chip()).toHaveTextContent('New to the mixer? Take a quick tour.')
    expect(localStorage.getItem('pitchperfect_mixer_tour_offered')).toBe('true')
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'mixer']])
    fireEvent.click(screen.getByText('New to the mixer? Take a quick tour.'))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('holds a request while the page is paused, and spends nothing', async () => {
    store.hasPageTour.mockReturnValue(false)
    const { setPaused } = mount('karaoke', true)
    requestTourChip({
      key: 'mixer',
      storageKey: 'pitchperfect_mixer_tour_offered',
      line: 'New to the mixer? Take a quick tour.',
      onStart: () => undefined,
    })
    expect(chip()).toBeNull()
    expect(localStorage.getItem('pitchperfect_mixer_tour_offered')).toBe(null)

    setPaused(false)
    await settle()
    expect(chip()).toHaveTextContent('New to the mixer? Take a quick tour.')
  })

  it("keeps a request that shows as the pause lifts, and leaves the tab's offer for later", async () => {
    const { setPaused } = mount('home', true)
    requestTourChip({
      key: 'mixer',
      storageKey: 'pitchperfect_mixer_tour_offered',
      line: 'New to the mixer? Take a quick tour.',
      onStart: () => undefined,
    })
    setPaused(false)
    await settle()

    expect(chip()).toHaveTextContent('New to the mixer? Take a quick tour.')
    // Home's offer was never on screen, so it is not spent.
    expect(localStorage.getItem(KEY('home'))).toBe(null)
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'mixer']])
  })
})

describe('the host under createRoot', () => {
  it('lets go of its effects when its owner goes', async () => {
    const [tab, setTab] = createSignal('home' as ActiveTab)
    const dispose = createRoot((d) => {
      TourChipHost({ tab, paused: () => false })
      return d
    })
    setCoachActive('sing')
    dispose()
    setTab('ear-lab' as ActiveTab)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(coach.endCoachTour).not.toHaveBeenCalled()
  })
})
