// ============================================================
// Billing store — post-checkout grant watch
// ============================================================
// waitForCreditGrant is the piece that turns "success toast and hope" into
// verified credits: it must resolve true as soon as the balance reaches the
// stashed expectation and false once the poll schedule is exhausted.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BillingMe } from '@/db/services/billing-service'

vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: vi.fn(),
}))

import { fetchBillingMe } from '@/db/services/billing-service'
import { balanceVersion, GRANT_POLL_DELAYS_MS, waitForCreditGrant, } from '@/stores/billing-store'

const me = (creditBalance: number): BillingMe => ({
  creditBalance,
  entitlements: [],
  stripeConfigured: true,
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('waitForCreditGrant', () => {
  it('resolves true as soon as the balance reaches the expectation', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchBillingMe)
      .mockResolvedValueOnce(me(0))
      .mockResolvedValueOnce(me(30))
    const result = waitForCreditGrant(30)
    await vi.advanceTimersByTimeAsync(GRANT_POLL_DELAYS_MS[1])
    await expect(result).resolves.toBe(true)
    expect(fetchBillingMe).toHaveBeenCalledTimes(2)
  })

  it('resolves false when the credits never arrive', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchBillingMe).mockResolvedValue(me(0))
    const result = waitForCreditGrant(30)
    await vi.advanceTimersByTimeAsync(
      GRANT_POLL_DELAYS_MS.reduce((a, b) => a + b, 0),
    )
    await expect(result).resolves.toBe(false)
    expect(fetchBillingMe).toHaveBeenCalledTimes(GRANT_POLL_DELAYS_MS.length)
  })

  it('keeps polling through unreachable-backend nulls, bumping the balance signal', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchBillingMe)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(me(65))
    const before = balanceVersion()
    const result = waitForCreditGrant(65)
    await vi.advanceTimersByTimeAsync(GRANT_POLL_DELAYS_MS[1])
    await expect(result).resolves.toBe(true)
    expect(balanceVersion()).toBe(before + 2)
  })
})
