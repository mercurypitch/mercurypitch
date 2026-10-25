// @vitest-environment jsdom
// ============================================================
// TourChipHost — a tab's first-visit tour offer, by the page title
// ============================================================
//
// The eleven cases the corner toast was held to (usePageTourOffer.test.tsx,
// removed with it) are kept here case for case, then the chip's own: which
// tour a tap starts, a tab change ending a Merc tour, the pause a running
// tour holds, and the contextual offers offerTourOnce asks for.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveTab } from '@/types'
import { setCoachActive } from './coach/coach-state'
import type { CoachTour } from './coach/types'

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
vi.mock('./coach/start', () => coach)

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

import { requestTourChip, TourChipHost } from './TourChipHost'

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

  it('waits for a running Merc tour', async () => {
    setCoachActive('sing')
    mount('home')
    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBe(null)

    setCoachActive(null)
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
