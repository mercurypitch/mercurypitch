// ============================================================
// Plan credits — what the plan says about credits, rule by rule
// ============================================================
//
// planCreditsLine is handed what its host has already found out (can this
// build take payment, is the person signed in, is a launch gift on offer, how
// many credits do they hold, what does the cheapest pack cost) and answers
// with one line or none. The first rule that fits wins, in spec 5.3's order,
// so each case changes only what its rule reads, and the rules around it are
// held to what they say too: a signed-in singer is never shown the gift, and
// an unknown balance is never taken for an empty one. Each line carries its
// kind (a gift, a balance, a first pack) as well as its words, because the
// screen dresses the gift differently from the other two.

import { describe, expect, it } from 'vitest'
import { formatPrice } from '@/db/services/billing-service'
import { GIFT_ARRIVES, giftTitle } from '@/lib/launch-gift-copy'
import type { CreditsInput } from './plan-credits'
import { planCreditsLine } from './plan-credits'

/** What one credit buys, which both signed-in lines say under their title. */
const WHAT_A_CREDIT_BUYS =
  'One credit splits a song of up to 12 minutes into voice and band.'

const PACK = { amount: 499, currency: 'eur' }

/** A new visitor on the web: no account, a gift on offer, no pack looked up. */
const VISITOR: CreditsInput = {
  canTakePayment: true,
  signedIn: false,
  gift: { credits: 5 },
  balance: null,
  cheapestPack: null,
}

/** A signed-in singer on the web with `balance` credits (null: not known yet). */
const singer = (
  balance: number | null,
  rest: Partial<CreditsInput> = {},
): CreditsInput => ({
  canTakePayment: true,
  signedIn: true,
  gift: null,
  balance,
  cheapestPack: PACK,
  ...rest,
})

describe('the store build', () => {
  it('says nothing about credits on the store build', () => {
    const everyone: CreditsInput[] = [
      VISITOR,
      singer(12),
      singer(0),
      singer(0, { gift: { credits: 5 } }),
    ]

    for (const person of everyone) {
      expect(planCreditsLine({ ...person, canTakePayment: false })).toBeNull()
    }
  })
})

describe('a new visitor', () => {
  it('shows the launch gift to a new visitor', () => {
    expect(planCreditsLine(VISITOR)).toEqual({
      kind: 'gift',
      title: giftTitle(5),
      sub: GIFT_ARRIVES,
    })
  })

  it("counts the gift in the server's number, one credit included", () => {
    expect(planCreditsLine({ ...VISITOR, gift: { credits: 1 } })?.title).toBe(
      giftTitle(1),
    )
    expect(planCreditsLine({ ...VISITOR, gift: { credits: 8 } })?.title).toBe(
      giftTitle(8),
    )
  })

  it('says nothing when no gift is on offer', () => {
    expect(planCreditsLine({ ...VISITOR, gift: null })).toBeNull()
    expect(
      planCreditsLine({ ...VISITOR, gift: null, cheapestPack: PACK }),
    ).toBeNull()
  })

  it('does not offer a gift with nothing in it', () => {
    expect(planCreditsLine({ ...VISITOR, gift: { credits: 0 } })).toBeNull()
  })
})

describe('a signed-in singer', () => {
  // The number and the word are joined by a non-breaking space (U+00A0, as
  // creditCount writes them everywhere in the app), so the title never wraps
  // between them. It looks like a plain space, so it is written as an escape.
  it('shows a signed-in singer their balance', () => {
    expect(planCreditsLine(singer(12))).toEqual({
      kind: 'balance',
      title: 'You have 12\u00a0credits',
      sub: WHAT_A_CREDIT_BUYS,
    })
    // One credit is not "1 credits".
    expect(planCreditsLine(singer(1))).toEqual({
      kind: 'balance',
      title: 'You have 1\u00a0credit',
      sub: WHAT_A_CREDIT_BUYS,
    })
  })

  it('joins the number and the word in a balance with a non-breaking space', () => {
    const title = planCreditsLine(singer(12))?.title ?? ''

    expect(title).not.toBe('You have 12 credits')
    expect(title.replaceAll('\u00a0', ' ')).toBe('You have 12 credits')
  })

  it('names the cheapest pack when the balance is empty', () => {
    expect(planCreditsLine(singer(0))).toEqual({
      kind: 'price',
      title: `Credits from ${formatPrice(499, 'eur')}`,
      sub: WHAT_A_CREDIT_BUYS,
    })
  })

  it('prefers the balance to the pack when there is both', () => {
    expect(planCreditsLine(singer(3))?.title).toBe('You have 3\u00a0credits')
  })

  it('is never shown the gift, even while one is on offer', () => {
    const line = planCreditsLine(singer(0, { gift: { credits: 5 } }))

    expect(line?.kind).toBe('price')
    expect(line?.title).toBe(`Credits from ${formatPrice(499, 'eur')}`)
    expect(
      planCreditsLine(singer(0, { gift: { credits: 5 }, cheapestPack: null })),
    ).toBeNull()
  })

  it('says nothing while the balance is not known', () => {
    expect(planCreditsLine(singer(null))).toBeNull()
  })

  it('says nothing when an empty balance has no pack to name', () => {
    expect(planCreditsLine(singer(0, { cheapestPack: null }))).toBeNull()
  })

  it('does not name a pack that costs nothing', () => {
    expect(
      planCreditsLine(singer(0, { cheapestPack: { ...PACK, amount: 0 } })),
    ).toBeNull()
  })
})
