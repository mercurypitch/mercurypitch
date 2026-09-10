// ============================================================
// Purchase build safety — the generalised rules, on two different apps
// ============================================================
//
// Beside Cue's own suite still exercises these rules through its thin wrapper,
// which is what proves the extraction changed nothing. This file tests what
// that one cannot: that the rules read the env var names they were GIVEN, so
// one app's switches can never decide another app's build.

import { describe, expect, it } from 'vitest'
import { assertPurchaseBuildSafe } from './build-policy'

const BESIDE_CUE = {
  appName: 'Beside Cue',
  distributionEnv: 'VITE_BESIDE_CUE_DISTRIBUTION',
  platformEnv: 'VITE_BESIDE_CUE_NATIVE_PLATFORM',
} as const

const MERCURY_PITCH = {
  appName: 'Mercury Pitch',
  distributionEnv: 'VITE_MERCURYPITCH_DISTRIBUTION',
  platformEnv: 'VITE_MERCURYPITCH_NATIVE_PLATFORM',
} as const

describe('the policy reads only the names it was given', () => {
  it('ignores the other app’s distribution variable entirely', () => {
    // A store build as far as Beside Cue is concerned, and nothing at all as
    // far as Mercury Pitch is concerned. If these two ever shared a name, one
    // app's release tag would start demanding the other's RevenueCat key.
    const env = { VITE_BESIDE_CUE_DISTRIBUTION: 'store' }
    expect(() =>
      assertPurchaseBuildSafe(MERCURY_PITCH, env, false),
    ).not.toThrow()
    expect(() => assertPurchaseBuildSafe(BESIDE_CUE, env, false)).toThrow(
      /name its native purchase platform/,
    )
  })

  it('names the refusing app in the message', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        { VITE_MERCURYPITCH_DISTRIBUTION: 'nonsense' },
        false,
      ),
    ).toThrow(/Unknown Mercury Pitch purchase distribution/)
  })
})

describe('a store distribution with no platform key', () => {
  it('is refused when the platform is missing', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        { VITE_MERCURYPITCH_DISTRIBUTION: 'store' },
        false,
      ),
    ).toThrow(/name its native purchase platform/)
  })

  it('is refused when the platform is named but its key is absent', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'ios',
        },
        false,
      ),
    ).toThrow(/platform-specific/)
  })

  it('is refused when the key is the other platform’s', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'ios',
          VITE_REVENUECAT_IOS_KEY: 'goog_realkey',
        },
        false,
      ),
    ).toThrow(/platform-specific/)
  })

  it('is refused when the key is a bare prefix', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'ios',
          VITE_REVENUECAT_IOS_KEY: 'appl_',
        },
        false,
      ),
    ).toThrow(/platform-specific/)
  })

  it('passes with a real platform key', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'ios',
          VITE_REVENUECAT_IOS_KEY: 'appl_aBcDeFgHiJkLmNoPqRsT',
        },
        true,
      ),
    ).not.toThrow()
  })
})

describe('a test_ key in a distribution archive', () => {
  // The ALLOW_TEST_STORE flag states an intent. A key states a fact, and the
  // two disagree whenever a stale .env.local or a mis-pasted secret is in
  // play -- at which point the flag reports the build as safe and RevenueCat's
  // SDK aborts the app on a reviewer's device instead.
  const testKey = 'test_aBcDeFgHiJkLmNoPqRsT'

  it('is refused on a release tag', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'ios',
          VITE_REVENUECAT_IOS_KEY: testKey,
        },
        true,
      ),
    ).toThrow(/Test Store key/)
  })

  it('is refused in a store build with the flag unset', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'android',
          VITE_REVENUECAT_ANDROID_KEY: testKey,
        },
        false,
      ),
    ).toThrow(/Test Store key/)
  })

  it('is refused even on the platform this build is not for', () => {
    // A stray iOS test key in an Android store build never reaches the SDK,
    // but it is still shipped inside the bundle and still says something went
    // wrong upstream.
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_MERCURYPITCH_DISTRIBUTION: 'store',
          VITE_MERCURYPITCH_NATIVE_PLATFORM: 'android',
          VITE_REVENUECAT_ANDROID_KEY: 'goog_aBcDeFgHiJkLmNoPqRsT',
          VITE_REVENUECAT_IOS_KEY: testKey,
        },
        false,
      ),
    ).toThrow(/Test Store key/)
  })

  it('is allowed in a development build, which is what it is for', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        {
          VITE_REVENUECAT_IOS_KEY: testKey,
          VITE_REVENUECAT_ALLOW_TEST_STORE: '1',
        },
        false,
      ),
    ).not.toThrow()
  })
})

describe('mock purchases', () => {
  const mock = {
    VITE_MOCK_PURCHASES: '1',
    VITE_MERCURYPITCH_DISTRIBUTION: 'testflight-internal',
  }

  it('are allowed in an internal TestFlight build with no key at all', () => {
    expect(() =>
      assertPurchaseBuildSafe(MERCURY_PITCH, mock, false),
    ).not.toThrow()
  })

  it('never escape onto a release tag', () => {
    expect(() => assertPurchaseBuildSafe(MERCURY_PITCH, mock, true)).toThrow(
      /never a release/,
    )
  })

  it('and internal distribution have to agree, in both directions', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        { VITE_MOCK_PURCHASES: '1' },
        false,
      ),
    ).toThrow()
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        { VITE_MERCURYPITCH_DISTRIBUTION: 'testflight-internal' },
        false,
      ),
    ).toThrow()
  })
})

describe('a build that is not distributing anything', () => {
  it('is left alone', () => {
    expect(() =>
      assertPurchaseBuildSafe(MERCURY_PITCH, {}, false),
    ).not.toThrow()
    expect(() =>
      assertPurchaseBuildSafe(
        MERCURY_PITCH,
        { VITE_MERCURYPITCH_DISTRIBUTION: '' },
        false,
      ),
    ).not.toThrow()
  })
})
