// ============================================================
// Purchase build safety — explicit beta mode and fail-closed release keys
// ============================================================

import { describe, expect, it } from 'vitest'
import { assertPurchaseBuildSafe } from './purchase-build-policy'

describe('purchase build safety', () => {
  const mock = {
    VITE_MOCK_PURCHASES: '1',
    VITE_BESIDE_CUE_DISTRIBUTION: 'testflight-internal',
  }
  it('allows explicit internal mocks without a RevenueCat key', () => {
    expect(() => assertPurchaseBuildSafe(mock, false)).not.toThrow()
  })
  it('refuses mock configuration in any release tag', () => {
    expect(() => assertPurchaseBuildSafe(mock, true)).toThrow(/never a release/)
  })
  it('refuses a mock flag without internal-only distribution', () => {
    expect(() =>
      assertPurchaseBuildSafe({ VITE_MOCK_PURCHASES: '1' }, false),
    ).toThrow()
    expect(() =>
      assertPurchaseBuildSafe(
        { ...mock, VITE_BESIDE_CUE_DISTRIBUTION: 'store' },
        false,
      ),
    ).toThrow()
  })
  it('requires an explicit store distribution on release tags', () => {
    expect(() => assertPurchaseBuildSafe({}, true)).toThrow(
      /store distribution/,
    )
  })
  it('refuses Test Store in a distribution archive', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        { ...mock, VITE_REVENUECAT_ALLOW_TEST_STORE: '1' },
        false,
      ),
    ).toThrow(/Test Store/)
  })
  it.each(['', 'test_placeholder', 'goog_wrong-platform'])(
    'refuses an iOS store key of %s',
    (key) => {
      expect(() =>
        assertPurchaseBuildSafe(
          {
            VITE_BESIDE_CUE_DISTRIBUTION: 'store',
            VITE_BESIDE_CUE_NATIVE_PLATFORM: 'ios',
            VITE_REVENUECAT_IOS_KEY: key,
          },
          true,
        ),
      ).toThrow(/platform-specific/)
    },
  )
  it('allows the real platform configuration without mocks', () => {
    expect(() =>
      assertPurchaseBuildSafe(
        {
          VITE_BESIDE_CUE_DISTRIBUTION: 'store',
          VITE_BESIDE_CUE_NATIVE_PLATFORM: 'ios',
          VITE_REVENUECAT_IOS_KEY: 'appl_unit_test',
        },
        true,
      ),
    ).not.toThrow()
    expect(() =>
      assertPurchaseBuildSafe(
        {
          VITE_BESIDE_CUE_DISTRIBUTION: 'store',
          VITE_BESIDE_CUE_NATIVE_PLATFORM: 'android',
          VITE_REVENUECAT_ANDROID_KEY: 'goog_unit_test',
        },
        true,
      ),
    ).not.toThrow()
  })
  it('leaves ordinary web and native debug builds available', () => {
    expect(() => assertPurchaseBuildSafe({}, false)).not.toThrow()
    expect(() =>
      assertPurchaseBuildSafe({ VITE_REVENUECAT_ALLOW_TEST_STORE: '1' }, false),
    ).not.toThrow()
  })
})
