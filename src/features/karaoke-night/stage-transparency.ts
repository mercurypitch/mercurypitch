// ============================================================
// Karaoke stage transparency — one preference for every Karaoke stage
// ============================================================
//
// The standalone stage and the in-app Stem Mixer deliberately share this
// preference, so moving between them does not unexpectedly reset the glass.
//
// The clamping and storage handling live in `createClampedPreference`,
// shared with Guitar Night's room glass. Only the numbers are ours.

import { createClampedPreference } from '@/lib/clamped-preference'

const preference = createClampedPreference({
  storageKey: 'pitchperfect_kn_stage_alpha',
  defaultValue: 0.45,
  min: 0.05,
  max: 1,
  step: 0.02,
})

export const KARAOKE_STAGE_ALPHA = preference.spec

export const loadKaraokeStageAlpha = preference.load

export const persistKaraokeStageAlpha = preference.persist
