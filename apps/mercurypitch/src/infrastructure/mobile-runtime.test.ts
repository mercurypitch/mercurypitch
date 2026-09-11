// ============================================================
// The native runtime is composed from what this app installs
// ============================================================
//
// Every assertion here is against the runtime `createNativeRuntime()` really
// returns. That is the point: a probe told `purchasesAvailable: false` would
// report exactly that whatever this app composed, so it can only prove the
// shared package works — never that this binary asked for nothing.

import { describe, expect, it } from 'vitest'
import { createNativeRuntime } from './mobile-runtime'

describe('this app’s own composition', () => {
  const runtime = createNativeRuntime()

  it('reports purchases as unavailable rather than pretending', () => {
    // The only assertion that fails if someone adds a store to V1-1.
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

  it('admits it cannot schedule a notification', async () => {
    // `@capacitor/local-notifications` is not a dependency of this app, and
    // this is what says so from the outside. A product feature-detects the
    // capability through exactly this answer.
    await expect(runtime.localNotifications.checkPermission()).resolves.toBe(
      'unsupported',
    )
    await expect(runtime.localNotifications.requestPermission()).resolves.toBe(
      'unsupported',
    )
    await expect(
      runtime.localNotifications.schedule([]),
    ).resolves.toBeUndefined()
  })

  it('keeps the one native capability this app does install', async () => {
    // The REAL Capacitor adapter, not an inert port — and that is exactly
    // what this asserts. Off a device the plugin's web shim answers
    // `UNAVAILABLE` because there is no vibration API; an inert port would
    // have resolved quietly, so a rejection here is the evidence that the
    // call reached a plugin at all. The style mapping is tested in the
    // shared package, where the plugin is mocked.
    await expect(runtime.haptics.impact('light')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })
})
