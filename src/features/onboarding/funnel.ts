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
// Event names live in src/lib/funnel-event-catalog.ts, which the db-worker
// builds its ingest allowlist from — so a name cannot exist on one side only.

import { AD_CONVERSIONS } from '@/lib/consent'
import { createFunnel } from '@/lib/funnel'
import type { OnboardingFunnelEvent } from '@/lib/funnel-event-catalog'

export type OnboardingEvent = OnboardingFunnelEvent

export const trackOnboarding = createFunnel<OnboardingEvent>({
  storageKey: 'onboarding.funnel.v1',
  label: 'onboarding-funnel',
  // Milestones that are also Google Ads conversion actions (see the campaigns
  // repo `mercury/config/conversion-map.md`).
  adConversions: {
    // The in-app analogue of the Mirror's `mirror_complete`, and the bid target
    // for Campaign H — the visitor sang the ~90s voiceprint and saw their
    // result. `onboarding_twin` rather than `onboarding_voiceprint` on purpose:
    // beats fire on ENTRY, so `onboarding_voiceprint` means "started singing",
    // while the twin beat renders only once a voiceprint exists
    // (FirstLight.tsx gates it on `voiceprint() !== null`). Bidding on the
    // start would buy visitors who never finish.
    //
    // No device-level dedup guard here, matching the Mirror: the action is
    // ONE_PER_CLICK, so Google collapses a replay within the same ad click.
    onboarding_twin: AD_CONVERSIONS.voiceprint_complete,
  },
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
