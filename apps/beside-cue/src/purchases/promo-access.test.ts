// ============================================================
// Promo access — only store-verified entitlement changes unlock the cast
// ============================================================

import type { CustomerSnapshot } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import { createCustomerSnapshot, createMobileRuntimeProbe, } from '@irchiinnuss/mobile-runtime/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProAccess } from './pro-access'

const entitlementId = 'BeSideCue Pro'
const disposers: Array<() => Promise<void>> = []
afterEach(async () => {
  await Promise.all(disposers.splice(0).map((dispose) => dispose()))
})

function setup() {
  const probe = createMobileRuntimeProbe()
  const present = vi.fn(async () => {})
  const sync = vi.fn(async () => {})
  const getCustomer = vi.fn(probe.runtime.purchases.getCustomer)
  const access = createProAccess({
    setup: {
      entitlementId,
      config: { apiKey: 'appl_fixture', logLevel: 'warn' },
    },
    runtime: Promise.resolve({
      ...probe.runtime,
      purchases: {
        ...probe.runtime.purchases,
        getCustomer,
        presentCodeRedemptionSheet: present,
        syncPurchases: sync,
      },
    }),
  })
  disposers.push(() => access.dispose())
  return { probe, present, sync, getCustomer, access }
}

describe('store offer redemption', () => {
  it('does not treat sheet presentation as purchase success', async () => {
    const { access, present } = setup()
    await access.start()

    await access.redeemCode()

    expect(present).toHaveBeenCalledOnce()
    expect(access.isPro()).toBe(false)
    expect(access.notice()).toMatch(/only when the store confirms/)
    expect(access.busy()).toBe(false)
  })

  it('unlocks after a late verified transaction, then follows revocation', async () => {
    const { access, probe } = setup()
    await access.start()
    await access.redeemCode()

    await probe.emitCustomer(createCustomerSnapshot([entitlementId]))

    expect(access.isPro()).toBe(true)
    expect(access.notice()).toBe('Premium access is confirmed.')
    await probe.emitCustomer(createCustomerSnapshot([]))
    expect(access.isPro()).toBe(false)
    expect(access.notice()).not.toBe('Premium access is confirmed.')
  })

  it.each([true, false])(
    'does not overwrite a newer store update with a stale read (active: %s)',
    async (active) => {
      const { access, probe, getCustomer } = setup()
      await access.start()
      let finish!: (customer: CustomerSnapshot) => void
      getCustomer.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )

      const checking = access.checkPromoAccess()
      await vi.waitFor(() => expect(getCustomer).toHaveBeenCalledTimes(2))
      await probe.emitCustomer(
        createCustomerSnapshot(active ? [entitlementId] : []),
      )
      finish(createCustomerSnapshot(active ? [] : [entitlementId]))
      await checking

      expect(access.isPro()).toBe(active)
      expect(access.notice()).toMatch(
        active
          ? /^Premium access is confirmed\.$/
          : /^No active premium access/,
      )
    },
  )

  it('synchronizes an outside-store redemption before checking access', async () => {
    const { access, probe, sync } = setup()
    await access.start()
    sync.mockImplementation(async () => {
      await probe.emitCustomer(createCustomerSnapshot([entitlementId]))
    })

    await access.checkPromoAccess()

    expect(sync).toHaveBeenCalledOnce()
    expect(access.isPro()).toBe(true)
    expect(access.notice()).toBe('Premium access is confirmed.')
  })

  it('keeps premium locked when a redemption sync fails offline', async () => {
    const { access, sync } = setup()
    await access.start()
    sync.mockRejectedValue(new PurchasesFailure('network', 'offline'))

    await access.checkPromoAccess()

    expect(access.isPro()).toBe(false)
    expect(access.error()).toMatch(/online/)
    expect(access.notice()).toBeUndefined()
    expect(access.busy()).toBe(false)
  })

  it('never confirms an unrelated entitlement', async () => {
    const { access, probe } = setup()
    await access.start()
    await probe.emitCustomer(createCustomerSnapshot(['different-product']))

    await access.checkPromoAccess()

    expect(access.isPro()).toBe(false)
    expect(access.notice()).toMatch(/No active premium access/)
  })

  it('opens only one redemption sheet for rapid repeated taps', async () => {
    const { access, present } = setup()
    await access.start()
    let finish!: () => void
    present.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )

    const first = access.redeemCode()
    await Promise.resolve()
    await access.redeemCode()

    expect(present).toHaveBeenCalledOnce()
    finish()
    await first
  })
})
