// ============================================================
// Native redemption — SDK calls, platform guard and failures stay at the port
// ============================================================

import type * as CapacitorModule from '@capacitor/core'
import type * as PurchasesModule from '@revenuecat/purchases-capacitor'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapacitorPurchasesPort } from './purchases'

const sdk = vi.hoisted(() => ({
  isConfigured: vi.fn(async () => ({ isConfigured: false })),
  configure: vi.fn(async () => {}),
  presentCodeRedemptionSheet: vi.fn(async () => {}),
  syncPurchases: vi.fn(async () => {}),
}))
const native = vi.hoisted(() => ({ getPlatform: vi.fn(() => 'ios') }))
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof CapacitorModule>()),
  Capacitor: native,
}))
vi.mock('@revenuecat/purchases-capacitor', async (importOriginal) => ({
  ...(await importOriginal<typeof PurchasesModule>()),
  Purchases: sdk,
}))
afterEach(() => {
  vi.clearAllMocks()
  native.getPlatform.mockReturnValue('ios')
})

describe('native code redemption', () => {
  it('configures once before opening the iOS store sheet', async () => {
    const port = createCapacitorPurchasesPort({ apiKey: 'appl_fixture' })

    await port.presentCodeRedemptionSheet!()
    await port.syncPurchases!()

    expect(sdk.configure).toHaveBeenCalledExactlyOnceWith({
      apiKey: 'appl_fixture',
    })
    expect(sdk.presentCodeRedemptionSheet).toHaveBeenCalledOnce()
    expect(sdk.syncPurchases).toHaveBeenCalledOnce()
    expect(sdk.configure.mock.invocationCallOrder[0]).toBeLessThan(
      sdk.presentCodeRedemptionSheet.mock.invocationCallOrder[0]!,
    )
  })

  it('refuses the Apple-only sheet on Android without configuring the SDK', async () => {
    native.getPlatform.mockReturnValue('android')
    const port = createCapacitorPurchasesPort({ apiKey: 'goog_fixture' })

    await expect(port.presentCodeRedemptionSheet!()).rejects.toMatchObject({
      reason: 'unavailable',
    })

    expect(sdk.configure).not.toHaveBeenCalled()
    expect(sdk.presentCodeRedemptionSheet).not.toHaveBeenCalled()
  })

  it('preserves configuration errors instead of granting premium', async () => {
    const port = createCapacitorPurchasesPort({ apiKey: 'appl_fixture' })
    sdk.presentCodeRedemptionSheet.mockRejectedValueOnce({
      code: '23',
      message: 'Configuration failed',
    })

    await expect(port.presentCodeRedemptionSheet!()).rejects.toMatchObject({
      reason: 'configuration',
    })
  })

  it('surfaces sync failures as a retryable network problem', async () => {
    const port = createCapacitorPurchasesPort({ apiKey: 'appl_fixture' })
    sdk.syncPurchases.mockRejectedValueOnce({ code: '10', message: 'Offline' })

    await expect(port.syncPurchases!()).rejects.toMatchObject({
      reason: 'network',
    })
  })
})
