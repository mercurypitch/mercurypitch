import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchOffer } from '@/db/services/billing-service'
import type * as LaunchOfferModule from './launch-offer'

const mocks = vi.hoisted(() => ({
  accountId: 'user-1' as string | null,
  trackEvent: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  currentAccountId: () => mocks.accountId,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))

const SEEN_KEY = 'mp.launchOffer.rewardSeen.v1'
const PACKS_KEY = 'mp.launchOffer.showPacks.v1'

/** A fresh copy of the module: its once-a-session flag starts unset. */
async function load(): Promise<typeof LaunchOfferModule> {
  vi.resetModules()
  return import('./launch-offer')
}

function offer(overrides: Partial<LaunchOffer> = {}): LaunchOffer {
  return {
    state: 'counting',
    used: 2,
    goal: 5,
    deadline: '2026-10-23T23:59:59.999Z',
    bonusCredits: 30,
    ...overrides,
  }
}

beforeEach(() => {
  mocks.accountId = 'user-1'
  mocks.trackEvent.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

describe('offerDay', () => {
  it('names the window’s last day in UTC, wherever the browser is', async () => {
    const { offerDay } = await load()
    // The window's real end: a browser east of UTC is already on the 24th.
    expect(offerDay('2026-10-23T23:59:59.999Z')).toBe('23 October')
    // Its first moment: a browser west of UTC is still on the 22nd.
    expect(offerDay('2026-10-23T00:00:00.000Z')).toBe('23 October')
  })
})

describe('the offer’s words', () => {
  it('says what to do, by when, and what it earns while counting', async () => {
    const { offerProgressLine } = await load()
    expect(offerProgressLine(offer())).toBe(
      'Use all 5 by 23 October and your next pack comes with 30 extra credits.',
    )
    expect(
      offerProgressLine(
        offer({ goal: 3, bonusCredits: 12, deadline: '2026-11-02T23:59:59Z' }),
      ),
    ).toBe(
      'Use all 3 by 2 November and your next pack comes with 12 extra credits.',
    )
  })

  it('names no end for the reward once it is earned', async () => {
    const { offerRewardLine } = await load()
    const line = offerRewardLine(offer({ state: 'unlocked', used: 5 }))
    expect(line).toBe('Your next pack comes with 30 extra credits.')
    expect(line).not.toMatch(/October|until|by /)
  })
})

describe('offerToShow', () => {
  it('shows a counting or an earned offer', async () => {
    const { offerToShow } = await load()
    const counting = offer()
    const unlocked = offer({ state: 'unlocked', used: 5 })
    expect(offerToShow(counting)).toBe(counting)
    expect(offerToShow(unlocked)).toBe(unlocked)
  })

  it('says nothing of a used or lapsed offer, or of none', async () => {
    const { offerToShow } = await load()
    expect(offerToShow(offer({ state: 'used', used: 5 }))).toBeNull()
    expect(offerToShow(offer({ state: 'lapsed', used: 3 }))).toBeNull()
    expect(offerToShow(null)).toBeNull()
    expect(offerToShow(undefined)).toBeNull()
  })
})

describe('countProgressView', () => {
  it('counts the progress as seen once a page session', async () => {
    const { countProgressView } = await load()
    countProgressView()
    countProgressView()
    countProgressView()
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
    expect(mocks.trackEvent).toHaveBeenCalledWith('offer_progress_view')
  })

  it('counts it again on the next page', async () => {
    ;(await load()).countProgressView()
    ;(await load()).countProgressView()
    expect(mocks.trackEvent).toHaveBeenCalledTimes(2)
  })
})

describe('the reward sheet, once per account', () => {
  it('is unseen until it opens for the account signed in here', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    expect(rewardSheetSeen()).toBe(false)
    markRewardSheetSeen()
    expect(rewardSheetSeen()).toBe(true)
  })

  it('opens again for another account in the same browser', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    markRewardSheetSeen()
    mocks.accountId = 'user-2'
    expect(rewardSheetSeen()).toBe(false)
    markRewardSheetSeen()
    mocks.accountId = 'user-1'
    expect(rewardSheetSeen()).toBe(true)
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')).toEqual([
      'user-1',
      'user-2',
    ])
  })

  it('remembers nothing while nobody is signed in', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    mocks.accountId = null
    markRewardSheetSeen()
    expect(localStorage.getItem(SEEN_KEY)).toBeNull()
    expect(rewardSheetSeen()).toBe(false)
  })

  it('keeps the last twenty accounts, the newest last', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    for (let i = 1; i <= 22; i++) {
      mocks.accountId = `user-${i}`
      markRewardSheetSeen()
    }
    // Seen again: moves to the end rather than appearing twice.
    mocks.accountId = 'user-5'
    markRewardSheetSeen()
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
    expect(seen).toHaveLength(20)
    expect(seen.at(-1)).toBe('user-5')
    expect(seen.filter((id) => id === 'user-5')).toHaveLength(1)
    mocks.accountId = 'user-1'
    expect(rewardSheetSeen()).toBe(false)
    mocks.accountId = 'user-22'
    expect(rewardSheetSeen()).toBe(true)
  })

  it('reads a damaged entry as nothing seen', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    localStorage.setItem(SEEN_KEY, '{not json')
    expect(rewardSheetSeen()).toBe(false)
    localStorage.setItem(SEEN_KEY, JSON.stringify({ 'user-1': true }))
    expect(rewardSheetSeen()).toBe(false)
    localStorage.setItem(SEEN_KEY, JSON.stringify([42, 'user-1']))
    expect(rewardSheetSeen()).toBe(true)
    markRewardSheetSeen()
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')).toEqual([
      'user-1',
    ])
  })

  it('carries on when storage is blocked', async () => {
    const { markRewardSheetSeen, rewardSheetSeen } = await load()
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      expect(rewardSheetSeen()).toBe(false)
      expect(() => markRewardSheetSeen()).not.toThrow()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

describe('"See the packs", asked once', () => {
  it('asks for the packs until they are shown', async () => {
    const { askForPacks, packsAsked, packsShown } = await load()
    expect(packsAsked()).toBe(false)
    askForPacks()
    expect(packsAsked()).toBe(true)
    expect(sessionStorage.getItem(PACKS_KEY)).toBe('1')
    packsShown()
    expect(packsAsked()).toBe(false)
    expect(sessionStorage.getItem(PACKS_KEY)).toBeNull()
  })

  it('carries the ask to the next page in this tab', async () => {
    ;(await load()).askForPacks()
    // Karaoke Night hands over to the app: a new page, a fresh module.
    const next = await load()
    expect(next.packsAsked()).toBe(true)
    next.packsShown()
    expect((await load()).packsAsked()).toBe(false)
  })

  it('still asks on this page when storage is blocked', async () => {
    const { askForPacks, packsAsked, packsShown } = await load()
    const setItem = vi
      .spyOn(sessionStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const removeItem = vi
      .spyOn(sessionStorage, 'removeItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      expect(() => askForPacks()).not.toThrow()
      expect(packsAsked()).toBe(true)
      expect(() => packsShown()).not.toThrow()
      expect(packsAsked()).toBe(false)
    } finally {
      setItem.mockRestore()
      removeItem.mockRestore()
    }
  })

  it('reads a blocked storage as no ask', async () => {
    const getItem = vi
      .spyOn(sessionStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      expect((await load()).packsAsked()).toBe(false)
    } finally {
      getItem.mockRestore()
    }
  })
})
