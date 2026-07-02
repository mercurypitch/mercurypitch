// ============================================================
// Billing store — credit-balance refresh signal
// ============================================================
// The balance is displayed by PricingPanel (Settings → Account) via
// /api/billing/me. Bumping `balanceVersion` re-fetches it anywhere it is
// shown — used when returning from a Stripe checkout, where the webhook
// that grants the credits can land a moment after the redirect.

import { createSignal } from 'solid-js'

const [balanceVersion, setBalanceVersion] = createSignal(0)

export { balanceVersion }

/** Trigger a re-fetch of the credit balance wherever it is displayed. */
export function refreshBalance(): void {
  setBalanceVersion((v) => v + 1)
}
