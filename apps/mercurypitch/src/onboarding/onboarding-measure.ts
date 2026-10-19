// ============================================================
// The onboarding, measured: which name each step is counted under
// ============================================================
//
// S7b §7, through the onboarding funnel (src/features/onboarding/funnel.ts
// trackNativeOnboarding) and so the app's own anonymous sink, where it
// already counts app_open and signup: no new SDK, and nothing a consent
// rule of the native app's holds back (it ships no Google tag; see the
// funnel). The ingest keeps a name and no properties (db-worker
// handleMirrorEvent), so whatever a step says, its choice or its band, is
// in its name: no scores and no audio leave the phone.

import type { NativeOnboardingEvent } from '@/features/onboarding/funnel'
import type { KeepChoice } from '../shell/settings/account-offer'

/** Keep's choices on the onboarding's beat 7. */
export const KEEP_CHOICE_EVENT: Readonly<
  Record<KeepChoice, NativeOnboardingEvent>
> = {
  apple: 'native_onboarding_keep_apple',
  google: 'native_onboarding_keep_google',
  email: 'native_onboarding_keep_email',
  'find-range': 'native_onboarding_keep_find_range',
  'not-now': 'native_onboarding_keep_not_now',
}

/**
 * A sung line's score by S7b §3.6's bands, the ones Merc's word on it
 * follows (onboarding-copy.ts lineVerdict): all of them, seven in ten or
 * more, four in ten or more, and under that.
 */
export function lineBandEvent(
  hit: number,
  total: number,
): NativeOnboardingEvent {
  if (total > 0 && hit >= total) return 'native_onboarding_line_sung_all'
  const share = total > 0 ? hit / total : 0
  if (share >= 0.7) return 'native_onboarding_line_sung_7_9'
  if (share >= 0.4) return 'native_onboarding_line_sung_4_6'
  return 'native_onboarding_line_sung_0_3'
}
