// ============================================================
// Plan credits — the one line the plan says about credits
// ============================================================
//
// Karaoke Night splits a song into voice and band, which costs credits, so
// its card says where the person stands: a gift on its way (a new visitor),
// the credits they hold (a signed-in singer with some), or what the cheapest
// pack costs (a signed-in singer with none). Spec 5.3, rule by rule, the
// first that fits wins.
//
// Two things are easy to break:
//
// - It is pure. The host finds out whether the build can take payment, who
//   is signed in, which gift the server offers, the balance and the pack's
//   price, and hands the findings in; nothing here fetches or reads a store.
//   A balance of null is "not known yet", never "empty": an unknown balance
//   says nothing rather than offering a pack to someone who may hold credits.
// - The words are never new ones. The gift's are launch-gift-copy's, and its
//   count is always the server's. A count of credits is credit-cost-model's
//   (its number and word are joined by a non-breaking space, as everywhere
//   else in the app). What a credit buys quotes the length the credit guide
//   in Settings states (credit-cost-model.ts reads the same constant), so a
//   change to that length changes this line with it.
//
// A build that cannot take payment (the store build) gets no line at all.

import { creditCount } from '@/components/billing/credit-cost-model'
import { formatPrice } from '@/db/services/billing-service'
import { GIFT_ARRIVES, giftTitle } from '@/lib/launch-gift-copy'
import { UVR_BASE_MINUTES } from '../../../workers/db-worker/src/billing-core'

/**
 * The title and the line under it, as the card shows them, and what they are
 * about, so the screen can dress them: a gift is a present, a balance and a
 * first pack are not.
 */
export interface CreditsLine {
  kind: 'gift' | 'balance' | 'price'
  title: string
  sub: string
}

/** What the plan's host has found out; every field is a finding, not a fetch. */
export interface CreditsInput {
  /** False on a build that cannot take payment, where nothing is bought. */
  canTakePayment: boolean
  signedIn: boolean
  /** The launch gift on offer to a new visitor: the server's count. */
  gift: { credits: number } | null
  /** The credits the account holds; null while that is not known. */
  balance: number | null
  /** The cheapest pack on sale, in minor units of its currency. */
  cheapestPack: { amount: number; currency: string } | null
}

/** What one credit buys, said under both of a signed-in singer's lines. */
const WHAT_A_CREDIT_BUYS = `One credit splits a song of up to ${UVR_BASE_MINUTES} minutes into voice and band.`

/** The gift, when a new visitor has one on offer. */
function giftLine(gift: CreditsInput['gift']): CreditsLine | null {
  if (gift === null || gift.credits <= 0) return null
  return { kind: 'gift', title: giftTitle(gift.credits), sub: GIFT_ARRIVES }
}

/** A signed-in singer's line: what they hold, or where credits start. */
function accountLine(i: CreditsInput): CreditsLine | null {
  const { balance, cheapestPack } = i
  if (balance !== null && balance > 0) {
    return {
      kind: 'balance',
      title: `You have ${creditCount(balance)}`,
      sub: WHAT_A_CREDIT_BUYS,
    }
  }
  if (balance === 0 && cheapestPack !== null && cheapestPack.amount > 0) {
    const price = formatPrice(cheapestPack.amount, cheapestPack.currency)
    return {
      kind: 'price',
      title: `Credits from ${price}`,
      sub: WHAT_A_CREDIT_BUYS,
    }
  }
  return null
}

/** The line the plan's Karaoke Night card carries, or null when it says nothing. */
export function planCreditsLine(i: CreditsInput): CreditsLine | null {
  if (!i.canTakePayment) return null
  return i.signedIn ? accountLine(i) : giftLine(i.gift)
}
