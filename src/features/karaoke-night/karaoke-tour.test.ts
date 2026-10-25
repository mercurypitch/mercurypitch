// ============================================================
// Karaoke Night's Merc tour: from the demo song to your own
// ============================================================
//
// Three stops wait for the singer: the demo on stage, a sung note, the score.
// The last says where your own song goes and, under it, the credits line the
// plan's Karaoke Night card says (planCreditsLine), worked out from what this
// page knows. The runner drops the other screen's steps, so each screen is
// read through it, as the layer reads the tour.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planCreditsLine } from '@/components/billing/plan-credits'
import type { CoachRunner } from '@/components/coach/runner'
import { CELEBRATE_MS, createCoachRunner } from '@/components/coach/runner'
import type { CoachEventName } from '@/lib/coach-events'
import type { CoachStep, CoachTour } from '@/lib/coach-types'
import { GIFT_ARRIVES, giftTitle } from '@/lib/launch-gift-copy'
import type * as NativeBuild from '@/lib/native-build'
import type * as KaraokeTourModule from './karaoke-tour'

const build = vi.hoisted(() => ({ payment: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get CAN_TAKE_PAYMENT() {
    return build.payment
  },
}))

// The standalone account, as signals the test can set.
vi.mock('@/lib/standalone-account', async () => {
  const { createSignal } = await import('solid-js')
  const [signedIn, setSignedIn] = createSignal(false)
  const [credits, setCredits] = createSignal<number | null>(null)
  return { signedIn, credits, setSignedIn, setCredits }
})

const promo = vi.hoisted(() => ({
  offered: null as { credits: number } | null,
  load: vi.fn(async () => undefined),
}))
vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => promo.offered,
  loadFeaturedPromo: promo.load,
}))

const facts = vi.hoisted(() => ({ cheapestPack: vi.fn() }))
vi.mock('@/lib/credit-facts', () => ({ cheapestPack: facts.cheapestPack }))

import * as standaloneAccount from '@/lib/standalone-account'

interface AccountMock {
  setSignedIn: (on: boolean) => void
  setCredits: (balance: number | null) => void
}

/** The mocked account. vi.resetModules() keeps a mock's module, so it is one. */
const signedOut = (): void => {
  const account = standaloneAccount as unknown as AccountMock
  account.setSignedIn(false)
  account.setCredits(null)
}

/**
 * The tour and the account it reads, fresh: the credits line keeps what it
 * fetched for the life of the page, so each test starts a page of its own.
 */
async function fresh(): Promise<{
  tour: typeof KaraokeTourModule
  account: AccountMock
}> {
  vi.resetModules()
  const tour = await import('./karaoke-tour')
  const account =
    (await import('@/lib/standalone-account')) as unknown as AccountMock
  return { tour, account }
}

const SCREENS = [
  { name: 'phone', phone: true },
  { name: 'desktop', phone: false },
] as const

/** A runner for one screen, with the events a test fires by hand. */
function runnerFor(
  tour: CoachTour,
  phone: boolean,
): { runner: CoachRunner; fire: (name: CoachEventName) => void } {
  const heard = new Map<CoachEventName, () => void>()
  const runner = createCoachRunner(tour, {
    phone,
    track: vi.fn(),
    on: (name, fn) => {
      heard.set(name, fn)
      return () => heard.delete(name)
    },
  })
  return { runner, fire: (name) => heard.get(name)?.() }
}

/** The steps one screen shows, in order. */
function stepsFor(tour: CoachTour, phone: boolean): CoachStep[] {
  const { runner } = runnerFor(tour, phone)
  const steps: CoachStep[] = []
  for (let at = runner.snapshot(); at !== null; at = runner.snapshot()) {
    steps.push(at.step)
    if (at.step.kind === 'do') runner.skip()
    else runner.next()
  }
  runner.dispose()
  return steps
}

const lastStep = (tour: CoachTour, phone: boolean): CoachStep => {
  const step = stepsFor(tour, phone).at(-1)
  if (step === undefined) throw new Error('the tour has no steps')
  return step
}

beforeEach(() => {
  signedOut()
  build.payment = true
  promo.offered = null
  promo.load.mockClear()
  facts.cheapestPack.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KARAOKE_TOUR', () => {
  it.each(SCREENS)(
    'waits for the demo to be staged, then for a sung note, then for the score, on a $name',
    async ({ phone }) => {
      vi.useFakeTimers()
      const { tour } = await fresh()
      const { runner, fire } = runnerFor(tour.KARAOKE_TOUR, phone)
      const at = () => runner.snapshot()?.step.id

      // A note sung before any song is on stage moves nothing.
      fire('pitch-detected')
      runner.next()
      expect(at()).toBe('demo')

      fire('song-staged')
      vi.advanceTimersByTime(CELEBRATE_MS)
      expect(at()).toBe('mic')
      runner.next()
      expect(at()).toBe('mic')

      fire('pitch-detected')
      vi.advanceTimersByTime(CELEBRATE_MS)
      expect(at()).toBe('score')

      fire('score-shown')
      vi.advanceTimersByTime(CELEBRATE_MS)
      expect(at()).toBe('own-song')
      runner.next()
      expect(runner.ended()).toBe('done')
    },
  )

  it.each(SCREENS)(
    'keeps to four stops, the first three waiting for the singer, on a $name',
    async ({ phone }) => {
      const { tour } = await fresh()
      const steps = stepsFor(tour.KARAOKE_TOUR, phone)

      expect(steps.map((step) => step.id)).toEqual([
        'demo',
        'mic',
        'score',
        'own-song',
      ])
      expect(steps.map((step) => step.waitFor)).toEqual([
        'song-staged',
        'pitch-detected',
        'score-shown',
        undefined,
      ])
      expect(tour.KARAOKE_TOUR.key).toBe('karaoke-night')
    },
  )

  it('points at the demo, then at whichever mic the screen draws (R20)', async () => {
    const { tour } = await fresh()
    for (const { phone } of SCREENS) {
      const [demo, mic, score] = stepsFor(tour.KARAOKE_TOUR, phone)
      expect(demo?.target).toBe('[data-tour="karaoke.demo"]')
      // The phone stage's own hook, and the desktop mixer's legacy one,
      // which the mixer's old tour still names.
      expect(mic?.target).toContain('[data-tour="karaoke.mic"]')
      expect(mic?.target).toContain('[data-tour="mixer.mic"]')
      // Singing to the end needs the whole stage: nothing to ring.
      expect(score?.target).toBeUndefined()
    }
  })

  it('rings Add a song on a wide screen, and nothing over the phone stage', async () => {
    const { tour } = await fresh()

    expect(lastStep(tour.KARAOKE_TOUR, false).target).toBe(
      '[data-tour="karaoke.own-song"]',
    )
    // The phone stage covers the page when the score shows.
    expect(lastStep(tour.KARAOKE_TOUR, true).target).toBeUndefined()
  })

  it('says it plainly, with no em dash', async () => {
    const { tour } = await fresh()
    for (const step of tour.KARAOKE_TOUR.steps) {
      expect(`${step.title} ${step.body}`).not.toMatch(/—/)
    }
  })
})

describe('the credits line at the last stop', () => {
  it.each(SCREENS)(
    'ends on the credits line for a new visitor, on a $name',
    async ({ phone }) => {
      promo.offered = { credits: 5 }
      const { tour } = await fresh()

      expect(lastStep(tour.KARAOKE_TOUR, phone).aside?.()).toEqual({
        title: giftTitle(5),
        sub: GIFT_ARRIVES,
      })
    },
  )

  it('says nothing about credits on the store build', async () => {
    build.payment = false
    promo.offered = { credits: 5 }
    const { tour, account } = await fresh()
    account.setSignedIn(true)
    account.setCredits(3)

    for (const { phone } of SCREENS) {
      expect(lastStep(tour.KARAOKE_TOUR, phone).aside?.()).toBeNull()
    }
  })

  it("states a signed-in singer's balance, as the plan's card does", async () => {
    const { tour, account } = await fresh()
    account.setSignedIn(true)
    account.setCredits(3)

    const line = planCreditsLine({
      canTakePayment: true,
      signedIn: true,
      gift: null,
      balance: 3,
      cheapestPack: null,
    })
    expect(line?.kind).toBe('balance')
    expect(lastStep(tour.KARAOKE_TOUR, false).aside?.()).toEqual({
      title: line?.title,
      sub: line?.sub,
    })
  })

  it('says nothing while a balance is not known, nor for a balance of none with no price yet', async () => {
    const { tour, account } = await fresh()
    account.setSignedIn(true)

    expect(lastStep(tour.KARAOKE_TOUR, false).aside?.()).toBeNull()
    account.setCredits(0)
    expect(lastStep(tour.KARAOKE_TOUR, false).aside?.()).toBeNull()
  })
})

describe('loadKaraokeCredits', () => {
  it('asks for the gift, and for a price only once the balance reads none', async () => {
    const pack = { amount: 500, currency: 'EUR' }
    facts.cheapestPack.mockResolvedValue(pack)
    const { tour, account } = await fresh()

    tour.loadKaraokeCredits()
    expect(promo.load).toHaveBeenCalledTimes(1)
    expect(facts.cheapestPack).not.toHaveBeenCalled()

    account.setSignedIn(true)
    account.setCredits(2)
    expect(facts.cheapestPack).not.toHaveBeenCalled()

    account.setCredits(0)
    await vi.waitFor(() => expect(facts.cheapestPack).toHaveBeenCalledTimes(1))
    const line = planCreditsLine({
      canTakePayment: true,
      signedIn: true,
      gift: null,
      balance: 0,
      cheapestPack: pack,
    })
    expect(line?.kind).toBe('price')
    await vi.waitFor(() =>
      expect(lastStep(tour.KARAOKE_TOUR, false).aside?.()).toEqual({
        title: line?.title,
        sub: line?.sub,
      }),
    )

    // Once per page: a second tour asks for nothing again.
    tour.loadKaraokeCredits()
    account.setCredits(1)
    account.setCredits(0)
    expect(promo.load).toHaveBeenCalledTimes(1)
    expect(facts.cheapestPack).toHaveBeenCalledTimes(1)
  })

  it('asks for nothing on the store build', async () => {
    build.payment = false
    const { tour, account } = await fresh()

    tour.loadKaraokeCredits()
    account.setSignedIn(true)
    account.setCredits(0)

    expect(promo.load).not.toHaveBeenCalled()
    expect(facts.cheapestPack).not.toHaveBeenCalled()
  })
})
