import { describe, expect, it } from 'vitest'
import { resolvePurchasesSetup } from './revenuecat-config'

describe('purchases setup', () => {
  it('offers no store in the browser build', () => {
    const setup = resolvePurchasesSetup('web', { DEV: true })

    expect(setup.config).toBeUndefined()
    expect(setup.problem).toMatch(/android or ios/iu)
    expect(setup.entitlementId).toBe('BeSideCue Pro')
  })

  it('falls back to the Test Store key only while developing', () => {
    const setup = resolvePurchasesSetup('android', { DEV: true })

    expect(setup.config?.apiKey).toMatch(/^test_/u)
    expect(setup.config?.logLevel).toBe('debug')
  })

  it('refuses to run a Test Store key in a release build', () => {
    // The SDK aborts the app rather than run one, so this must never ship.
    const setup = resolvePurchasesSetup('android', {
      DEV: false,
      VITE_REVENUECAT_ANDROID_KEY: 'test_QQigLtGKqfRKFJNzgOlaVwUQUtP',
    })

    expect(setup.config).toBeUndefined()
    expect(setup.problem).toMatch(/release build/iu)
  })

  it('lets a debug artifact opt back into the Test Store', () => {
    // A native build always has DEV false, so this flag is the only way an
    // installable debug APK can reach a store at all before Play has products.
    const setup = resolvePurchasesSetup('android', {
      DEV: false,
      VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
    })

    expect(setup.config?.apiKey).toMatch(/^test_/u)
    expect(setup.config?.logLevel).toBe('debug')
  })

  it('accepts an explicit Test Store key when the debug flag is set', () => {
    const setup = resolvePurchasesSetup('android', {
      DEV: false,
      VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
      VITE_REVENUECAT_ANDROID_KEY: 'test_QQigLtGKqfRKFJNzgOlaVwUQUtP',
    })

    expect(setup.config?.apiKey).toMatch(/^test_/u)
  })

  it('ignores any value other than 1 for the debug flag', () => {
    // Guards against a stray "true"/"0" in CI quietly enabling the Test Store.
    for (const value of ['0', 'true', 'yes', '']) {
      const setup = resolvePurchasesSetup('android', {
        DEV: false,
        VITE_REVENUECAT_ALLOW_TEST_STORE: value,
      })

      expect(setup.config).toBeUndefined()
    }
  })

  it('prefers a real store key over the Test Store fallback', () => {
    const setup = resolvePurchasesSetup('android', {
      DEV: false,
      VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
      VITE_REVENUECAT_ANDROID_KEY: 'goog_android',
    })

    expect(setup.config?.apiKey).toBe('goog_android')
  })

  it('reports a release build that was given no key at all', () => {
    const setup = resolvePurchasesSetup('android', { DEV: false })

    expect(setup.config).toBeUndefined()
    expect(setup.problem).toMatch(/VITE_REVENUECAT_ANDROID_KEY/u)
  })

  it('reads the key for the platform it is running on', () => {
    const env = {
      DEV: false,
      VITE_REVENUECAT_ANDROID_KEY: 'goog_android',
      VITE_REVENUECAT_IOS_KEY: 'appl_ios',
    }

    expect(resolvePurchasesSetup('android', env).config?.apiKey).toBe(
      'goog_android',
    )
    expect(resolvePurchasesSetup('ios', env).config?.apiKey).toBe('appl_ios')
  })

  it('treats a blank environment value as unset', () => {
    const setup = resolvePurchasesSetup('android', {
      DEV: false,
      VITE_REVENUECAT_ANDROID_KEY: '   ',
    })

    expect(setup.config).toBeUndefined()
  })

  it('lets the dashboard rename the entitlement and offering', () => {
    const setup = resolvePurchasesSetup('android', {
      DEV: true,
      VITE_REVENUECAT_ENTITLEMENT_ID: 'pro',
      VITE_REVENUECAT_OFFERING_ID: 'launch',
    })

    expect(setup.entitlementId).toBe('pro')
    expect(setup.offeringId).toBe('launch')
  })
})
