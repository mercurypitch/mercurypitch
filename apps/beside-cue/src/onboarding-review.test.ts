// ============================================================
// Onboarding review flag tests — exact opt-in
// ============================================================

import { describe, expect, it } from 'vitest'
import { isOnboardingReviewEnabled } from './onboarding-review'

describe('onboarding review flag', () => {
  it('enables review tools only for their own exact value', () => {
    expect(isOnboardingReviewEnabled({})).toBe(false)
    expect(
      isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: 'true',
      }),
    ).toBe(false)
    expect(
      isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: ' 1 ',
      }),
    ).toBe(false)
    expect(
      isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: '1',
      }),
    ).toBe(true)
  })
})
