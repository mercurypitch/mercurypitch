// ============================================================
// The launch gift's words, one credit and many
// ============================================================

import { describe, expect, it } from 'vitest'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { giftCount, giftOfferLine, offerDay } from './launch-gift-copy'

describe('credits named as song separations', () => {
  it('says one separation, without "up to", for a single credit', () => {
    expect(giftCount(1)).toBe('1 free song separation')
  })

  it('keeps "up to" and the plural for more than one', () => {
    // A credit splits one song of up to 12 minutes; a longer song or a full
    // band split costs more, so a count of credits is at most that many songs.
    expect(giftCount(5)).toBe('up to 5 free song separations')
  })
})

describe('the offer line under the gift', () => {
  const NOW = Date.parse('2026-10-14T12:00:00.000Z')
  const promo = (offer?: FeaturedPromo['offer']): FeaturedPromo => ({
    code: 'LAUNCH',
    credits: 5,
    expiresAt: '2027-01-01T23:59:59.000Z',
    ...(offer === undefined ? {} : { offer }),
  })
  const LIVE = {
    goal: 5,
    deadline: '2026-10-28T23:59:59.999Z',
    bonusCredits: 30,
  }

  it('says what using the gift earns while the offer is live', () => {
    expect(giftOfferLine(promo(LIVE), NOW)).toBe(
      'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.',
    )
  })

  it('takes the count, the day and the bonus from the server', () => {
    expect(
      giftOfferLine(
        promo({
          goal: 3,
          deadline: '2026-11-02T23:59:59.999Z',
          bonusCredits: 12,
        }),
        NOW,
      ),
    ).toBe(
      'Use all 3 by 2 November and your next credit pack comes with 12 extra credits.',
    )
  })

  it('names the day the way the progress line does, in UTC', () => {
    // offerDay is the progress line's own formatter (launch-offer.ts
    // re-exports it), so the two can never name the day differently.
    expect(giftOfferLine(promo(LIVE), NOW)).toContain(
      `by ${offerDay(LIVE.deadline)} `,
    )
    expect(offerDay('2026-10-28T23:59:59.999Z')).toBe('28 October')
  })

  it('says nothing when the server features no offer', () => {
    expect(giftOfferLine(promo(null), NOW)).toBeNull()
    // An older worker says nothing of an offer at all.
    expect(giftOfferLine(promo(), NOW)).toBeNull()
  })

  it('says nothing once the deadline has passed', () => {
    const end = Date.parse(LIVE.deadline)
    expect(giftOfferLine(promo(LIVE), end)).not.toBeNull()
    expect(giftOfferLine(promo(LIVE), end + 1)).toBeNull()
  })
})
