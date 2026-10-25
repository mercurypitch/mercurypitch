// startRoomTour: a tab's tour, whichever kind it has. A Merc tour is named in
// coachActive from the ask, so an offer due while it loads waits for it; one
// ended, unwanted or asked for again while it loads never shows; a chunk that
// does not arrive lets go. A tab without one gets its legacy spotlight tour,
// and a tab with neither gets nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coachActive, setCoachActive } from '@/lib/coach-state'
import type { CoachTour } from './coach/types'

const fakes = vi.hoisted(() => ({
  hasPageTour: vi.fn((_tab: string) => false),
  startPageTour: vi.fn(),
  startCoachTour: vi.fn(),
}))
vi.mock('@/stores', () => ({
  hasPageTour: (tab: string) => fakes.hasPageTour(tab),
  startPageTour: (tab: string) => fakes.startPageTour(tab),
}))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => true }))
vi.mock('./coach/start', () => ({ startCoachTour: fakes.startCoachTour }))
const registry = vi.hoisted(() => ({
  COACH_TOURS: {} as Record<string, unknown>,
}))
vi.mock('./coach-tours', () => registry)

import { startRoomTour } from './room-tour'

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
  registry.COACH_TOURS = {}
  setCoachActive(null)
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
    expect(fakes.startPageTour).not.toHaveBeenCalled()
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

  it("starts a tab's legacy spotlight tour where it has no Merc tour", () => {
    fakes.hasPageTour.mockReturnValue(true)

    expect(startRoomTour('guitar')).toBe(true)

    expect(fakes.startPageTour).toHaveBeenCalledExactlyOnceWith('guitar')
    expect(coachActive()).toBeNull()
  })

  it('starts nothing, and says so, for a tab with neither', () => {
    expect(startRoomTour('settings')).toBe(false)

    expect(fakes.startPageTour).not.toHaveBeenCalled()
    expect(fakes.startCoachTour).not.toHaveBeenCalled()
  })
})
