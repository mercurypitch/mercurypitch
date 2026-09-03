// ============================================================
// Onboarding review flag — one exact build-time opt-in
// ============================================================
//
// Review mode changes navigation tools, but never selects a product flow.

export interface OnboardingReviewEnvironment {
  readonly VITE_BESIDE_CUE_ONBOARDING_REVIEW?: string
}

/** Review tools are available only for the exact documented opt-in. */
export function isOnboardingReviewEnabled(
  environment: OnboardingReviewEnvironment,
): boolean {
  return environment.VITE_BESIDE_CUE_ONBOARDING_REVIEW === '1'
}
