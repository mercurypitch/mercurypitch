// ============================================================
// V2 onboarding preview flag — one exact build-time opt-in
// ============================================================
//
// V2 activation and the existing review controls are deliberately separate:
// review mode may change navigation tools, but it never selects a product flow.

export interface V2OnboardingPreviewEnvironment {
  readonly VITE_BESIDE_CUE_V2_ONBOARDING?: string
  readonly VITE_BESIDE_CUE_ONBOARDING_REVIEW?: string
}

/** Only the exact documented value enables the caption-first V2 preview. */
export function isV2OnboardingPreviewEnabled(
  environment: V2OnboardingPreviewEnvironment,
): boolean {
  return environment.VITE_BESIDE_CUE_V2_ONBOARDING === '1'
}

/** Review tools are a second exact opt-in, independent from V2 activation. */
export function isOnboardingReviewEnabled(
  environment: V2OnboardingPreviewEnvironment,
): boolean {
  return environment.VITE_BESIDE_CUE_ONBOARDING_REVIEW === '1'
}
