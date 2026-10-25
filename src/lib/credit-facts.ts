// ============================================================
// Credit facts — the balance and the cheapest pack a credits line states
// ============================================================
//
// The plan's Karaoke Night card and Karaoke Night's own tour say the same
// credits line (planCreditsLine), so both read their facts here: the plan
// controller for a signed-in singer's balance and first pack, the tour for
// the first pack (it has the standalone account's balance already). Moved
// out of the controller for that (R21); Karaoke Night cannot import the
// controller, and nothing here imports the app.
//
// What a line may claim is the rule:
//
// - A pack is named only when it can be bought, at a price above nothing.
// - What cannot be read is null, and the line then says nothing. Neither
//   function rejects: `fetchPricing` throws on a bad answer, and that is
//   swallowed here, as is a failed `fetchBillingMe`.

import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'

/** A pack's price, in minor units of its currency. */
export interface PackPrice {
  amount: number
  currency: string
}

export interface AccountFacts {
  /** The credits the account holds; null when that cannot be read. */
  balance: number | null
  /** The cheapest pack on sale, asked for only for a balance of none. */
  cheapestPack: PackPrice | null
}

/** The cheapest pack on sale: one that can be bought, with a price. */
export async function cheapestPack(): Promise<PackPrice | null> {
  try {
    const pricing = await fetchPricing()
    let cheapest: PackPrice | null = null
    for (const pack of pricing?.packs ?? []) {
      if (!pack.purchasable || pack.amount === null || pack.amount <= 0)
        continue
      if (cheapest === null || pack.amount < cheapest.amount) {
        cheapest = { amount: pack.amount, currency: pack.currency }
      }
    }
    return cheapest
  } catch {
    // fetchPricing throws on a bad answer, and a line shows without a price.
    return null
  }
}

/**
 * The balance, and, for a balance of none, the pack to start from (a balance
 * the line states needs no price). Never rejects: what cannot be read is
 * null, and the line says nothing for it.
 */
export async function loadAccountFacts(): Promise<AccountFacts> {
  try {
    const me = await fetchBillingMe()
    const balance = me === null ? null : me.creditBalance
    return {
      balance,
      cheapestPack: balance === 0 ? await cheapestPack() : null,
    }
  } catch {
    return { balance: null, cheapestPack: null }
  }
}
