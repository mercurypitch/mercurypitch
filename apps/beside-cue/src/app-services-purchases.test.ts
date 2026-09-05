// ============================================================
// Purchase composition — native beta mocks never configure RevenueCat
// ============================================================

import { createMobileRuntimeProbe } from '@irchiinnuss/mobile-runtime/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAppServices } from './app-services'
import { createBesideCueMobileRuntime } from './infrastructure/mobile-runtime'

vi.mock('./infrastructure/mobile-runtime', () => ({
  getBesideCuePlatform: () => 'ios',
  createBesideCueMobileRuntime: vi.fn(
    async () => createMobileRuntimeProbe().runtime,
  ),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('iOS purchase composition', () => {
  it('uses mock purchase ports while retaining the store-free native runtime', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_MOCK_PURCHASES', '1')
    vi.stubEnv('VITE_BESIDE_CUE_DISTRIBUTION', 'testflight-internal')
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'appl_unused_in_beta')

    const services = createDefaultAppServices()
    const runtime = await services.runtime

    expect(services.purchases.mock).toBe(true)
    expect(services.mockPurchaseRequest).toBeDefined()
    expect(createBesideCueMobileRuntime).toHaveBeenCalledWith()
    expect(runtime.purchases.available).toBe(true)
    expect(
      (await runtime.purchases.getCustomer()).activeEntitlementIds,
    ).toEqual([])
  })

  it('ignores mock flags in store distribution and passes only the real configuration', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_MOCK_PURCHASES', '1')
    vi.stubEnv('VITE_BESIDE_CUE_DISTRIBUTION', 'store')
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'appl_store_fixture')

    const services = createDefaultAppServices()
    await services.runtime

    expect(services.purchases.mock).toBeUndefined()
    expect(services.mockPurchaseRequest).toBeUndefined()
    expect(createBesideCueMobileRuntime).toHaveBeenCalledWith({
      apiKey: 'appl_store_fixture',
      logLevel: 'warn',
    })
  })
})
