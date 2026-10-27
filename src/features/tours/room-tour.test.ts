// startRoomTour: a tab's tour, whichever kind it has. A Merc tour is named in
// coachActive from the ask, so an offer due while it loads waits for it; one
// ended, unwanted or asked for again while it loads never shows; a chunk that
// does not arrive lets go. A tab without one gets the room's tour of the
// Guide's kind (startGuideRoomTour in the app store: its legacy spotlight
// tour, or Singing's Guide section), and a tab with neither gets nothing;
// hasRoomTour says which tabs have one. A Merc tour ends on what the app names
// next (provideTourHandoff), and a tour that starts spends its tab's offer.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachStartOptions } from '@/components/coach/start'
import { coachActive, setCoachActive } from '@/lib/coach-state'
import type { CoachTour } from '@/lib/coach-types'

const fakes = vi.hoisted(() => ({
  hasPageTour: vi.fn((_tab: string) => false),
  hasGuideRoomTour: vi.fn((_tab: string) => false),
  startGuideRoomTour: vi.fn(),
  startCoachTour: vi.fn(),
}))
vi.mock('@/stores', () => ({
  hasPageTour: (tab: string) => fakes.hasPageTour(tab),
  hasGuideRoomTour: (tab: string) => fakes.hasGuideRoomTour(tab),
  startGuideRoomTour: (tab: string) => fakes.startGuideRoomTour(tab),
}))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => true }))
vi.mock('@/components/coach/start', () => ({
  startCoachTour: fakes.startCoachTour,
}))
const registry = vi.hoisted(() => ({
  COACH_TOURS: {} as Record<string, unknown>,
}))
vi.mock('./coach-tours', () => registry)

import { hasRoomTour, provideTourHandoff, startRoomTour, tourOfferKey, } from './room-tour'

const TOUR: CoachTour = { key: 'sing', steps: [] }

/** A Merc tour for the Sing tab whose module arrives when `arrive` is called. */
function singTour(): { arrive: () => void; fail: () => void } {
  let arrive!: () => void
  let fail!: () => void
  const loaded = new Promise<CoachTour>((resolve, reject) => {
    arrive = () => resolve(TOUR)
    fail = () => reject(new Error('chunk'))
  })
  registry.COACH_TOURS = { singing: { key: 'sing', load: () => loaded } }
  return { arrive, fail }
}

/** Lets every load in flight settle: the tour's module and the coach's. */
const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 20))

beforeEach(() => {
  vi.clearAllMocks()
  fakes.hasPageTour.mockReturnValue(false)
  fakes.hasGuideRoomTour.mockReturnValue(false)
  registry.COACH_TOURS = {}
  setCoachActive(null)
  provideTourHandoff(null)
  localStorage.clear()
})

afterEach(() => {
  setCoachActive(null)
})

describe('startRoomTour', () => {
  it("starts a tab's Merc tour, named from the ask while it loads, on the phone's layout", async () => {
    const tour = singTour()

    expect(startRoomTour('singing')).toBe(true)
    expect(coachActive()).toBe('sing')
    expect(fakes.startCoachTour).not.toHaveBeenCalled()

    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })

    expect(fakes.startCoachTour).toHaveBeenCalledExactlyOnceWith(TOUR, {
      phone: true,
    })
    expect(fakes.startGuideRoomTour).not.toHaveBeenCalled()
  })

  it('starts nothing for a tour ended while it loaded', async () => {
    const tour = singTour()
    startRoomTour('singing')

    // endCoachTour, for a tour still loading, lets go of its name.
    setCoachActive(null)
    tour.arrive()
    await settled()

    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(coachActive()).toBeNull()
  })

  it('starts nothing for a tour no longer wanted once it loads, and lets go of it', async () => {
    const tour = singTour()
    let wanted = true
    startRoomTour('singing', () => wanted)

    wanted = false
    tour.arrive()
    await settled()

    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(coachActive()).toBeNull()
  })

  it('starts one tour when it is asked for twice while it loads', async () => {
    const tour = singTour()
    startRoomTour('singing')
    startRoomTour('singing')

    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })
    await settled()

    expect(fakes.startCoachTour).toHaveBeenCalledOnce()
  })

  it('lets go when its chunk does not arrive', async () => {
    const tour = singTour()
    startRoomTour('singing')

    tour.fail()
    await settled()

    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(coachActive()).toBeNull()
  })

  it("starts a tab's legacy spotlight tour, as the store starts a room's, where it has no Merc tour", () => {
    fakes.hasPageTour.mockReturnValue(true)
    fakes.hasGuideRoomTour.mockReturnValue(true)

    expect(startRoomTour('guitar')).toBe(true)

    expect(fakes.startGuideRoomTour).toHaveBeenCalledExactlyOnceWith('guitar')
    expect(coachActive()).toBeNull()
  })

  it("starts Singing's Guide section where Merc's tour does not apply", () => {
    // Arrange: no Merc tour listed for Singing, which has no page tour; the
    // store's room tour for it is the Guide's Singing section.
    fakes.hasGuideRoomTour.mockImplementation((tab) => tab === 'singing')

    // Act + Assert
    expect(startRoomTour('singing')).toBe(true)
    expect(fakes.startGuideRoomTour).toHaveBeenCalledExactlyOnceWith('singing')
    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(coachActive()).toBeNull()
  })

  it('starts nothing, and says so, for a tab with neither', () => {
    expect(startRoomTour('settings')).toBe(false)

    expect(fakes.startGuideRoomTour).not.toHaveBeenCalled()
    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(localStorage.getItem(tourOfferKey('settings'))).toBeNull()
  })
})

describe('hasRoomTour', () => {
  it('says a tab has a tour where it has a Merc tour, without asking the store', () => {
    singTour()

    expect(hasRoomTour('singing')).toBe(true)
    expect(fakes.hasGuideRoomTour).not.toHaveBeenCalled()
  })

  it("says so for a tab with only the Guide's kind, and not for a tab with neither", () => {
    fakes.hasGuideRoomTour.mockImplementation((tab) => tab === 'singing')

    expect([hasRoomTour('singing'), hasRoomTour('settings')]).toEqual([
      true,
      false,
    ])
  })
})

describe('what a finished Merc tour offers next', () => {
  it('is what the app names for the tab toured, loaded with the tour', async () => {
    const tour = singTour()
    const go = vi.fn()
    provideTourHandoff(async () => (tab) => ({
      title: 'Next on your plan',
      body: `after ${tab}`,
      go,
    }))

    startRoomTour('singing')
    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })

    const [, opts] = fakes.startCoachTour.mock.calls[0] as [
      CoachTour,
      CoachStartOptions,
    ]
    expect(opts.phone).toBe(true)
    expect(opts.handoff?.()).toEqual({
      title: 'Next on your plan',
      body: 'after singing',
      go,
    })
  })

  it('is nothing when it does not load, and the tour still starts', async () => {
    const tour = singTour()
    provideTourHandoff(async () => Promise.reject(new Error('chunk')))

    startRoomTour('singing')
    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })
    await settled()

    const [, opts] = fakes.startCoachTour.mock.calls[0] as [
      CoachTour,
      CoachStartOptions,
    ]
    expect(opts.handoff?.()).toBeNull()
  })

  it('never holds the tour back while it loads, and is nothing until it has', async () => {
    const tour = singTour()
    let arrive!: () => void
    provideTourHandoff(
      async () =>
        new Promise((resolve) => {
          arrive = () =>
            resolve((tab) => ({ title: 'Next', body: tab, go: vi.fn() }))
        }),
    )

    startRoomTour('singing')
    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })
    const [, opts] = fakes.startCoachTour.mock.calls[0] as [
      CoachTour,
      CoachStartOptions,
    ]
    expect(opts.handoff?.()).toBeNull()

    arrive()
    await settled()
    expect(opts.handoff?.()).toMatchObject({ body: 'singing' })
  })

  it('is not asked for where the app names none', async () => {
    const tour = singTour()

    startRoomTour('singing')
    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })

    expect(fakes.startCoachTour).toHaveBeenCalledExactlyOnceWith(TOUR, {
      phone: true,
    })
  })
})

describe("a tab's offer", () => {
  it('is spent once its Merc tour has started, so the chip never offers what was just shown', async () => {
    const tour = singTour()
    let started!: () => void
    fakes.startCoachTour.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        started = resolve
      }),
    )
    startRoomTour('singing')
    expect(localStorage.getItem(tourOfferKey('singing'))).toBeNull()

    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })
    await settled()
    expect(localStorage.getItem(tourOfferKey('singing'))).toBeNull()

    started()
    await vi.waitFor(() => {
      expect(localStorage.getItem(tourOfferKey('singing'))).toBe('true')
    })
  })

  it('is left for the next visit when the coach does not load', async () => {
    const tour = singTour()
    fakes.startCoachTour.mockRejectedValueOnce(new Error('chunk'))
    startRoomTour('singing')

    tour.arrive()
    await vi.waitFor(() => {
      expect(fakes.startCoachTour).toHaveBeenCalled()
    })
    await settled()

    expect(localStorage.getItem(tourOfferKey('singing'))).toBeNull()
  })

  it('is spent when its legacy spotlight tour starts', () => {
    fakes.hasPageTour.mockReturnValue(true)
    fakes.hasGuideRoomTour.mockReturnValue(true)

    startRoomTour('guitar')

    expect(localStorage.getItem(tourOfferKey('guitar'))).toBe('true')
  })

  it("is not written for Singing's Guide section, which the chip never offers", () => {
    fakes.hasGuideRoomTour.mockImplementation((tab) => tab === 'singing')

    startRoomTour('singing')

    expect(fakes.startGuideRoomTour).toHaveBeenCalledExactlyOnceWith('singing')
    expect(localStorage.getItem(tourOfferKey('singing'))).toBeNull()
  })

  it('is kept for a Merc tour that never showed', async () => {
    const tour = singTour()
    startRoomTour('singing')

    tour.fail()
    await settled()

    expect(localStorage.getItem(tourOfferKey('singing'))).toBeNull()
  })
})

describe('a Merc tour that does not load', () => {
  it('tells whoever asked, when its own chunk does not arrive', async () => {
    const tour = singTour()
    const failed = vi.fn()
    startRoomTour('singing', () => true, failed)

    tour.fail()
    await settled()

    expect(failed).toHaveBeenCalledOnce()
  })

  it("tells whoever asked, when the coach's chunk does not arrive", async () => {
    const tour = singTour()
    fakes.startCoachTour.mockRejectedValueOnce(new Error('chunk'))
    const failed = vi.fn()
    startRoomTour('singing', () => true, failed)

    tour.arrive()
    await settled()

    expect(failed).toHaveBeenCalledOnce()
  })

  it('tells nobody about a tour that loaded and was no longer wanted', async () => {
    const tour = singTour()
    const failed = vi.fn()
    startRoomTour('singing', () => false, failed)

    tour.arrive()
    await settled()

    expect(fakes.startCoachTour).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
  })

  it('tells nobody about a tour that started', async () => {
    const tour = singTour()
    const failed = vi.fn()
    startRoomTour('singing', () => true, failed)

    tour.arrive()
    await vi.waitFor(() => {
      expect(localStorage.getItem(tourOfferKey('singing'))).toBe('true')
    })

    expect(failed).not.toHaveBeenCalled()
  })
})
