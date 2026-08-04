// ============================================================
// First Light — funnel instrumentation
// ============================================================
//
// Counts how far a new visitor gets: which beats they reached, which
// track they chose, whether the mic was granted, which room they left
// through, and whether they made an account. Without this we cannot
// tell whether the flow works.
//
// The mechanism — anonymous client id, local ring buffer, keepalive
// beacon — lives in src/lib/funnel.ts and is shared with the Mirror,
// Karaoke Night and Glass. This file is only the vocabulary.
//
// Event names must stay in sync with FUNNEL_EVENTS in
// workers/db-worker/src/index.ts, which allowlists them.

import { createFunnel } from '@/lib/funnel'

export type OnboardingEvent =
  // One per beat entered.
  | 'onboarding_sky'
  | 'onboarding_first_light'
  | 'onboarding_fork'
  | 'onboarding_voiceprint'
  | 'onboarding_twin'
  | 'onboarding_map'
  | 'onboarding_keep'
  | 'onboarding_prints'
  // Choices and outcomes.
  | 'onboarding_track_short'
  | 'onboarding_track_full'
  | 'onboarding_track_gallery'
  | 'onboarding_another_voiceprint'
  | 'onboarding_mic_granted'
  | 'onboarding_mic_denied'
  | 'onboarding_map_room'
  | 'onboarding_skipped'
  | 'onboarding_done'
  | 'onboarding_account_created'
  | 'onboarding_account_dismissed'

export const trackOnboarding = createFunnel<OnboardingEvent>({
  storageKey: 'onboarding.funnel.v1',
  label: 'onboarding-funnel',
})

/** The per-beat event for a beat id. */
export const BEAT_EVENT: Record<string, OnboardingEvent> = {
  sky: 'onboarding_sky',
  'first-light': 'onboarding_first_light',
  fork: 'onboarding_fork',
  voiceprint: 'onboarding_voiceprint',
  twin: 'onboarding_twin',
  map: 'onboarding_map',
  keep: 'onboarding_keep',
  prints: 'onboarding_prints',
}
