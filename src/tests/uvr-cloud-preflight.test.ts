// Whether a cloud split can run at all, decided before a button promises it.
//
// The bug these pin: Guitar Night's "Separate guitar" ran no prerequisite
// check, so pressing it with no account started a split that uploaded a
// ~60-190 MB instrumental into a 401. `fetch` cannot report upload
// progress, so the room sat on "Sending the instrumental · 0%" with
// nothing coming and no error — the phase only advances when the request
// resolves.
//
// Two properties matter here and pull in opposite directions: a blocker
// must fire when we KNOW the job cannot run, and must NOT fire when we
// merely do not know. The second is the one worth testing hardest, because
// getting it wrong turns away paying users.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloudSplitBlocker, cloudSplitBlockerHeading, splitCostFor, } from '@/lib/uvr-cloud-preflight'

describe('cloudSplitBlocker', () => {
  it('lets a signed-in account with credits through', () => {
    expect(
      cloudSplitBlocker({ signedIn: true, balance: 10, cost: 3 }),
    ).toBeNull()
  })

  it('blocks a signed-out singer and sends them to Account', () => {
    const blocker = cloudSplitBlocker({ signedIn: false })
    expect(blocker?.reason).toBe('signed-out')
    expect(blocker?.cta).toEqual({ label: 'Sign in', section: 'account' })
  })

  it('blocks an empty balance even when the price is unknown', () => {
    // The case that reached a user: signed in, no credits, no pricing
    // loaded. A paid job cannot run on zero, so "we do not know the price"
    // is not a reason to start one.
    const blocker = cloudSplitBlocker({ signedIn: true, balance: 0 })
    expect(blocker?.reason).toBe('insufficient-credits')
    expect(blocker?.cta).toEqual({ label: 'Get credits', section: 'credits' })
  })

  it('quotes the real numbers when both are known', () => {
    const blocker = cloudSplitBlocker({ signedIn: true, balance: 2, cost: 5 })
    expect(blocker?.reason).toBe('insufficient-credits')
    expect(blocker?.message).toContain('5 credits')
    expect(blocker?.message).toContain('you have 2')
  })

  it('says "1 credit", not "1 credits"', () => {
    expect(
      cloudSplitBlocker({ signedIn: true, balance: 0, cost: 1 })?.message,
    ).toContain('1 credit and')
  })

  it('blocks a song with no stored instrumental, with nothing to go and do', () => {
    const blocker = cloudSplitBlocker({
      signedIn: true,
      balance: 100,
      hasInstrumental: false,
    })
    expect(blocker?.reason).toBe('no-instrumental')
    expect(blocker?.cta).toBeNull()
  })

  it('checks the account before the balance', () => {
    // Telling a signed-out person to buy credits is the wrong first step.
    expect(cloudSplitBlocker({ signedIn: false, balance: 0 })?.reason).toBe(
      'signed-out',
    )
  })

  describe('never refuses from data it does not have', () => {
    it('allows an unknown balance', () => {
      // Billing unreachable. The server is the authority on affordability
      // and answers 402 with the real quote; guessing "no" here would
      // block a job the account could pay for.
      expect(cloudSplitBlocker({ signedIn: true })).toBeNull()
      expect(cloudSplitBlocker({ signedIn: true, cost: 5 })).toBeNull()
    })

    it('allows a funded balance with an unknown price', () => {
      expect(cloudSplitBlocker({ signedIn: true, balance: 3 })).toBeNull()
    })

    it('allows an unknown instrumental', () => {
      // Absent is checked again inside runStemSplit, which has the real
      // answer. `undefined` here means nobody looked.
      expect(cloudSplitBlocker({ signedIn: true, balance: 9 })).toBeNull()
    })

    it('ignores a nonsense balance or price rather than blocking on it', () => {
      expect(
        cloudSplitBlocker({ signedIn: true, balance: Number.NaN, cost: 5 }),
      ).toBeNull()
      expect(
        cloudSplitBlocker({ signedIn: true, balance: 1, cost: Number.NaN }),
      ).toBeNull()
    })

    it('treats a zero or negative price as unknown, not as free', () => {
      // A zero price means pricing did not load, not that the GPU is free.
      // Falling back to a floor of one credit is what catches an empty
      // balance; a funded one is left to the server.
      expect(
        cloudSplitBlocker({ signedIn: true, balance: 4, cost: 0 }),
      ).toBeNull()
      expect(
        cloudSplitBlocker({ signedIn: true, balance: 0, cost: 0 })?.reason,
      ).toBe('insufficient-credits')
    })
  })
})

describe('cloudSplitBlockerHeading', () => {
  it('names the situation rather than a failure', () => {
    // Nothing was attempted and nothing broke, so "Couldn't build the full
    // band" would be a lie.
    const heading = (facts: Parameters<typeof cloudSplitBlocker>[0]) =>
      cloudSplitBlockerHeading(cloudSplitBlocker(facts)!)

    expect(heading({ signedIn: false })).toBe(
      'Separating the band needs an account',
    )
    expect(heading({ signedIn: true, balance: 0 })).toBe(
      'Separating the band needs credits',
    )
    expect(heading({ signedIn: true, hasInstrumental: false })).toBe(
      'There is no instrumental to separate',
    )
  })
})

describe('splitCostFor', () => {
  it('reads the price of the model that decides it', () => {
    expect(splitCostFor({ 'demucs-6s': 4, roformer: 2 }, 'demucs-6s')).toBe(4)
  })

  it('says nothing rather than zero when pricing has not loaded', () => {
    expect(splitCostFor(undefined, 'demucs-6s')).toBeUndefined()
    expect(splitCostFor({}, 'demucs-6s')).toBeUndefined()
    // A zero from the server is not a free GPU; it is a missing price.
    expect(splitCostFor({ 'demucs-6s': 0 }, 'demucs-6s')).toBeUndefined()
  })
})

describe('cloudSplitBlocker in a build that cannot take payment', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/native-build')
    vi.resetModules()
  })

  /** The module re-imported with the build constant forced: it is read at
   *  module evaluation, so a test cannot flip it after the fact. */
  async function guarded(): Promise<typeof cloudSplitBlocker> {
    vi.resetModules()
    vi.doMock('@/lib/native-build', () => ({
      IS_NATIVE_BUILD: true,
      CAN_TAKE_PAYMENT: false,
    }))
    return (await import('@/lib/uvr-cloud-preflight')).cloudSplitBlocker
  }

  it('quotes the shortfall but offers no errand', async () => {
    const blocker = (await guarded())({ signedIn: true, balance: 0, cost: 3 })

    expect(blocker?.reason).toBe('insufficient-credits')
    // The numbers are still said in full. What is gone is the instruction to
    // go and buy, which guideline 3.1.1 reads as a call to action for a
    // purchasing mechanism other than in-app purchase.
    expect(blocker?.message).toContain('3 credits')
    expect(blocker?.message).toContain('you have 0')
    expect(blocker?.message).not.toMatch(/add credits/i)
    expect(blocker?.cta).toBeNull()
  })

  it('still sends a signed-out singer to sign in', async () => {
    // Signing in is not a purchase, and the account is what holds whatever
    // balance there already is.
    expect((await guarded())({ signedIn: false })?.cta).toEqual({
      label: 'Sign in',
      section: 'account',
    })
  })
})
