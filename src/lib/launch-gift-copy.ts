// ============================================================
// Launch gift copy — how every surface names the free credits
// ============================================================
//
// One gift, named in the same words wherever it is offered, so they live
// here once and a swap is a one-line change. Read by:
//   - onboarding's Keep card, Keep caption and Map lines (re-exported
//     through src/features/onboarding/copy.ts);
//   - the Voice Mirror's account ask (MirrorAccountAsk);
//   - Karaoke Night's signed-out gift line (KaraokeGiftLine);
//   - the promo card in Settings > Credits, for a reader who is signed out
//     (PromoCodeCard; signed in, it counts credits instead);
//   - the header's Promo pill title (HeaderAccount);
//   - the password sign-up toast (launch-gift-store's signUpGiftMessage).
// The offer line under the gift (giftOfferLine) is read by the same
// surfaces, except the header pill, whose title has no room for it.
// The owner rejected "free Karaoke Night credits": the gift is named by what
// it buys, a song split into voice and band. The count is always the
// server's (promo-store), never a number written into the copy.

import type { FeaturedPromo, GiftOfferTerms, } from '@/db/services/billing-service'

/** The gift's count in words. One credit is one separation, said plainly:
 *  "up to 1 free song separations" read as a typo (review of PR 977). */
export function giftCount(credits: number): string {
  return credits === 1
    ? '1 free song separation'
    : `up to ${credits} free song separations`
}

/**
 * The launch gift, named by what it buys. A credit splits one song of up to
 * 12 minutes into voice and band on the Cloud GPU; a longer song or a full
 * band split costs more (billing-core `uvrJobCost`), so the count is "up
 * to".
 */
export function giftTitle(credits: number): string {
  const count = giftCount(credits)
  return count.charAt(0).toUpperCase() + count.slice(1)
}

/** Why the gift is worth having: Karaoke Night scores every note sung. */
export const GIFT_BODY =
  'Sing your favorite songs at Karaoke Night and see how you score.'

/** Under the sign-up button while the gift is on offer: when it lands. */
export const GIFT_ARRIVES = 'Your gift arrives when your email is confirmed.'

// Made on first use, not at import: the native build carries this module
// for giftCount alone, and drops whatever nothing there calls.
let day: Intl.DateTimeFormat | undefined

/** "23 October": the launch offer's last day, in UTC like its window. The
 *  one format for it, shared with the progress line (launch-offer.ts). */
export function offerDay(deadline: string): string {
  day ??= new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return day.format(new Date(deadline))
}

/**
 * Under the gift: what using it earns. The server's terms for a claim made
 * today (GET /api/billing/promo/featured, `offer`), so the count, the day
 * and the bonus are the ones the progress line shows once the gift is
 * claimed. Null when the server states no offer, and once its day is past.
 */
export function giftOfferLine(
  promo: FeaturedPromo,
  now: number = Date.now(),
): string | null {
  const offer = promo.offer
  if (offer === undefined || offer === null) return null
  if (!(now <= Date.parse(offer.deadline))) return null
  // "credit pack": someone who has not signed up yet has not met the packs.
  return offerSentence(offer, 'credit pack')
}

/**
 * The launch offer in one sentence: what to do, by when, and what it earns.
 * The gift's line says "credit pack"; the progress line and the claim toast,
 * read by an account that has the packs in Settings, say "pack".
 */
export function offerSentence(terms: GiftOfferTerms, pack: string): string {
  return `Use all ${terms.goal} by ${offerDay(terms.deadline)} and your next ${pack} comes with ${terms.bonusCredits} extra credits.`
}
