// ============================================================
// V2 onboarding preview flag tests — exact and independent opt-in
// ============================================================

import { describe, expect, it } from 'vitest'
import { isOnboardingReviewEnabled, isV2OnboardingPreviewEnabled, } from './v2-onboarding-preview'

describe('V2 onboarding preview flag', () => {
  it('stays off unless the V2 flag is exactly one', () => {
    expect(isV2OnboardingPreviewEnabled({})).toBe(false)
    expect(
      isV2OnboardingPreviewEnabled({
        VITE_BESIDE_CUE_V2_ONBOARDING: 'true',
      }),
    ).toBe(false)
    expect(
      isV2OnboardingPreviewEnabled({
        VITE_BESIDE_CUE_V2_ONBOARDING: ' 1 ',
      }),
    ).toBe(false)
  })

  it('enables only the explicit V2 preview value', () => {
    expect(
      isV2OnboardingPreviewEnabled({
        VITE_BESIDE_CUE_V2_ONBOARDING: '1',
      }),
    ).toBe(true)
  })

  it('does not let the separate review flag activate V2', () => {
    expect(
      isV2OnboardingPreviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: '1',
      }),
    ).toBe(false)
    expect(
      isV2OnboardingPreviewEnabled({
        VITE_BESIDE_CUE_V2_ONBOARDING: '1',
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: '0',
      }),
    ).toBe(true)
  })

  it('enables review tools only for their own exact value', () => {
    expect(isOnboardingReviewEnabled({})).toBe(false)
    expect(
      isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: 'true',
      }),
    ).toBe(false)
    expect(
      isOnboardingReviewEnabled({
        VITE_BESIDE_CUE_ONBOARDING_REVIEW: '1',
      }),
    ).toBe(true)
  })
})
