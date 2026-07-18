// ============================================================
// Billing store — credit-balance refresh signal
// ============================================================
// The balance is displayed by PricingPanel (Settings → Account) via
// /api/billing/me. Bumping `balanceVersion` re-fetches it anywhere it is
// shown — used when returning from a Stripe checkout, where the webhook
// that grants the credits can land a moment after the redirect.

import { createSignal } from 'solid-js'
import { fetchBillingMe } from '@/db/services/billing-service'

const [balanceVersion, setBalanceVersion] = createSignal(0)

export { balanceVersion }

/** Trigger a re-fetch of the credit balance wherever it is displayed. */
export function refreshBalance(): void {
  setBalanceVersion((v) => v + 1)
}

/** Poll cadence for the post-checkout grant watch (~90 s in total). The
 *  webhook usually lands within seconds; the long tail covers Stripe
 *  retries. Exported for the unit test. */
export const GRANT_POLL_DELAYS_MS = [
  0, 2_000, 3_000, 5_000, 10_000, 15_000, 25_000, 30_000,
]

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Watch for the purchased credits to actually land after a checkout return:
 * poll /api/billing/me until the balance reaches `expectedMin` (stashed
 * before the redirect). Bumps `balanceVersion` on every poll so the visible
 * balance stays live. Resolves true once the credits arrived, false when the
 * watch timed out — the caller tells the user instead of leaving them
 * staring at a success toast over an unchanged balance.
 */
export async function waitForCreditGrant(
  expectedMin: number,
): Promise<boolean> {
  for (const delay of GRANT_POLL_DELAYS_MS) {
    if (delay > 0) await sleep(delay)
    const me = await fetchBillingMe()
    refreshBalance()
    if (me != null && me.creditBalance >= expectedMin) return true
  }
  return false
}
