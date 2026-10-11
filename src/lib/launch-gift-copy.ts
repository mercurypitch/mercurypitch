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
// The owner rejected "free Karaoke Night credits": the gift is named by what
// it buys, a song split into voice and band. The count is always the
// server's (promo-store), never a number written into the copy.

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
