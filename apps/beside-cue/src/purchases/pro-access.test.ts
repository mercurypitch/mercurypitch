import type { MobileRuntime, PurchasePlan } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import type { MobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { createCustomerSnapshot, createMobileRuntimeProbe, } from '@irchiinnuss/mobile-runtime/testing'
import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { ProAccess } from './pro-access'
import { createProAccess } from './pro-access'
import type { PurchasesSetup } from './revenuecat-config'

const ENTITLEMENT = 'BeSideCue Pro'

const NATIVE_SETUP: PurchasesSetup = {
  entitlementId: ENTITLEMENT,
  config: { apiKey: 'test_key', logLevel: 'warn' },
}

const WEB_SETUP: PurchasesSetup = {
  entitlementId: ENTITLEMENT,
  problem: 'Purchases need the Android or iOS app.',
}

function plan(overrides: Partial<PurchasePlan> = {}): PurchasePlan {
  return {
    id: 'yearly',
    kind: 'yearly',
    offeringId: 'default',
    productId: 'beside_cue_yearly',
    title: 'Yearly',
    description: 'A year of support',
    priceText: '€19.99',
    currencyCode: 'EUR',
    handle: {} as PurchasePlan['handle'],
    ...overrides,
  }
}

interface Harness {
  readonly access: ProAccess
  readonly probe: MobileRuntimeProbe
  dispose(): void
}

function harness(
  setup: PurchasesSetup = NATIVE_SETUP,
  probeOptions: Parameters<typeof createMobileRuntimeProbe>[0] = {},
): Harness {
  const probe = createMobileRuntimeProbe(probeOptions)
  let access!: ProAccess
  let dispose!: () => void

  createRoot((disposer) => {
    dispose = disposer
    access = createProAccess({
      runtime: Promise.resolve(probe.runtime),
      setup,
    })
  })

  return { access, probe, dispose }
}

/** A runtime whose store calls always fail the way an offline device does. */
function offlineRuntime(runtime: MobileRuntime): MobileRuntime {
  return {
    ...runtime,
    purchases: {
      ...runtime.purchases,
      async getCustomer() {
        throw new PurchasesFailure('network', 'no route to host')
      },
    },
  }
}

describe('pro access without a store', () => {
  it('stays locked and explains why', async () => {
    const { access, dispose } = harness(WEB_SETUP)

    await access.start()

    expect(access.available()).toBe(false)
    expect(access.status()).toBe('unavailable')
    expect(access.isPro()).toBe(false)
    expect(access.error()).toBe('Purchases need the Android or iOS app.')
    dispose()
  })

  it('does not reach for the store when asked to upgrade', async () => {
    const { access, probe, dispose } = harness(WEB_SETUP)

    await access.openPaywall()

    expect(probe.calls.paywalls).toHaveLength(0)
    dispose()
  })
})

describe('pro access with a store', () => {
  it('starts locked when the customer holds no entitlement', async () => {
    const { access, dispose } = harness()

    await access.start()

    expect(access.status()).toBe('ready')
    expect(access.isPro()).toBe(false)
    expect(access.error()).toBeUndefined()
    dispose()
  })

  it('unlocks from the customer already on the device', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      customer: createCustomerSnapshot([ENTITLEMENT]),
    })

    await access.start()

    expect(access.isPro()).toBe(true)
    expect(access.entitlement()?.id).toBe(ENTITLEMENT)
    dispose()
  })

  it('follows a revocation the store pushes after start', async () => {
    const { access, probe, dispose } = harness(NATIVE_SETUP, {
      customer: createCustomerSnapshot([ENTITLEMENT]),
    })
    await access.start()
    expect(access.isPro()).toBe(true)

    await probe.emitCustomer(createCustomerSnapshot([]))

    expect(access.isPro()).toBe(false)
    dispose()
  })

  it('ignores an entitlement this app does not sell', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      customer: createCustomerSnapshot(['some other product']),
    })

    await access.start()

    expect(access.isPro()).toBe(false)
    dispose()
  })
})

describe('purchasing', () => {
  it('unlocks and thanks the customer on success', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      onPurchase: () => ({
        kind: 'purchased',
        customer: createCustomerSnapshot([ENTITLEMENT]),
        productId: 'beside_cue_yearly',
      }),
    })
    await access.start()

    await access.purchase(plan())

    expect(access.isPro()).toBe(true)
    expect(access.notice()).toMatch(/pro is active/iu)
    dispose()
  })

  it('says nothing when the customer backs out', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      onPurchase: () => ({ kind: 'cancelled' }),
    })
    await access.start()

    await access.purchase(plan())

    expect(access.isPro()).toBe(false)
    expect(access.notice()).toBeUndefined()
    expect(access.error()).toBeUndefined()
    dispose()
  })

  it('keeps a pending payment honest instead of unlocking early', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      onPurchase: () => ({ kind: 'pending' }),
    })
    await access.start()

    await access.purchase(plan())

    expect(access.isPro()).toBe(false)
    expect(access.notice()).toMatch(/still being confirmed/iu)
    dispose()
  })
})

describe('restoring', () => {
  it('unlocks when the store account owns the entitlement', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      onRestore: () => createCustomerSnapshot([ENTITLEMENT]),
    })
    await access.start()

    await access.restore()

    expect(access.isPro()).toBe(true)
    expect(access.notice()).toMatch(/restored/iu)
    dispose()
  })

  it('says so plainly when there is nothing to restore', async () => {
    const { access, dispose } = harness()
    await access.start()

    await access.restore()

    expect(access.isPro()).toBe(false)
    expect(access.notice()).toMatch(/no previous purchase/iu)
    dispose()
  })
})

describe('the paywall', () => {
  it('asks for the entitlement it is gating', async () => {
    const { access, probe, dispose } = harness(NATIVE_SETUP, {
      onPaywall: () => 'cancelled',
    })
    await access.start()

    await access.openPaywall()

    expect(probe.calls.paywalls[0]?.requiredEntitlementId).toBe(ENTITLEMENT)
    dispose()
  })

  it('re-reads the customer after a purchase made inside it', async () => {
    const probeCustomer = createCustomerSnapshot([ENTITLEMENT])
    const { access, probe, dispose } = harness(NATIVE_SETUP, {
      customer: probeCustomer,
      onPaywall: () => 'purchased',
    })
    await access.start()
    const readsBefore = probe.calls.customerRefreshes

    await access.openPaywall()

    expect(probe.calls.customerRefreshes).toBe(readsBefore + 1)
    expect(access.isPro()).toBe(true)
    expect(access.notice()).toMatch(/pro is active/iu)
    dispose()
  })

  it('stays quiet when the entitlement was already active', async () => {
    const { access, dispose } = harness(NATIVE_SETUP, {
      customer: createCustomerSnapshot([ENTITLEMENT]),
      onPaywall: () => 'not-presented',
    })
    await access.start()

    expect(await access.openPaywall()).toBe('not-presented')
    expect(access.error()).toBeUndefined()
    dispose()
  })
})

describe('failures', () => {
  it('turns a network failure into something a person can act on', async () => {
    const probe = createMobileRuntimeProbe()
    let access!: ProAccess
    let dispose!: () => void
    createRoot((disposer) => {
      dispose = disposer
      access = createProAccess({
        runtime: Promise.resolve(offlineRuntime(probe.runtime)),
        setup: NATIVE_SETUP,
      })
    })

    await access.start()

    expect(access.error()).toMatch(/could not be reached/iu)
    expect(access.busy()).toBe(false)
    dispose()
  })
})

describe('teardown', () => {
  it('detaches the store listener so a revoked entitlement cannot leak in', async () => {
    const { access, probe, dispose } = harness()
    await access.start()

    await access.dispose()
    await probe.emitCustomer(createCustomerSnapshot([ENTITLEMENT]))

    expect(access.isPro()).toBe(false)
    dispose()
  })
})
