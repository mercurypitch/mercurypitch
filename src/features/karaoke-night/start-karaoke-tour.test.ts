// ============================================================
// startKaraokeTour — the consent bar first, then Merc's tour
// ============================================================
//
// The e2e build mounts no consent banner, so the bar's hold is pinned here
// (R22): an ad's tour (`?tour=first`) waits until the real bar is answered,
// and a tap on the chip, which is the visitor asking, starts at once under
// it. Either way the start asks for what the credits line needs, takes the
// phone's steps wherever the page draws the phone stage, and spends the
// first-visit offer once the coach's tour has started: a coach that did not
// load leaves it for the next visit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ViewportModule from '@/lib/use-viewport'

vi.mock('@/lib/consent', async () => {
  const { createSignal } = await import('solid-js')
  const [open, setOpen] = createSignal(false)
  return { isConsentBannerOpen: open, setOpen }
})

const coach = vi.hoisted(() => ({ start: vi.fn() }))
vi.mock('@/components/coach/start', () => ({
  startCoachTour: coach.start,
}))

const tour = vi.hoisted(() => ({
  KARAOKE_TOUR: { key: 'karaoke-night', steps: [] },
  loadKaraokeCredits: vi.fn(),
}))
vi.mock('./karaoke-tour', () => tour)

const viewport = vi.hoisted(() => ({ phoneStage: false }))
vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof ViewportModule>()),
  isPhoneStage: () => viewport.phoneStage,
}))

import * as consent from '@/lib/consent'
import { KARAOKE_TOUR_OFFER_KEY } from './karaoke-tour-offer'
import { consentAnswered, startKaraokeTour } from './start-karaoke-tour'

const bar = consent as unknown as { setOpen: (open: boolean) => void }

/** Lets every pending promise callback run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

beforeEach(() => {
  bar.setOpen(false)
  viewport.phoneStage = false
  coach.start.mockClear()
  tour.loadKaraokeCredits.mockClear()
})

afterEach(() => {
  localStorage.clear()
})

describe('startKaraokeTour', () => {
  it("holds an ad's tour while the consent bar is open, and starts it once answered", async () => {
    bar.setOpen(true)

    const started = startKaraokeTour({ afterConsent: true })
    await settle()
    expect(coach.start).not.toHaveBeenCalled()
    // Nothing is spent on a tour that has not shown.
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBeNull()

    bar.setOpen(false)
    await started
    expect(coach.start).toHaveBeenCalledTimes(1)
    expect(coach.start).toHaveBeenCalledWith(tour.KARAOKE_TOUR, {
      phone: false,
    })
  })

  it("starts an ad's tour at once where no bar is open", async () => {
    await startKaraokeTour({ afterConsent: true })

    expect(coach.start).toHaveBeenCalledTimes(1)
  })

  it('starts a tour the chip asked for at once, under an open bar', async () => {
    bar.setOpen(true)

    await startKaraokeTour({ afterConsent: false })

    expect(coach.start).toHaveBeenCalledTimes(1)
  })

  it('spends the first-visit offer and asks for the credits line', async () => {
    await startKaraokeTour({ afterConsent: false })

    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBe('true')
    expect(tour.loadKaraokeCredits).toHaveBeenCalledTimes(1)
  })

  it('spends the offer only once the coach tour has started', async () => {
    let started!: () => void
    coach.start.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        started = resolve
      }),
    )

    const done = startKaraokeTour({ afterConsent: false })
    await settle()
    expect(coach.start).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBeNull()

    started()
    await done
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBe('true')
  })

  it('leaves the offer when the coach does not load, and says so', async () => {
    coach.start.mockRejectedValueOnce(new Error('chunk'))

    await expect(startKaraokeTour({ afterConsent: false })).rejects.toThrow(
      'chunk',
    )
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBeNull()
  })

  it("takes the phone's steps wherever the page draws the phone stage", async () => {
    viewport.phoneStage = true

    await startKaraokeTour({ afterConsent: false })

    expect(coach.start).toHaveBeenCalledWith(tour.KARAOKE_TOUR, {
      phone: true,
    })
  })
})

describe('consentAnswered', () => {
  it('settles at once when the bar is not open', async () => {
    await expect(consentAnswered()).resolves.toBeUndefined()
  })

  it('waits through the bar, and settles once for good', async () => {
    bar.setOpen(true)
    let settled = 0
    void consentAnswered().then(() => {
      settled += 1
    })
    await settle()
    expect(settled).toBe(0)

    bar.setOpen(false)
    await settle()
    expect(settled).toBe(1)

    // Opened again later (Cookie settings), it is not asked again.
    bar.setOpen(true)
    bar.setOpen(false)
    await settle()
    expect(settled).toBe(1)
  })
})
