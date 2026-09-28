// ============================================================
// Which store a build sells through: the rules, without a device
// ============================================================
//
// The keys here are obviously fake. They only have to carry RevenueCat's
// prefixes, which is all this module reads.

import { describe, expect, it } from 'vitest'
import { resolvePurchasesSetup } from './purchases-setup'

const IOS_KEY = 'appl_notarealkey'
const ANDROID_KEY = 'goog_notarealkey'
const TEST_STORE_KEY = 'test_notarealkey'

describe('a build with its platform’s store key', () => {
  it('sells through the App Store on iOS, with the iOS key', () => {
    expect(
      resolvePurchasesSetup('ios', {
        VITE_REVENUECAT_IOS_KEY: IOS_KEY,
        VITE_REVENUECAT_ANDROID_KEY: ANDROID_KEY,
      }),
    ).toEqual({ apiKey: IOS_KEY })
  })

  it('sells through Play on Android, with the Android key', () => {
    expect(
      resolvePurchasesSetup('android', {
        VITE_REVENUECAT_IOS_KEY: IOS_KEY,
        VITE_REVENUECAT_ANDROID_KEY: ` ${ANDROID_KEY} `,
      }),
    ).toEqual({ apiKey: ANDROID_KEY })
  })
})

describe('a build that sells nothing', () => {
  it('has no key for its platform: the other platform’s is no use', () => {
    const setup = resolvePurchasesSetup('android', {
      VITE_REVENUECAT_IOS_KEY: IOS_KEY,
    })
    expect(setup.apiKey).toBeUndefined()
    expect(setup.problem).toContain('VITE_REVENUECAT_ANDROID_KEY')
  })

  it('has a key of the wrong store in its platform’s place', () => {
    expect(
      resolvePurchasesSetup('ios', { VITE_REVENUECAT_IOS_KEY: ANDROID_KEY })
        .apiKey,
    ).toBeUndefined()
  })

  it('is on the web, where there is no store at all', () => {
    expect(
      resolvePurchasesSetup('web', { VITE_REVENUECAT_IOS_KEY: IOS_KEY }).apiKey,
    ).toBeUndefined()
  })

  it('has a blank key', () => {
    expect(
      resolvePurchasesSetup('ios', { VITE_REVENUECAT_IOS_KEY: '  ' }).apiKey,
    ).toBeUndefined()
  })
})

describe('the Test Store', () => {
  // RevenueCat's SDK aborts a release app that configures a Test Store key,
  // and @irchiinnuss/purchase-kit refuses one in a distribution build. Here
  // it is honoured only where the build says it is a debug artifact.
  it('is refused unless the build says it is a debug artifact', () => {
    const setup = resolvePurchasesSetup('android', {
      VITE_REVENUECAT_ANDROID_KEY: TEST_STORE_KEY,
    })
    expect(setup.apiKey).toBeUndefined()
    expect(setup.problem).toContain('Test Store')
  })

  it('is used by a debug artifact that says so', () => {
    expect(
      resolvePurchasesSetup('android', {
        VITE_REVENUECAT_ANDROID_KEY: TEST_STORE_KEY,
        VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
      }),
    ).toEqual({ apiKey: TEST_STORE_KEY })
  })

  it('never stands in for a missing key', () => {
    expect(
      resolvePurchasesSetup('android', {
        VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
      }).apiKey,
    ).toBeUndefined()
  })
})
