// ============================================================
// The native runtime is composed without a store, and stays that way
// ============================================================

import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { describe, expect, it } from 'vitest'
import { MOBILE_RUNTIME_OPTIONS } from './mobile-runtime'

describe('this app’s own composition', () => {
  // The point of asserting on the options object rather than on the runtime:
  // a probe substitutes inert ports when told `purchasesAvailable: false`, and
  // would report exactly that whatever this app actually composed. This is the
  // only assertion that fails if someone adds a store to V1-1.
  it('names no purchases options at all', () => {
    expect('purchases' in MOBILE_RUNTIME_OPTIONS).toBe(false)
  })

  it('is frozen, so nothing can add one at runtime either', () => {
    expect(Object.isFrozen(MOBILE_RUNTIME_OPTIONS)).toBe(true)
  })
})

describe('a runtime composed that way', () => {
  const { runtime } = createMobileRuntimeProbe({ purchasesAvailable: false })

  it('reports purchases as unavailable rather than pretending', () => {
    expect(runtime.purchases.available).toBe(false)
    expect(runtime.paywall.available).toBe(false)
  })

  it('reads resolve, so a locked state renders without branching', async () => {
    const customer = await runtime.purchases.getCustomer()
    expect(customer.activeEntitlementIds).toEqual([])
    await expect(runtime.purchases.getOfferings()).resolves.toBeDefined()
  })

  it.each(['purchase', 'restore', 'logIn'] as const)(
    'rejects %s with `unavailable` rather than failing open',
    async (method) => {
      // Failing open here would mean a customer who tapped Buy gets the
      // entitlement without paying, which is the one outcome worse than an
      // error message.
      await expect(
        (runtime.purchases[method] as (...args: never[]) => Promise<unknown>)(),
      ).rejects.toMatchObject({ reason: 'unavailable' })
    },
  )
})
