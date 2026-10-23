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
  /** A shared voiceprint link was opened — the recipient saw what they
   *  were sent. Paired with `shared_start` below, these two are how the
   *  share loop's coefficient becomes a number instead of a guess. */
  'shared_view',
  /** ...and went on to take their own. */
  'shared_start',
  /** The take's link was copied on its own, rather than shared as a card.
   *  Kept apart from `card_shared`, which feeds a live Ads conversion and
   *  must go on meaning what it meant. */
  'link_copied',
  /** "Create my free account" under the results, tapped. Counts taps, not
   *  accounts: the tap opens the form, and the app's `signup` counts what
   *  comes of it. Shown only to a browser that has never met an account
   *  (MirrorAccountAsk). The ask's views are not counted separately: it has
   *  no view event, and `results_view` also fires where the ask is hidden.
   *  Not an Ads conversion. */
  'cta_account_click',
  // The store chips (src/components/shared/StoreChips.tsx), one name per
  // result screen and store: mirrorEvents keeps a name and a client id only.
  // A click, coming soon or live, so a count of clicks, not of people.
  /** The Voice Mirror result's App Store chip or badge was clicked. */
  'results_app_store_click',
  /** The Voice Mirror result's Google Play chip or badge was clicked. */
  'results_google_play_click',
  /** The Free Sing result's App Store chip or badge was clicked. */
  'free_sing_app_store_click',
  /** The Free Sing result's Google Play chip or badge was clicked. */
  'free_sing_google_play_click',
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
  'progress_viewed',
  'progress_period_changed',
  'progress_moment_opened',
  'progress_moment_changed',
  'progress_next_action_clicked',
  'progress_history_filtered',
  'progress_share_opened',
  'progress_share_completed',
  'progress_share_cancelled',
  'progress_share_downloaded',
  'progress_account_continuity_clicked',
  'voice_history_open',
  'voice_keep_attempt',
  'voice_keep_success',
  'voice_keep_failure',
  'voice_compare_start',
  'voice_compare_complete',
  'voice_export',
  /** The account page's own share buttons (Account -> Voice). Deliberately NOT
   *  the Mirror's `card_shared` / `link_copied`: `card_shared` is a live Google
   *  Ads conversion and has to go on meaning "someone shared from the Voice
   *  Mirror", and mirrorEvents stores an event name and a client id and nothing
   *  else — a name per surface is the only way to tell two surfaces apart. */
  'voice_share',
  'voice_link_copied',
  'voice_delete',
  'voice_storage_warning',
  /** A promo claim landed for the account signed in here, and this browser
   *  said so: one tapped in Settings, or the launch gift claimed when the
   *  email was confirmed (src/stores/launch-gift-store.ts). Once a claim. */
  'promo_claimed',
  /** The launch offer's progress ("Launch credits, 2 of 5 used") was shown:
   *  once a session, wherever it was (LaunchOfferProgress). */
  'offer_progress_view',
  /** The reward sheet ("All 5 used") opened: once per account. */
  'offer_unlocked_view',
  /** "See the packs", on the reward sheet or under the progress. */
  'offer_packs_tap',
  /** The native app's Cloud offer (paywall B, CloudOffer.tsx) shown, one
   *  name for each place that opens it (S7b §7). Not `pricing_view`, which
   *  is the web's own pricing page. */
  'cloud_view_import',
  'cloud_view_settings',
  'cloud_view_onboarding',
  /** The same offer, opened by the native onboarding's own Not now (or
   *  Back) when it is due, rather than at its end (owner, 20 Oct 2026). */
  'cloud_view_onboarding_exit',
  /** Subscribe tapped on it, and what the store answered: one name an
   *  answer (KaraokeSubscribeOutcome), `purchased` as success. */
  'cloud_subscribe_tap',
  'cloud_purchase_success',
  'cloud_purchase_moved',
  'cloud_purchase_held_elsewhere',
  'cloud_purchase_pending',
  'cloud_purchase_cancelled',
  'cloud_purchase_unavailable',
  'cloud_purchase_failed',
  /** Import a song tapped in the Karaoke room, one name for each row of
   *  the gate the singer was in at the tap (import-gate.ts ImportState). */
  'import_tap_songs_left',
  'import_tap_free_song',
  'import_tap_none_left',
  'import_tap_free_used',
  'import_tap_no_account',
  'import_tap_unknown',
  /** Songs sent to be separated. A client's first is the onboarding
   *  funnel's last step, the first import (S7b §7). */
  'import_sent',
] as const

/** Karaoke Night (src/features/karaoke-night/funnel.ts). */
export const KARAOKE_FUNNEL_EVENTS = [
  'karaoke_view',
  'karaoke_demo_start',
  'karaoke_demo_complete',
  'karaoke_upload_start',
  'karaoke_upload_done',
  'karaoke_upload_error',
  // Two staging events, deliberately. `karaoke_song_staged` is the one
  // Campaign E bids on, and it must mean the visitor brought a song of
  // their OWN — that is the vocal-remover intent the campaign buys. The
  // seeded Examples are stored as ordinary sessions, so before the split
  // one event covered both and a visitor could fire it by tapping a
  // built-in track without ever uploading anything.
  'karaoke_song_staged',
  'karaoke_example_staged',
  'karaoke_playlist_deeplink',
  'karaoke_playlist_start',
  'karaoke_mic_granted',
  'karaoke_first_pitch',
  'karaoke_first_score',
  'karaoke_scorecard_view',
  'karaoke_cta_studio',
  /** Signed out, the rail's "Create my free account" beside the launch
   *  gift line. */
  'karaoke_gift_signup_tap',
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
  /** The twin beat's Share button got the card out — a share sheet, a saved
   *  picture, or a saved picture with the link copied beside it. First Light's
   *  own name, for the same reason the account page has one. */
  'onboarding_share',
  'onboarding_mic_granted',
  'onboarding_mic_denied',
  'onboarding_map_room',
  /** A tap on one Map room, one name a room, beside `onboarding_map_room`
   *  for the same reason as the doors below: these events carry no metrics,
   *  so which room it was has to be in the name. */
  'onboarding_map_room_practice',
  'onboarding_map_room_exercises',
  'onboarding_map_room_ascent',
  'onboarding_map_room_karaoke',
  'onboarding_map_room_jam',
  'onboarding_map_room_analysis',
  /** A tap on one of the Map's four doors under the room grid, one name a
   *  door: these events carry no metrics, so which door it was has to be
   *  in the name. Sent beside `onboarding_map_room`, which still counts
   *  every way into a room. From the follow-up to PR 977. */
  'onboarding_map_door_challenges',
  'onboarding_map_door_guitar',
  'onboarding_map_door_piano',
  'onboarding_map_door_mirror',
  'onboarding_skipped',
  /** The welcome's close asked "Skip the intro?" first (skip-confirm.tsx). */
  'onboarding_skip_asked_intro',
  /** A Not now before the voiceprint asked "Skip your voiceprint?" first. */
  'onboarding_skip_asked_voiceprint',
  /** The questions' Not now asked "Skip your plan?" first. */
  'onboarding_skip_asked_plan',
  /** "Skip the intro?" answered with Keep going, Escape or the backdrop. */
  'onboarding_skip_kept_intro',
  /** "Skip your voiceprint?" answered with Keep going, Escape or the backdrop. */
  'onboarding_skip_kept_voiceprint',
  /** "Skip your plan?" answered with Keep going, Escape or the backdrop. */
  'onboarding_skip_kept_plan',
  'onboarding_done',
  /** Counts taps on the Keep beat's button (and the Map's way back to it),
   *  not accounts: the button opens the form, and `signup` counts what
   *  comes of it. The name is kept for its history. */
  'onboarding_account_created',
  'onboarding_account_dismissed',
  /** Keep rendered with the launch gift card, beside `onboarding_keep`. */
  'onboarding_keep_gift',
  /** The Map's gift link ("Get my gift", or "Save it and get the launch
   *  gift" under a voiceprint). Before 11 Oct 2026 the links read "Get my
   *  5 credits" and "Save it and get 5 free credits". */
  'onboarding_map_gift_tap',
  /** The Map's App Store chip or badge (StoreChips), first run or a #/map
   *  replay alike. */
  'onboarding_map_app_store_tap',
  /** The Map's Google Play chip or badge, the same way. */
  'onboarding_map_google_play_tap',
  // The native app's own onboarding (apps/mercurypitch/src/onboarding, S7b
  // §7), beside First Light's. These events carry no metrics, so the beat,
  // its variant and a score's band are in the name, and a beat's time is its
  // `_complete` row's createdAt less its `_view` row's.
  // The funnel: install, first note, range, Keep shown, `signup` (the
  // account made, from any sign-in), `cloud_view_onboarding`,
  // `cloud_purchase_success`, the first `import_sent`. An install that
  // leaves by Not now meets the offer as `cloud_view_onboarding_exit`.
  /** A new install: the onboarding flag settled due as the shell first mounts. */
  'native_onboarding_install',
  /** This install's beat 9 group, drawn as its onboarding first opens: the
   *  one in ten held out of the Cloud offer (S7 D13) is told apart here. */
  'native_onboarding_group_offer',
  'native_onboarding_group_holdout',
  /** Beat 1: Merc's welcome in the alley shown, and a door opened from it. */
  'native_onboarding_welcome_view',
  'native_onboarding_welcome_complete',
  /** Beats 2 and 3: the layer up on the first note, and a note named. */
  'native_onboarding_first_note_view',
  'native_onboarding_first_note_complete',
  /** The onboarding's first ask for the microphone, and its answer. */
  'native_onboarding_mic_granted',
  'native_onboarding_mic_denied',
  /** Continue without the mic, after a refused mic or one that would not
   *  open: straight to the landing (REQ-NFL-043). */
  'native_onboarding_without_mic',
  /** Beat 4: the range up, a range measured, or Skip for now. */
  'native_onboarding_range_view',
  'native_onboarding_range_complete',
  'native_onboarding_range_skipped',
  /** Beat 5: the reveal up, and its Continue. */
  'native_onboarding_reveal_view',
  'native_onboarding_reveal_complete',
  /** Beat 7: Keep shown with the voiceprint on it, or as Save your
   *  progress after a skipped range; then what was chosen on it. */
  'native_onboarding_keep_view_voiceprint',
  'native_onboarding_keep_view_progress',
  'native_onboarding_keep_apple',
  'native_onboarding_keep_google',
  'native_onboarding_keep_email',
  'native_onboarding_keep_find_range',
  'native_onboarding_keep_not_now',
  /** Beat 8: the line up, scored, and its score in S7b §3.6's bands: all
   *  ten, 7 to 9, 4 to 6, 0 to 3 notes on pitch. */
  'native_onboarding_line_view',
  'native_onboarding_line_complete',
  'native_onboarding_line_sung_all',
  'native_onboarding_line_sung_7_9',
  'native_onboarding_line_sung_4_6',
  'native_onboarding_line_sung_0_3',
  /** Beat 10: landed on the Warm-up's path. */
  'native_onboarding_path_view',
  /** Left by Not now (or Back) at any beat, or by its own last beat. */
  'native_onboarding_not_now',
  'native_onboarding_done',
] as const

/**
 * The tour events, the ones whose `tour`, `step` and `of` numbers ride along as
 * metrics (the worker's `cleanMirrorMetrics` keeps them). One list for both
 * halves: the client passes it as `metricEvents` and the worker builds its
 * allowlist entries from it, so they cannot drift.
 */
export const TOUR_FUNNEL_EVENTS = [
  /** A tour was offered to the visitor, before they chose. */
  'tour_offer',
  /** The visitor started a tour. */
  'tour_start',
  /** The visitor reached the end of a tour. */
  'tour_done',
  /** The visitor left a tour before its end; `step` is where. */
  'tour_exit',
] as const

/**
 * Guided tours, first-value moments and the plan. Web only: a native build
 * sends none of them. The room a first-value event is about is in its name,
 * since those events carry no metrics, and so is the option a plan answer
 * names.
 */
export const GUIDE_FUNNEL_EVENTS = [
  ...TOUR_FUNNEL_EVENTS,
  /** A device's first real result in a room (a saved run, a first Karaoke
   *  score, a finished Ear Lab drill, a finished guitar or piano song or
   *  take), sent once per device per room. One name a room, for the same
   *  reason as the Map rooms. */
  'first_value_sing',
  'first_value_karaoke',
  'first_value_drill',
  'first_value_ear',
  'first_value_guitar',
  'first_value_piano',
  // The plan: the four questions after First Light, and what comes of them
  // (src/features/plan). That module derives its names from the questions,
  // and plan-events.test.ts holds this list to them. They are written out
  // here as plain literals because the worker imports this file.
  /** Q1, the first answer. These events carry no metrics, so which option it
   *  was has to be in the name. The answers are sent once, when the flow ends
   *  (Done, or Not now on a question), so Back and a changed pick never count
   *  twice. */
  'plan_q1_singing',
  'plan_q1_guitar',
  'plan_q1_piano',
  'plan_q1_ear',
  'plan_q1_everything',
  /** Q2, what the person is working toward. Ear training has five goals of
   *  its own, and the other columns share five. */
  'plan_q2_song',
  'plan_q2_together',
  'plan_q2_audition',
  'plan_q2_basics',
  'plan_q2_fun',
  'plan_q2_tune',
  'plan_q2_intervals',
  'plan_q2_exam',
  'plan_q2_by_ear',
  'plan_q2_curious',
  /** Q3, what gets in the way: up to two a person, in the order tapped.
   *  `other` counts "Something else"; what is typed there stays on the
   *  device and is never in an event. */
  'plan_q3_time',
  'plan_q3_progress',
  'plan_q3_what',
  'plan_q3_tune',
  'plan_q3_difference',
  'plan_q3_tempo',
  'plan_q3_setup',
  'plan_q3_shy',
  'plan_q3_alone',
  'plan_q3_other',
  /** Q4, what the person has tried before. `app` counts "Another app"; the
   *  name typed there stays on the device. */
  'plan_q4_video',
  'plan_q4_teacher',
  'plan_q4_app',
  'plan_q4_along',
  'plan_q4_starting',
  /** The questions were put in front of someone. `new` is a new visitor in
   *  First Light, counted once, when the shown record is first written: a
   *  remount behind the auth modal counts nothing, and nor does a replay
   *  after Skip the intro, whose skip wrote the record. `existing` is an
   *  existing user in the app, counted once on the same rule: a takeover
   *  mounted again (the auth modal, a Google resume, a reload in the middle
   *  of it) finds the record and counts nothing. `skipper` is a person who
   *  opened them from Home or the Guide, counted at every opening. */
  'plan_shown_new',
  'plan_shown_existing',
  'plan_shown_skipper',
  /** A question passed with nothing picked (Skip, or Next with no pick),
   *  sent with the answers when the flow ends. */
  'plan_skipped_q1',
  'plan_skipped_q2',
  'plan_skipped_q3',
  'plan_skipped_q4',
  /** Not now on a question, which ends the flow. Named apart from the
   *  skips above, which would not tell it from a question passed. */
  'plan_declined_q1',
  'plan_declined_q2',
  'plan_declined_q3',
  'plan_declined_q4',
  /** Not now on the plan itself, after the answers were counted. */
  'plan_skipped_plan',
  /** The answers were given and the plan built: once a flow. */
  'plan_done',
  /** "See every room", on the plan. */
  'plan_rooms',
  /** A stop of the plan opened, one name for its kind. */
  'plan_stop_start',
  'plan_stop_learn',
  'plan_stop_play',
  /** The plan's menu switch was turned on. */
  'scope_offer_accept',
  /** Merc's showcase, the walk along the tab bar that "Show me around"
   *  starts: seen to its end, or skipped. */
  'showcase_done',
  'showcase_skipped',
] as const

/**
 * The Find Your Pitch lesson pages (src/features/lessons/kit/telemetry.ts).
 * Anonymous: every lesson event carries the one client id
 * `lesson-anonymous`, so no answer joins any other row, and its numbers say
 * which visit it was.
 */
export const LESSON_FUNNEL_EVENTS = [
  /** A quick check's or a recall's question, answered for the first time in
   *  a visit: the page, the question, whether that answer was right, the
   *  question's number of options, the visit and the consent it was sent
   *  under ride along as metrics (workers/db-worker/src/mirror-metrics.ts). */
  'lesson_answer',
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
  ...GUIDE_FUNNEL_EVENTS,
  ...LESSON_FUNNEL_EVENTS,
  ...RESERVED_FUNNEL_EVENTS,
] as const

export type MirrorFunnelEvent = (typeof MIRROR_FUNNEL_EVENTS)[number]
export type AppFunnelEventName = (typeof APP_FUNNEL_EVENTS)[number]
export type KaraokeFunnelEventName = (typeof KARAOKE_FUNNEL_EVENTS)[number]
export type GlassFunnelEventName = (typeof GLASS_FUNNEL_EVENTS)[number]
export type OnboardingFunnelEvent = (typeof ONBOARDING_FUNNEL_EVENTS)[number]
export type TourFunnelEvent = (typeof TOUR_FUNNEL_EVENTS)[number]
export type GuideFunnelEvent = (typeof GUIDE_FUNNEL_EVENTS)[number]
export type LessonFunnelEvent = (typeof LESSON_FUNNEL_EVENTS)[number]
export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number]
