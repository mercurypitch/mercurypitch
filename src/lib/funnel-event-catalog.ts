// ============================================================
// funnel-event-catalog — the ONE list of funnel event names
// ============================================================
// Both halves of the funnel read this file: each client surface derives its
// event union from its array here, and the db-worker builds its ingest
// allowlist from the same arrays (workers/db-worker/src/index.ts imports
// `FUNNEL_EVENT_NAMES` across the boundary, the way
// supporter-feature-catalog.ts is shared).
//
// Why it exists: the two sides used to be a hand-maintained TypeScript union
// and a hand-maintained Set, kept in sync by a comment. They drifted. Five
// events the client emitted were rejected 400 by the worker and dropped —
// `beacon()` never inspects the response — so the ENTIRE donation funnel and
// the returning-visitor "gallery" onboarding track recorded nothing at all,
// for as long as both features had shipped. A name that is in one list and
// not the other is now a type error, not a silent hole.
//
// Adding an event: put it in the array for its surface. That is the whole
// change — the client union and the worker allowlist both follow. Deploy the
// worker before (or with) the client, since the worker rejects unknown names.
//
// This module must stay dependency-free: the worker imports it, so anything
// browser-only reaching in here breaks the worker build.

/** Voice Mirror (src/features/mirror/funnel.ts). */
export const MIRROR_FUNNEL_EVENTS = [
  'mirror_view',
  'howto_view',
  'howto_done',
  'mic_granted',
  'mic_denied',
  'task_intro_done',
  'task_glide_done',
  'task_hold_done',
  'task_match_done',
  'results_view',
  'card_generated',
  'card_shared',
  'cta_app_click',
  'free_sing_done',
  'cosmic_done',
  'twin_revealed',
  'cta_glass_click',
] as const

/** The app itself (src/lib/analytics.ts). */
export const APP_FUNNEL_EVENTS = [
  'app_open',
  'signup',
  'session_complete',
  'challenge_attempt',
  'pricing_view',
  'checkout_start',
  'donate_view',
  'donate_start',
  'weekly_join',
  'weekly_attempt',
] as const

/** Karaoke Night (src/features/karaoke-night/funnel.ts). */
export const KARAOKE_FUNNEL_EVENTS = [
  'karaoke_view',
  'karaoke_demo_start',
  'karaoke_demo_complete',
  'karaoke_upload_start',
  'karaoke_upload_done',
  'karaoke_upload_error',
  'karaoke_song_staged',
  'karaoke_playlist_deeplink',
  'karaoke_playlist_start',
  'karaoke_mic_granted',
  'karaoke_first_pitch',
  'karaoke_first_score',
  'karaoke_scorecard_view',
  'karaoke_cta_studio',
] as const

/** Break Glass With Your Voice (src/features/glass/funnel.ts). */
export const GLASS_FUNNEL_EVENTS = [
  'glass_view',
  'glass_mic_granted',
  'glass_mic_denied',
  'glass_calibrate_done',
  'glass_rep_done',
  'glass_playback_done',
  'glass_shatter',
  'glass_results_view',
  'glass_fx_change',
  'glass_monitor_on',
  'glass_monitor_off',
  'glass_card_generated',
  'glass_card_shared',
  'glass_cta_app_click',
] as const

/** First Light onboarding (src/features/onboarding/funnel.ts). */
export const ONBOARDING_FUNNEL_EVENTS = [
  // One per beat entered.
  'onboarding_sky',
  'onboarding_first_light',
  'onboarding_fork',
  'onboarding_voiceprint',
  'onboarding_twin',
  'onboarding_map',
  'onboarding_keep',
  'onboarding_prints',
  // Choices and outcomes.
  'onboarding_track_short',
  'onboarding_track_full',
  'onboarding_track_gallery',
  'onboarding_another_voiceprint',
  'onboarding_mic_granted',
  'onboarding_mic_denied',
  'onboarding_map_room',
  'onboarding_skipped',
  'onboarding_done',
  'onboarding_account_created',
  'onboarding_account_dismissed',
] as const

/**
 * Accepted by the worker but emitted by no client yet.
 *
 * Registering a name early means the client rollout that starts emitting it
 * needs no worker redeploy. Keep this list SHORT and justified: an entry that
 * nobody ever emits is indistinguishable from a step someone forgot to wire,
 * which is how `email_click` has sat here since the email release was planned.
 */
export const RESERVED_FUNNEL_EVENTS = ['email_click'] as const

/** Every name the ingest endpoint accepts. */
export const FUNNEL_EVENT_NAMES = [
  ...MIRROR_FUNNEL_EVENTS,
  ...APP_FUNNEL_EVENTS,
  ...KARAOKE_FUNNEL_EVENTS,
  ...GLASS_FUNNEL_EVENTS,
  ...ONBOARDING_FUNNEL_EVENTS,
  ...RESERVED_FUNNEL_EVENTS,
] as const

export type MirrorFunnelEvent = (typeof MIRROR_FUNNEL_EVENTS)[number]
export type AppFunnelEventName = (typeof APP_FUNNEL_EVENTS)[number]
export type KaraokeFunnelEventName = (typeof KARAOKE_FUNNEL_EVENTS)[number]
export type GlassFunnelEventName = (typeof GLASS_FUNNEL_EVENTS)[number]
export type OnboardingFunnelEvent = (typeof ONBOARDING_FUNNEL_EVENTS)[number]
export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number]
